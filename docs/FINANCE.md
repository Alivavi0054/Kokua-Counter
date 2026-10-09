# Operational fee, refunds and accounting

This document describes how the 5% operational fee works, how it is accounted for, and what had to be
decided along the way. The authoritative implementation is migration
[`0012_operational_fee.sql`](../supabase/migrations/0012_operational_fee.sql); the TypeScript in `lib/` mirrors
only what is needed for previews and orchestration.

## The rule

A donor chooses a donation (the **principal**). An **operational fee** is added **on top**:

| Donation | Fee (5%) | Total charged | Reaches the meal pool |
| --- | --- | --- | --- |
| $5.00 | $0.25 | $5.25 | $5.00 |
| $8.00 | $0.40 | $8.40 | $8.00 |
| $10.00 | $0.50 | $10.50 | $10.00 |
| $20.00 | $1.00 | $21.00 | $20.00 |
| $100.00 | $5.00 | $105.00 | $100.00 |

* Amounts are **integer cents**. The rate is **integer basis points** (500 = 5%). No floating point anywhere.
* **Rounding rule (permanent):** `fee = round-half-up(principal × bps / 10 000)` to the nearest cent, computed as
  `floor((principal × bps + 5000) / 10000)`. SQL: `calculate_operational_fee`; TypeScript: `calculateOperationalFee`.
  A database CHECK ties every stored fee to its stored rate with this rule.
* The fee is **never deducted** from the donation. The donation is credited to the pool in full.
* The default rate is 500 bps, seeded by the migration as the first row of `fee_settings` (a test asserts it equals
  `DEFAULT_OPERATIONAL_FEE_BPS`). Administrators can change it (0 to 20%) at **Admin → Finance**.

## What the existing architecture was, and how this extends it

| Area | Before | Now |
| --- | --- | --- |
| Source of truth for pool money | `pool_ledger`: append-only, single-entry, signed cents, unique `reference_key` for idempotency | **Unchanged**, still principal only. The fee never enters it, so a fee can never fund a meal or be paid to an eatery |
| Source of truth for operating money | none | **`operations_ledger`**: append-only, same conventions. Sign = effect on net operational revenue |
| Contribution amount | `contributions.amount_cents` = what was charged = what was credited | `amount_cents` is still the **donation principal**. New snapshot columns: `fee_rate_bps`, `operational_fee_cents`, `total_charged_cents` (generated), `fee_refunded_cents` |
| Refunds | `record_refund` booked whatever Stripe reported, even while "pending" | `refunds` audit table; reserve → Stripe → book **only when Stripe says succeeded** |
| Payment confirmation | `record_credit` trusted the contribution | also verifies the charged total equals the snapshot |
| Payouts to eateries | `settlements` + Stripe transfers from the pool | **Unchanged** |

The pool is a single-entry ledger, not double-entry, so the operations ledger follows the same style rather than
introducing a second accounting model.

### Money lifecycle

1. **Checkout** (`POST /api/donate/checkout`): the client sends only the intended donation (extra fields are rejected;
   an optional `expected_total_cents` is a consistency check, never trusted). The database function
   `create_contribution` reads the current rate, calculates the fee and stores the snapshot in one step. Stripe
   Checkout gets **two line items** (meal credits, operational fee), so Stripe's own receipt is itemized. Nothing is
   recognised yet.
2. **Payment confirmed** (verified webhook, `payment_status = paid`): `record_credit` checks Stripe's total equals the
   snapshot, then books `credit +principal` to `pool_ledger` and `fee_charge +fee` to `operations_ledger`.
   Created-but-unpaid, failed, expired or canceled sessions book nothing.
3. **Processing fee**: after crediting, the webhook looks up the Stripe balance transaction and books
   `processor_fee -fee` (best effort; **Admin → Finance → Backfill** fills any gaps).
4. **Refund** (admin only): see below.
5. **Dispute**: `charge.dispute.created/updated/closed` events, see below.

### Refund allocation

Allocation always uses the **original** snapshot (principal and fee as charged), never the current rate.

* **Full refund**: the donor gets the whole `total_charged`. Principal and fee are both reversed.
* **Partial refund**: split in proportion to the original payment: `fee share = round-half-up(amount × fee / total)`,
  principal = amount − fee share. Example: $4.20 of $8.40 → $4.00 principal + $0.20 fee.
* The refund that **exhausts what remains** takes exactly the remaining principal and remaining fee, so rounding
  remainders always land on the final refund and component totals can never exceed the originals
  (`allocate_refund_components`, mirrored by `allocateRefund`; both are tested against each other).
* Reservations (requested or pending refunds) and open disputes count against what remains, so concurrent requests
  cannot reserve the same money twice.
* No refund → nothing is reversed. A policy change cannot alter an old transaction: it has its own stored amounts.

Flow (`lib/refunds.ts`, `POST /api/admin/contributions/{id}/refund`):

1. `reserve_refund` (under the pool advisory lock + row lock) validates, allocates, and inserts a `refunds` row
   (`requested`). An `Idempotency-Key` header makes a repeated request return the same reservation.
2. Stripe refund is created with idempotency key `refund:<refund id>` and metadata `internal_refund_id`.
3. `mark_refund_submitted` stores the Stripe id (`pending`). If Stripe **rejects**, `mark_refund_failed` releases the
   reservation. If Stripe's answer is **unknown** (timeout, 5xx) the reservation is kept and the refund shows up on
   the Finance page; **Reconcile** re-submits with the same key (Stripe returns the original) or re-reads Stripe.
4. Only the verified webhook (or Reconcile) calling `record_refund(..., 'succeeded')` writes ledger entries:
   `refund -principal` to `pool_ledger`, `fee_refund -fee` to `operations_ledger`, updates the counters, and records
   any recovery obligation. `pending` only updates the audit row. `failed`/`canceled` after success writes linked
   **reversal entries**; completed entries are never edited or deleted (database triggers forbid it).
5. Refunds created in the Stripe dashboard arrive as webhook events and are allocated on arrival (`source = external`).

`refunds` records: original contribution, internal id, Stripe id, reason, total / principal / fee, currency, status,
idempotency reference, requester, request/completion/reversal timestamps, failure code and detail, recovery obligation.
Failure detail is readable only by the service role (admin pages), not by clients.

### Processor fees

Recorded separately as `processor_fee` (an expense). Stripe keeps its processing fee when a donor is refunded, so
refunds are **not reduced** and the fee is **not** assumed to come back. Net operational revenue =
fees retained − processor fees − dispute costs; gross fees are never presented as profit.

### Disputes (chargebacks)

`disputes` tracks them apart from voluntary refunds. On open, the disputed principal and fee are allocated and counted
as held (an open dispute blocks refunds). **Won**: released, only the dispute fee is a cost. **Lost**: booked like a
forced refund (`refund` entry tagged `kind: chargeback`, `fee_refund` entry) and reported under chargebacks. Dispute
fees are `dispute_fee` expenses, adjusted idempotently if Stripe's figure changes.

### Refund after the donation was already used or paid out

The pool may no longer hold the refunded principal (a student already ate; an eatery was paid). The app **does not
pretend to recover** it. It books the refund truthfully (the pool balance goes negative, which the app already reports
as a funding deficit) and records `recovery_obligation_cents` on the refund/dispute. **Outstanding recovery
obligations** is shown on Admin → Finance. Recovering money from an eatery is a manual business decision.

## Invariants, and what enforces them

| Invariant | Enforced by |
| --- | --- |
| Fee = rounded rate × principal; total = principal + fee | CHECK constraint + generated column |
| Snapshot (principal, rate, fee) never changes | trigger `contributions_snapshot_guard` |
| Ledgers are append-only, entries correctly signed | triggers on `pool_ledger`, `operations_ledger`, `fee_settings` |
| No duplicate bookings from retries/duplicate webhooks | unique `reference_key` per ledger entry; idempotent functions |
| Refund components sum to the refund; never exceed the originals | CHECKs on `refunds` and `contributions` + allocation under lock |
| Fee never counted as a donation | separate ledgers; pool credit = principal |
| Ledgers agree with the contribution snapshots | `finance_reconciliation()` (shown on Finance) |
| Only the server decides amounts | strict request schema; DB calculates; webhook compares Stripe's total to the snapshot |
| Money functions are not callable by clients | `REVOKE` from PUBLIC/anon/authenticated (asserted in tests) |

## Failure handling

| Situation | Behaviour |
| --- | --- |
| Checkout session creation fails | contribution marked `failed`, nothing recognised |
| Browser double-click / retry | `Idempotency-Key` returns the same contribution and reuses the open Stripe session |
| Fee changed while the page was open | server returns 409 with the new breakdown; nothing is charged |
| Stripe took the money, our DB write fails | webhook returns 500, Stripe retries; bookings are idempotent. **Backfill/Reconcile** cover long outages |
| Webhook delivered twice / out of order | idempotent keys; a refund event before its payment is rejected with `contribution_not_completed` and retried |
| Refund request, Stripe outcome unknown | reservation kept, visible on Finance, safe to reconcile (same idempotency key) |
| Stripe refund created but our id write fails | webhook finishes it using `internal_refund_id` metadata |
| Fee rate changed mid-payment | the contribution keeps the rate snapshotted at creation |

## Permissions

* Only the `admin` role can read or change the fee (`/api/admin/fee-settings`), refund, reconcile, or open Finance.
  Donors, students and eateries get 401/403 (covered by `lib/route-guards.test.ts` and `npm run test:permissions`).
* Fee changes apply to future checkouts only; back-dating is rejected; every change records who made it.
* `fee_settings`, `refunds`, `disputes`, `operations_ledger` have RLS on and no client policies.

## Decisions I made, and open business questions

1. **There is no per-school or per-charity selection in this app.** Donations go to one shared meal pool that pays
   eateries through settlements. "Amount allocated to the school or charity" is therefore the **principal credited to
   the pool**. If per-school allocation is added later, add it to the pool ledger, not the fee logic.
2. **Minimum donation stays $8** (one meal; `MEAL_VALUE_CENTS`) and must be whole dollars, so the $5.00 example is
   supported by the calculation but not offered at checkout. Changing that touches the meal-credit model.
3. **The platform bears Stripe's processing fee** out of operational revenue (the donor is charged principal + fee only).
4. **Rate changes are append-only and forward-looking**, effective immediately or at a future time.
5. **Disputes**: dispute fees are read from the `fee` of the dispute's balance transactions; confirm against a real
   (sandbox) dispute. A dispute for more than what remains is capped to what remains.
6. **Legal/tax review needed** (not decided in code): how an added "operational fee" is described to donors of a
   charity, whether any part is tax-deductible (the donor page says donations are not tax-deductible unless the
   operating organization is a registered nonprofit), state charitable-solicitation disclosure rules, and refund policy
   wording. The donor-facing text says the fee supports platform costs and does not go to the meal pool.
7. **Transaction history**: there is no donor account area in this app, so the itemized views are the emailed receipt
   (sent once per donation when `RESEND_API_KEY` is set and the donor gave an email; the address is read from the
   Stripe session and never stored), Stripe's own receipt, the donation confirmation page, and the admin
   contributions/Finance pages. A donor-facing history would need donor accounts first.
8. Stripe **sandbox**: processing fees in test mode are simulated and may not match live fees; recorded as returned.

## Rollout

1. **Apply migration 0012 before deploying this code.** New code calls functions that do not exist before it. (The
   reverse is safe: old code against the new database still works and simply charges no fee.)
2. Existing contributions keep fee 0 / rate 0: they really were charged exactly their principal. Old refunds are
   back-filled into the `refunds` table so they can still be reversed.
3. Deploy, then test with the Stripe CLI against a preview deployment: a checkout, a partial refund, a full refund, and
   `stripe trigger charge.dispute.created`.

## Testing

```bash
npm test                    # unit tests + real-SQL tests (PGlite = Postgres in WASM) for migrations 0001-0012
npm run build && npm run test:permissions   # role/route permission matrix against a mocked Supabase
npm run verify              # accounting.sql against a real database (needs DATABASE_URL)
```

`tests/db/operational-fee.test.ts` runs every migration and exercises the fee, refunds, disputes, ledgers and
privileges against actual PostgreSQL constraints and triggers. PGlite is single-connection, so "concurrent" tests prove
the allocation arithmetic and reservation accounting, not multi-connection lock timing; that guarantee comes from the
advisory lock + row lock in each function.
