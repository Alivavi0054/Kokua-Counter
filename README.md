
# Kōkua Counter

Kōkua Counter is a suspended-meal app. Donors contribute funds to a shared pool; verified University of Hawaiʻi students can redeem one $8 meal at an active participating eatery with a single-use QR pass. The pool is an append-only ledger, not a stored balance.

## Local Setup

Prerequisites: Node.js 20+, Docker, the Supabase CLI, the Stripe CLI, and `psql`.

```sh
npm install
cp .env.example .env.local
npx supabase start
npx supabase status
npx supabase db reset
```

Copy the local API URL, anon key, and service-role key from `supabase status` into `.env.local`. Set `NEXT_PUBLIC_APP_URL` to `http://localhost:3000`. Set `CRON_SECRET` to a private random value, for example `openssl rand -hex 32`. Keep `.env.local` private.

The reset command applies migrations and seeds local Auth accounts plus one active eatery. It does not add contributions, ledger entries, QR codes, or redemptions. Student magic-link messages appear in the local Supabase Inbucket at `http://127.0.0.1:54324`.

## Stripe

Use Stripe test-mode keys for `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Start the local forwarder:

```sh
stripe login
stripe listen --forward-to localhost:3000/api/donate/webhook
```

Copy the `whsec_...` value printed by `stripe listen` to `STRIPE_WEBHOOK_SECRET`, then restart Next.js. The checkout route creates a pending contribution and Stripe Checkout Session; only a verified webhook writes a credit or refund to the pool. The success page does not mark a payment complete.

## Run

```sh
npm run dev
```

Open `http://localhost:3000`. The meal value is fixed at 800 cents; startup environment validation rejects any other `MEAL_VALUE_CENTS` value.

## Accounting Test

After `npx supabase db reset`, run the rollback-only SQL lifecycle test against the local database:

```sh
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/accounting.sql
```

It raises an exception on a wrong balance and rolls back all test data. Re-run it only against a disposable local database. For webhook idempotency, deliver the same signed Stripe refund event twice and confirm there is still one ledger row for its `stripe-refund:<refund_id>` reference key.

## Cron

Schedule this authenticated GET once per minute (or call it manually) to expire stale passes and release their holds:

```sh
curl --fail-with-body \
  -H "Authorization: Bearer $CRON_SECRET" \
  "$NEXT_PUBLIC_APP_URL/api/cron/expire-qrs"
```

## Local Test Accounts

These seeded credentials are for a disposable local database only. Change them anywhere outside local development.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@example.com` | `KokuaAdmin123!` |
| Student | `student@hawaii.edu` | `KokuaStudent123!` |
| Eatery | `eatery@example.com` | `KokuaEatery123!` |

The student account can also use the local magic-link flow. Eatery and admin accounts use password sign-in.

## Decisions

- A QR pass expires 15 minutes after server-side creation. The database rejects an expiry outside that window.
- The raw QR token is returned once and kept only in the current browser page state. It is never recoverable from the database; if that response or page is lost, the student must wait for the held pass to expire before requesting another.
- The requested lifecycle statement “$24 + one meal + full $24 refund = −$16” is inconsistent with the $8 meal value. The ledger arithmetic is $24 − $8 − $24 = **−$8**, which is what the SQL test asserts.
- A student is identified by an exact `@hawaii.edu` email. New student profiles are created on the first successful magic-link callback.
- One eatery account is expected to own one eatery for the MVP; eatery management is not included.

## Known Limitations

- Rate limiting is in-memory and per application process. It resets on restart and is not shared across multiple instances; production deployment needs a shared limiter.
- QR expiration depends on the scheduled cron request. An expired QR cannot be redeemed even before cron runs, but its hold is returned when an expiry routine runs.
- Closing or refreshing the browser after generating a pass loses the one-time raw token. The hold safely returns at expiry.
- The settlements table is schema-only. Stripe Connect, payouts, counselor voucher batches, anomaly monitoring, and eatery management are out of scope.
- Camera scanning requires camera permission and a secure browser context (HTTPS, except localhost).

## Manual Verification

After setup, verify the SQL accounting test, replay one identical Stripe refund webhook and confirm a single refund ledger entry, then open the same active student QR in two eatery scanner tabs and submit it concurrently. Exactly one redemption should succeed. Also verify the cron endpoint rejects a missing or incorrect secret.
