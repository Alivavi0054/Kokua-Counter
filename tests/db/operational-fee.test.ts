import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { allocateRefund, calculateFeeBreakdown } from "@/lib/fees";
import { createMigratedDb } from "./harness";

// Real SQL, real constraints and triggers (PGlite = Postgres in WASM). Nothing here is mocked.
// Note: PGlite is a single connection, so "concurrent" attempts are serialised; the production
// guarantee is the pool advisory lock + row lock taken inside each function.

const ADMIN = "10000000-0000-4000-8000-000000000001";

let db: PGlite;
let counter = 0;

type Json = Record<string, unknown>;

async function rpc(sql: string, params: unknown[] = []): Promise<Json> {
  const result = await db.query<{ res: Json }>(`SELECT ${sql} AS res`, params);
  return result.rows[0].res;
}

async function rows<T = Json>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

async function one<T = Json>(sql: string, params: unknown[] = []): Promise<T> {
  return (await rows<T>(sql, params))[0];
}

async function createContribution(principal: number, requestKey: string | null = null) {
  const res = await rpc("public.create_contribution($1, $2, TRUE, $3)", [ADMIN, principal, requestKey]);
  expect(res.ok).toBe(true);
  return res as { contribution_id: string; principal_cents: number; operational_fee_cents: number; total_charged_cents: number; fee_rate_bps: number };
}

/** A contribution that Stripe confirmed as paid. */
async function paid(principal: number) {
  const c = await createContribution(principal);
  counter += 1;
  const session = `cs_test_${counter}`;
  const intent = `pi_test_${counter}`;
  await db.query("SELECT public.record_credit($1, $2, $3, $4)", [c.contribution_id, session, intent, c.total_charged_cents]);
  return { ...c, session, intent };
}

async function submitRefund(contributionId: string, amount: number | null, ref: string | null = null) {
  const reserved = await rpc("public.reserve_refund($1, $2, 'test', $3, $4)", [contributionId, amount, ADMIN, ref]);
  return reserved as { ok: boolean; error_code?: string; refund_id: string; amount_cents: number; principal_cents: number; fee_cents: number; replay?: boolean; status?: string };
}

async function completeRefund(contributionId: string, reserved: { refund_id: string; amount_cents: number }, stripeRefundId: string) {
  await db.query("SELECT public.mark_refund_submitted($1, $2)", [reserved.refund_id, stripeRefundId]);
  await db.query("SELECT public.record_refund($1, $2, $3, $4, 'succeeded')", [contributionId, stripeRefundId, reserved.amount_cents, reserved.refund_id]);
}

async function contribution(id: string) {
  return one<{ status: string; refunded_amount_cents: number; fee_refunded_cents: number; amount_cents: number; operational_fee_cents: number; total_charged_cents: number; fee_rate_bps: number }>(
    "SELECT status, refunded_amount_cents, fee_refunded_cents, amount_cents, operational_fee_cents, total_charged_cents, fee_rate_bps FROM public.contributions WHERE id = $1",
    [id],
  );
}

async function summary() {
  return (await rpc("public.finance_summary()")) as Record<string, number>;
}

async function reconciliation() {
  return (await rpc("public.finance_reconciliation()")) as { ok: boolean; issues: unknown[] };
}

beforeEach(async () => {
  db = await createMigratedDb();
  counter = 0;
}, 60_000);

describe("fee calculation and snapshot", () => {
  it("adds a 5% fee on top by default and snapshots rate, fee and total", async () => {
    for (const [principal, fee, total] of [[500, 25, 525], [800, 40, 840], [1000, 50, 1050], [2000, 100, 2100], [10000, 500, 10500]]) {
      const c = await createContribution(principal);
      expect(c).toMatchObject({ principal_cents: principal, operational_fee_cents: fee, total_charged_cents: total, fee_rate_bps: 500 });
      const stored = await contribution(c.contribution_id);
      expect(stored).toMatchObject({ amount_cents: principal, operational_fee_cents: fee, total_charged_cents: total, fee_rate_bps: 500, status: "pending" });
    }
  });

  it("SQL and TypeScript agree on the fee for a sweep of amounts and rates", async () => {
    for (const rate of [0, 125, 500, 999, 2000]) {
      for (let cents = 1; cents <= 3000; cents += 37) {
        const sql = await one<{ fee: number }>("SELECT public.calculate_operational_fee($1, $2) AS fee", [cents, rate]);
        expect(sql.fee).toBe(calculateFeeBreakdown(cents, rate).operationalFeeCents);
      }
    }
  });

  it("SQL and TypeScript agree on refund allocation", async () => {
    const cases = [
      [800, 40, 0, 0, 420], [800, 40, 0, 0, 840], [800, 40, 267, 13, 280], [800, 40, 534, 26, 280], [1000, 50, 100, 5, 333], [800, 0, 0, 0, 300],
    ];
    for (const [p, f, pu, fu, amount] of cases) {
      const sql = await one<{ principal_cents: string; fee_cents: string }>(
        "SELECT * FROM public.allocate_refund_components($1, $2, $3, $4, $5)", [p, f, pu, fu, amount],
      );
      const ts = allocateRefund({ principalCents: p, feeCents: f, principalAlreadyAllocatedCents: pu, feeAlreadyAllocatedCents: fu, amountCents: amount });
      expect({ principalCents: Number(sql.principal_cents), feeCents: Number(sql.fee_cents) }).toEqual(ts);
    }
  });

  it("a rate change applies only to future checkouts; historical snapshots and reports are unchanged", async () => {
    const before = await paid(800);
    const reportBefore = await summary();

    const change = await rpc("public.set_operational_fee_rate($1, NULL, $2, 'test raise')", [1000, ADMIN]);
    expect(change.ok).toBe(true);

    const after = await createContribution(800);
    expect(after).toMatchObject({ fee_rate_bps: 1000, operational_fee_cents: 80, total_charged_cents: 880 });

    expect(await contribution(before.contribution_id)).toMatchObject({ fee_rate_bps: 500, operational_fee_cents: 40, total_charged_cents: 840 });
    // Everything recognised (credited, refunded, fees, expenses) is unchanged. Only the not-yet-paid
    // pending counters move, because a new checkout was started.
    const withoutPending = (report: Record<string, number>) =>
      Object.fromEntries(Object.entries(report).filter(([key]) => !key.startsWith("pending_contributions")));
    expect(withoutPending(await summary())).toEqual(withoutPending(reportBefore));

    // a refund of the old payment still allocates against its original $0.40 fee
    const refund = await submitRefund(before.contribution_id, 420);
    expect(refund).toMatchObject({ ok: true, principal_cents: 400, fee_cents: 20 });
  });

  it("rejects invalid configuration, back-dating and edits to history", async () => {
    for (const bad of [-1, 2001]) {
      expect((await rpc("public.set_operational_fee_rate($1, NULL, $2, NULL)", [bad, ADMIN])).error_code).toBe("invalid_rate");
    }
    const past = await rpc("public.set_operational_fee_rate(500, now() - interval '1 day', $1, NULL)", [ADMIN]);
    expect(past.error_code).toBe("effective_in_past");
    await expect(db.query("INSERT INTO public.fee_settings (rate_bps) VALUES (2001)")).rejects.toThrow();
    await expect(db.query("UPDATE public.fee_settings SET rate_bps = 0")).rejects.toThrow(/append-only/);
    await expect(db.query("DELETE FROM public.fee_settings")).rejects.toThrow(/append-only/);
  });

  it("a future-dated rate does not apply until its effective time", async () => {
    await rpc("public.set_operational_fee_rate(1500, now() + interval '1 day', $1, NULL)", [ADMIN]);
    expect((await createContribution(800)).fee_rate_bps).toBe(500);
    const later = await one<{ rate: number }>("SELECT public.current_fee_rate_bps(now() + interval '2 days') AS rate");
    expect(later.rate).toBe(1500);
  });

  it("amount, rate and fee on a contribution cannot be changed afterwards", async () => {
    const c = await createContribution(800);
    await expect(db.query("UPDATE public.contributions SET operational_fee_cents = 0 WHERE id = $1", [c.contribution_id])).rejects.toThrow(/immutable/);
    await expect(db.query("UPDATE public.contributions SET amount_cents = 100 WHERE id = $1", [c.contribution_id])).rejects.toThrow(/immutable/);
    await expect(db.query("UPDATE public.contributions SET fee_rate_bps = 0 WHERE id = $1", [c.contribution_id])).rejects.toThrow(/immutable/);
  });

  it("the stored fee must match the stored rate (constraint)", async () => {
    await expect(
      db.query("INSERT INTO public.contributions (amount_cents, fee_rate_bps, operational_fee_cents) VALUES (800, 500, 41)"),
    ).rejects.toThrow();
  });
});

describe("payment confirmation", () => {
  it("pending and failed payments create no revenue or pool entries", async () => {
    const c = await createContribution(800);
    expect((await summary()).principal_credited_cents).toBe(0);
    expect((await summary()).fees_charged_cents).toBe(0);
    expect((await summary()).pending_contributions_total_cents).toBe(840);
    await db.query("UPDATE public.contributions SET status = 'failed', failure_reason = 'checkout_expired' WHERE id = $1", [c.contribution_id]);
    expect((await summary()).pending_contributions_count).toBe(0);
    expect(await rows("SELECT 1 FROM public.pool_ledger")).toHaveLength(0);
    expect(await rows("SELECT 1 FROM public.operations_ledger")).toHaveLength(0);
  });

  it("books the principal to the pool and the fee to operations, separately", async () => {
    const p = await paid(800);
    expect(await one("SELECT amount_cents::int AS n FROM public.pool_ledger WHERE entry_type = 'credit'")).toEqual({ n: 800 });
    expect(await one("SELECT amount_cents::int AS n FROM public.operations_ledger WHERE entry_type = 'fee_charge'")).toEqual({ n: 40 });
    const s = await summary();
    expect(s).toMatchObject({ principal_credited_cents: 800, fees_charged_cents: 40, net_fees_retained_cents: 40, pool_balance_cents: 800 });
    expect((await contribution(p.contribution_id)).status).toBe("completed");
    expect(await reconciliation()).toEqual({ ok: true, issues: [] });
  });

  it("a fee is never counted as a donation: pool balance excludes it", async () => {
    await paid(800);
    const balance = await one<{ b: string }>("SELECT public.get_pool_balance() AS b");
    expect(Number(balance.b)).toBe(800);
  });

  it("rejects confirmation for the wrong charged amount (no donation recognised)", async () => {
    const c = await createContribution(800);
    await expect(db.query("SELECT public.record_credit($1, 'cs_x', 'pi_x', 800)", [c.contribution_id])).rejects.toThrow(/charged_amount_mismatch/);
    expect((await contribution(c.contribution_id)).status).toBe("pending");
    expect(await rows("SELECT 1 FROM public.pool_ledger")).toHaveLength(0);
  });

  it("repeated webhooks create no duplicate ledger entries", async () => {
    const p = await paid(800);
    for (let i = 0; i < 3; i += 1) {
      await db.query("SELECT public.record_credit($1, $2, $3, $4)", [p.contribution_id, p.session, p.intent, 840]);
    }
    expect(await rows("SELECT 1 FROM public.pool_ledger WHERE entry_type = 'credit'")).toHaveLength(1);
    expect(await rows("SELECT 1 FROM public.operations_ledger WHERE entry_type = 'fee_charge'")).toHaveLength(1);
    expect(await reconciliation()).toEqual({ ok: true, issues: [] });
  });

  it("a duplicate checkout request key returns the same contribution instead of a second charge", async () => {
    const first = await createContribution(800, "req-123");
    const second = await rpc("public.create_contribution($1, 800, TRUE, 'req-123')", [ADMIN]);
    expect(second).toMatchObject({ ok: true, replay: true, contribution_id: first.contribution_id });
    expect(await rows("SELECT 1 FROM public.contributions")).toHaveLength(1);
    const reused = await rpc("public.create_contribution($1, 1600, TRUE, 'req-123')", [ADMIN]);
    expect(reused.error_code).toBe("request_key_reused");
  });

  it("an out-of-order refund event (before the payment event) is rejected so it can be retried", async () => {
    const c = await createContribution(800);
    await expect(db.query("SELECT public.record_refund($1, 're_early', 840, NULL, 'succeeded')", [c.contribution_id])).rejects.toThrow(/contribution_not_completed/);
    await expect(db.query("SELECT public.record_processor_fee($1, 'pi_none', 55, 'txn_1')", [c.contribution_id])).rejects.toThrow(/contribution_not_completed/);
  });
});

describe("refund allocation and accounting", () => {
  it("full refund returns the entire charge and reverses both components", async () => {
    const p = await paid(800);
    const r = await submitRefund(p.contribution_id, null);
    expect(r).toMatchObject({ ok: true, amount_cents: 840, principal_cents: 800, fee_cents: 40, status: "requested" });
    await completeRefund(p.contribution_id, r, "re_full");

    expect(await contribution(p.contribution_id)).toMatchObject({ status: "refunded", refunded_amount_cents: 800, fee_refunded_cents: 40 });
    const s = await summary();
    expect(s).toMatchObject({ principal_refunded_cents: 800, fees_refunded_cents: 40, net_principal_cents: 0, net_fees_retained_cents: 0, pool_balance_cents: 0 });
    const row = await one("SELECT status, amount_cents, principal_cents, fee_cents, stripe_refund_id, reason, currency FROM public.refunds WHERE id = $1", [r.refund_id]);
    expect(row).toMatchObject({ status: "succeeded", amount_cents: 840, principal_cents: 800, fee_cents: 40, stripe_refund_id: "re_full", currency: "usd" });
    expect(await reconciliation()).toEqual({ ok: true, issues: [] });
  });

  it("partial refund of $4.20 reverses $4.00 principal and $0.20 fee", async () => {
    const p = await paid(800);
    const r = await submitRefund(p.contribution_id, 420);
    expect(r).toMatchObject({ ok: true, principal_cents: 400, fee_cents: 20 });
    await completeRefund(p.contribution_id, r, "re_part");
    expect(await contribution(p.contribution_id)).toMatchObject({ status: "completed", refunded_amount_cents: 400, fee_refunded_cents: 20 });
    expect(await summary()).toMatchObject({ principal_refunded_cents: 400, fees_refunded_cents: 20, net_fees_retained_cents: 20 });
  });

  it("multiple partial refunds allocate deterministically and the last one takes the rounding remainder", async () => {
    const p = await paid(800);
    const issued = [];
    for (const [i, amount] of [280, 280, 280].entries()) {
      const r = await submitRefund(p.contribution_id, amount);
      issued.push([r.principal_cents, r.fee_cents]);
      await completeRefund(p.contribution_id, r, `re_multi_${i}`);
    }
    expect(issued).toEqual([[267, 13], [267, 13], [266, 14]]);
    expect(await contribution(p.contribution_id)).toMatchObject({ status: "refunded", refunded_amount_cents: 800, fee_refunded_cents: 40 });
    expect(await reconciliation()).toEqual({ ok: true, issues: [] });
  });

  it("never refunds more than what remains, counting reservations", async () => {
    const p = await paid(800);
    const first = await submitRefund(p.contribution_id, 840 - 100);
    expect(first.ok).toBe(true);
    // 100 cents remain unreserved; asking for 101 must fail even though nothing completed yet
    const over = await submitRefund(p.contribution_id, 101);
    expect(over).toMatchObject({ ok: false, error_code: "exceeds_remaining" });
    expect((await submitRefund(p.contribution_id, 100)).ok).toBe(true);
    expect((await submitRefund(p.contribution_id, 1)).error_code).toBe("nothing_to_refund");
  });

  it("concurrent refund attempts cannot reserve the same money twice", async () => {
    const p = await paid(800);
    const results = await Promise.all([submitRefund(p.contribution_id, null), submitRefund(p.contribution_id, null), submitRefund(p.contribution_id, null)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => r.error_code === "nothing_to_refund")).toBe(true);
  });

  it("a repeated request with the same idempotency reference replays the original refund", async () => {
    const p = await paid(800);
    const first = await submitRefund(p.contribution_id, 420, "click-1");
    const second = await submitRefund(p.contribution_id, 420, "click-1");
    expect(second).toMatchObject({ ok: true, replay: true, refund_id: first.refund_id });
    expect(await rows("SELECT 1 FROM public.refunds")).toHaveLength(1);
    const mismatched = await submitRefund(p.contribution_id, 100, "click-1");
    expect(mismatched.error_code).toBe("idempotency_key_reused");
  });

  it("requested and pending refunds are not booked; only a succeeded refund hits the ledgers", async () => {
    const p = await paid(800);
    const r = await submitRefund(p.contribution_id, null);
    expect(await rows("SELECT 1 FROM public.pool_ledger WHERE entry_type = 'refund'")).toHaveLength(0);

    await db.query("SELECT public.mark_refund_submitted($1, 're_pend')", [r.refund_id]);
    expect((await one<{ status: string }>("SELECT status FROM public.refunds WHERE id = $1", [r.refund_id])).status).toBe("pending");
    await db.query("SELECT public.record_refund($1, 're_pend', 840, $2, 'pending')", [p.contribution_id, r.refund_id]);
    expect(await rows("SELECT 1 FROM public.pool_ledger WHERE entry_type = 'refund'")).toHaveLength(0);
    expect(await rows("SELECT 1 FROM public.operations_ledger WHERE entry_type = 'fee_refund'")).toHaveLength(0);
    expect((await contribution(p.contribution_id)).refunded_amount_cents).toBe(0);
    expect((await summary())).toMatchObject({ refunds_pending_count: 1, net_fees_retained_cents: 40 });

    await db.query("SELECT public.record_refund($1, 're_pend', 840, $2, 'succeeded')", [p.contribution_id, r.refund_id]);
    expect(await rows("SELECT 1 FROM public.pool_ledger WHERE entry_type = 'refund'")).toHaveLength(1);
  });

  it("a failed refund releases its reservation and books nothing", async () => {
    const p = await paid(800);
    const r = await submitRefund(p.contribution_id, null);
    await db.query("SELECT public.mark_refund_failed($1, 'stripe_rejected', 'card closed')", [r.refund_id]);
    expect(await rows("SELECT 1 FROM public.pool_ledger WHERE entry_type = 'refund'")).toHaveLength(0);
    const row = await one("SELECT status, failure_code FROM public.refunds WHERE id = $1", [r.refund_id]);
    expect(row).toMatchObject({ status: "failed", failure_code: "stripe_rejected" });
    expect((await submitRefund(p.contribution_id, null)).ok).toBe(true);
  });

  it("duplicate provider webhooks for the same refund book it once", async () => {
    const p = await paid(800);
    const r = await submitRefund(p.contribution_id, 420);
    await completeRefund(p.contribution_id, r, "re_dup");
    for (let i = 0; i < 3; i += 1) {
      await db.query("SELECT public.record_refund($1, 're_dup', 420, $2, 'succeeded')", [p.contribution_id, r.refund_id]);
    }
    expect(await rows("SELECT 1 FROM public.pool_ledger WHERE entry_type = 'refund'")).toHaveLength(1);
    expect(await rows("SELECT 1 FROM public.operations_ledger WHERE entry_type = 'fee_refund'")).toHaveLength(1);
    expect((await contribution(p.contribution_id)).refunded_amount_cents).toBe(400);
  });

  it("the webhook can finish a refund before the admin request records the Stripe id", async () => {
    const p = await paid(800);
    const r = await submitRefund(p.contribution_id, null);
    // webhook arrives with the internal id from refund metadata, before mark_refund_submitted ran
    await db.query("SELECT public.record_refund($1, 're_fast', 840, $2, 'succeeded')", [p.contribution_id, r.refund_id]);
    await db.query("SELECT public.mark_refund_submitted($1, 're_fast')", [r.refund_id]);
    const row = await one("SELECT status, stripe_refund_id FROM public.refunds WHERE id = $1", [r.refund_id]);
    expect(row).toMatchObject({ status: "succeeded", stripe_refund_id: "re_fast" });
    expect(await rows("SELECT 1 FROM public.pool_ledger WHERE entry_type = 'refund'")).toHaveLength(1);
  });

  it("a refund created in the Stripe dashboard is allocated proportionally when its event arrives", async () => {
    const p = await paid(800);
    await db.query("SELECT public.record_refund($1, 're_dash', 420, NULL, 'succeeded')", [p.contribution_id]);
    const row = await one("SELECT source, principal_cents, fee_cents, status FROM public.refunds WHERE stripe_refund_id = 're_dash'");
    expect(row).toMatchObject({ source: "external", principal_cents: 400, fee_cents: 20, status: "succeeded" });
  });

  it("rejects a provider refund bigger than what is left", async () => {
    const p = await paid(800);
    await expect(db.query("SELECT public.record_refund($1, 're_big', 841, NULL, 'succeeded')", [p.contribution_id])).rejects.toThrow(/refund_exceeds_unrefunded_amount/);
  });

  it("a refund the provider later reverses is undone with linked reversal entries, not edits", async () => {
    const p = await paid(800);
    const r = await submitRefund(p.contribution_id, null);
    await completeRefund(p.contribution_id, r, "re_rev");
    await db.query("SELECT public.record_refund_reversal('re_rev')");
    await db.query("SELECT public.record_refund_reversal('re_rev')");

    expect(await contribution(p.contribution_id)).toMatchObject({ status: "completed", refunded_amount_cents: 0, fee_refunded_cents: 0 });
    expect(await rows("SELECT 1 FROM public.pool_ledger WHERE entry_type = 'refund_reversal'")).toHaveLength(1);
    expect(await rows("SELECT 1 FROM public.operations_ledger WHERE entry_type = 'fee_refund_reversal'")).toHaveLength(1);
    expect(await rows("SELECT 1 FROM public.pool_ledger WHERE entry_type = 'refund'")).toHaveLength(1); // original kept
    expect(await summary()).toMatchObject({ principal_refunded_cents: 0, fees_refunded_cents: 0, net_fees_retained_cents: 40 });
    expect(await reconciliation()).toEqual({ ok: true, issues: [] });
  });

  it("a refund that fails while only pending is released without ledger entries", async () => {
    const p = await paid(800);
    const r = await submitRefund(p.contribution_id, null);
    await db.query("SELECT public.mark_refund_submitted($1, 're_fail')", [r.refund_id]);
    await db.query("SELECT public.record_refund_reversal('re_fail')");
    expect((await one<{ status: string }>("SELECT status FROM public.refunds WHERE id = $1", [r.refund_id])).status).toBe("failed");
    expect(await rows("SELECT 1 FROM public.pool_ledger WHERE entry_type IN ('refund', 'refund_reversal')")).toHaveLength(0);
  });

  it("refund after the pool money was already used records a recovery obligation, not a silent negative", async () => {
    const p = await paid(800);
    // the $8.00 was used for a meal: simulate the redemption's pool entry
    await db.query("INSERT INTO public.pool_ledger (entry_type, amount_cents, metadata) VALUES ('redemption', -800, '{\"test\":true}')");
    const r = await submitRefund(p.contribution_id, null);
    await completeRefund(p.contribution_id, r, "re_after_payout");

    const row = await one<{ recovery_obligation_cents: number }>("SELECT recovery_obligation_cents FROM public.refunds WHERE id = $1", [r.refund_id]);
    expect(row.recovery_obligation_cents).toBe(800);
    const s = await summary();
    expect(s.outstanding_recovery_cents).toBe(800);
    expect(s.pool_balance_cents).toBe(-800); // reported honestly as a deficit, never hidden
    expect(s.net_fees_retained_cents).toBe(0);
  });

  it("processor fees are tracked apart from the operational fee and are retained after a full refund", async () => {
    const p = await paid(800);
    await db.query("SELECT public.record_processor_fee($1, $2, 55, 'txn_1')", [p.contribution_id, p.intent]);
    await db.query("SELECT public.record_processor_fee($1, $2, 55, 'txn_1')", [p.contribution_id, p.intent]); // duplicate
    const r = await submitRefund(p.contribution_id, null);
    expect(r.amount_cents).toBe(840); // the donor gets everything back; no processor fee is deducted
    await completeRefund(p.contribution_id, r, "re_proc");

    const s = await summary();
    expect(s).toMatchObject({
      fees_charged_cents: 40,
      fees_refunded_cents: 40,
      net_fees_retained_cents: 0,
      processor_fees_cents: 55,
      net_operational_revenue_cents: -55,
    });
    expect(await rows("SELECT 1 FROM public.operations_ledger WHERE entry_type = 'processor_fee'")).toHaveLength(1);
  });

  it("net operational revenue is fees retained minus recorded expenses", async () => {
    const a = await paid(800);
    const b = await paid(2000);
    await db.query("SELECT public.record_processor_fee($1, $2, 55, NULL)", [a.contribution_id, a.intent]);
    await db.query("SELECT public.record_processor_fee($1, $2, 91, NULL)", [b.contribution_id, b.intent]);
    const r = await submitRefund(b.contribution_id, 1050);
    await completeRefund(b.contribution_id, r, "re_half");
    // fees charged 40+100, refunded 50, processor 146
    expect(await summary()).toMatchObject({
      fees_charged_cents: 140,
      fees_refunded_cents: 50,
      net_fees_retained_cents: 90,
      processor_fees_cents: 146,
      net_operational_revenue_cents: 90 - 146,
    });
  });
});

describe("disputes and chargebacks", () => {
  it("an open dispute blocks refunds and is reported separately; a lost one books principal and fee reversals", async () => {
    const p = await paid(800);
    await db.query("SELECT public.record_dispute_opened($1, 'dp_1', 840, 'fraudulent', 'needs_response', 1500)", [p.contribution_id]);
    await db.query("SELECT public.record_dispute_opened($1, 'dp_1', 840, 'fraudulent', 'needs_response', 1500)", [p.contribution_id]); // replay

    expect((await submitRefund(p.contribution_id, null)).error_code).toBe("disputed");
    let s = await summary();
    expect(s).toMatchObject({ disputes_open_count: 1, disputes_open_principal_cents: 800, disputes_open_fee_cents: 40, dispute_fees_cents: 1500, principal_refunded_cents: 0 });

    await db.query("SELECT public.record_dispute_closed('dp_1', 'lost', 1500)");
    await db.query("SELECT public.record_dispute_closed('dp_1', 'lost', 1500)"); // replay
    s = await summary();
    expect(s).toMatchObject({
      disputes_open_count: 0,
      principal_refunded_cents: 800,
      chargeback_principal_cents: 800,
      fees_refunded_cents: 40,
      dispute_fees_cents: 1500,
      net_operational_revenue_cents: 0 - 1500,
    });
    expect(await contribution(p.contribution_id)).toMatchObject({ status: "refunded" });
    expect(await rows("SELECT 1 FROM public.pool_ledger WHERE reference_key = 'stripe-dispute-loss:dp_1'")).toHaveLength(1);
    expect(await reconciliation()).toEqual({ ok: true, issues: [] });
  });

  it("a won dispute releases the hold and books nothing but the cost", async () => {
    const p = await paid(800);
    await db.query("SELECT public.record_dispute_opened($1, 'dp_2', 840, 'general', 'needs_response', 1500)", [p.contribution_id]);
    await db.query("SELECT public.record_dispute_closed('dp_2', 'won', 0)");
    expect(await contribution(p.contribution_id)).toMatchObject({ status: "completed", refunded_amount_cents: 0 });
    expect(await summary()).toMatchObject({ disputes_open_count: 0, principal_refunded_cents: 0, dispute_fees_cents: 0 });
    expect((await submitRefund(p.contribution_id, 100)).ok).toBe(true);
  });

  it("a chargeback after a partial refund is capped to what remains", async () => {
    const p = await paid(800);
    const r = await submitRefund(p.contribution_id, 420);
    await completeRefund(p.contribution_id, r, "re_before_dispute");
    await db.query("SELECT public.record_dispute_opened($1, 'dp_3', 840, 'fraudulent', 'needs_response', 0)", [p.contribution_id]);
    const d = await one("SELECT principal_cents, fee_cents FROM public.disputes WHERE stripe_dispute_id = 'dp_3'");
    expect(d).toMatchObject({ principal_cents: 400, fee_cents: 20 });
    await db.query("SELECT public.record_dispute_closed('dp_3', 'lost', 0)");
    expect(await contribution(p.contribution_id)).toMatchObject({ status: "refunded", refunded_amount_cents: 800, fee_refunded_cents: 40 });
  });
});

describe("ledger invariants, privileges and reconciliation", () => {
  it("both ledgers are append-only and enforce entry signs", async () => {
    const p = await paid(800);
    await expect(db.query("UPDATE public.operations_ledger SET amount_cents = 1")).rejects.toThrow(/append-only/);
    await expect(db.query("DELETE FROM public.operations_ledger")).rejects.toThrow(/append-only/);
    await expect(db.query("UPDATE public.pool_ledger SET amount_cents = 1")).rejects.toThrow(/append-only/);
    await expect(
      db.query("INSERT INTO public.operations_ledger (entry_type, amount_cents, contribution_id) VALUES ('fee_charge', -5, $1)", [p.contribution_id]),
    ).rejects.toThrow(/must be positive/);
    await expect(
      db.query("INSERT INTO public.operations_ledger (entry_type, amount_cents, contribution_id) VALUES ('processor_fee', 5, $1)", [p.contribution_id]),
    ).rejects.toThrow(/must be negative/);
  });

  it("refund components must sum to the refund and stay within the original amounts", async () => {
    const p = await paid(800);
    await expect(
      db.query("INSERT INTO public.refunds (contribution_id, amount_cents, principal_cents, fee_cents) VALUES ($1, 840, 700, 40)", [p.contribution_id]),
    ).rejects.toThrow();
    await expect(
      db.query("UPDATE public.contributions SET fee_refunded_cents = 41 WHERE id = $1", [p.contribution_id]),
    ).rejects.toThrow();
    await expect(
      db.query("UPDATE public.contributions SET refunded_amount_cents = 801 WHERE id = $1", [p.contribution_id]),
    ).rejects.toThrow();
  });

  it("reconciliation detects a ledger/snapshot mismatch", async () => {
    const p = await paid(800);
    await db.query("UPDATE public.contributions SET refunded_amount_cents = 100 WHERE id = $1", [p.contribution_id]);
    const result = await reconciliation();
    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ check: "principal_refunded", contribution_id: p.contribution_id });
  });

  it("clients (anon/authenticated) cannot call money functions or read the new tables", async () => {
    const checks: Array<[string, string]> = [
      ["public.reserve_refund(uuid,bigint,text,uuid,text)", "execute"],
      ["public.record_refund(uuid,text,bigint,uuid,text)", "execute"],
      ["public.record_credit(uuid,text,text,bigint)", "execute"],
      ["public.create_contribution(uuid,integer,boolean,text)", "execute"],
      ["public.set_operational_fee_rate(integer,timestamptz,uuid,text)", "execute"],
      ["public.finance_summary()", "execute"],
      ["public.record_dispute_closed(text,text,integer)", "execute"],
    ];
    for (const role of ["anon", "authenticated"]) {
      for (const [fn, privilege] of checks) {
        const r = await one<{ ok: boolean }>("SELECT has_function_privilege($1, $2, $3) AS ok", [role, fn, privilege]);
        expect(r.ok, `${role} must not ${privilege} ${fn}`).toBe(false);
      }
      for (const table of ["operations_ledger", "refunds", "disputes", "fee_settings"]) {
        const r = await one<{ ok: boolean }>("SELECT has_table_privilege($1, $2, 'SELECT') AS ok", [role, `public.${table}`]);
        expect(r.ok, `${role} must not read ${table}`).toBe(false);
      }
    }
    const svc = await one<{ ok: boolean }>("SELECT has_function_privilege('service_role', 'public.reserve_refund(uuid,bigint,text,uuid,text)', 'execute') AS ok");
    expect(svc.ok).toBe(true);
  });

  it("the migration's seeded default rate matches the application default", async () => {
    const seeded = await one<{ rate: number }>("SELECT public.current_fee_rate_bps(now()) AS rate");
    const { DEFAULT_OPERATIONAL_FEE_BPS } = await import("@/lib/public-constants");
    expect(seeded.rate).toBe(DEFAULT_OPERATIONAL_FEE_BPS);
  });
});
