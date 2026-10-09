import { describe, expect, it, vi } from "vitest";
import { runFinanceHealthCheck, type FinanceHealthDeps } from "@/lib/finance-health";
import type { RefundRow } from "@/lib/refund-reconcile";

const refund = (overrides: Partial<RefundRow> = {}): RefundRow => ({
  id: "r1", contribution_id: "c1", status: "pending", amount_cents: 840, principal_cents: 800, fee_cents: 40, stripe_refund_id: "re_1", ...overrides,
});

function setup(overrides: Partial<FinanceHealthDeps> = {}) {
  const reconcileRefundDeps = {
    getPaymentIntentId: vi.fn().mockResolvedValue("pi_1"),
    retrieveStripeRefund: vi.fn().mockResolvedValue({ id: "re_1", status: "succeeded" }),
    applyProviderRefund: vi.fn().mockResolvedValue(undefined),
    refundDeps: {
      reserveRefund: vi.fn(),
      markRefundSubmitted: vi.fn().mockResolvedValue(undefined),
      markRefundFailed: vi.fn().mockResolvedValue(undefined),
      stripe: { refunds: { create: vi.fn().mockResolvedValue({ id: "re_new", status: "pending" }) } },
    },
  };
  const deps = {
    listStuckRefunds: vi.fn().mockResolvedValue([]),
    listStuckSettlements: vi.fn().mockResolvedValue([]),
    reconcile: reconcileRefundDeps,
    getReconciliation: vi.fn().mockResolvedValue({ ok: true, issues: [] }),
    backfillProcessorFees: vi.fn().mockResolvedValue({ checked: 0, recorded: 0, unavailable: 0 }),
    sendAlert: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
    ...overrides,
  };
  return { deps: deps as unknown as FinanceHealthDeps, raw: deps, reconcileRefundDeps };
}

describe("runFinanceHealthCheck", () => {
  it("is quiet and sends no alert when everything is fine", async () => {
    const { deps, raw } = setup();
    const report = await runFinanceHealthCheck(deps);
    expect(report.alerts).toEqual([]);
    expect(raw.sendAlert).not.toHaveBeenCalled();
    expect(report.processor_fees).toEqual({ checked: 0, recorded: 0, unavailable: 0 });
  });

  it("syncs stuck refunds with Stripe and re-submits ones Stripe never saw", async () => {
    const { deps, raw, reconcileRefundDeps } = setup({
      listStuckRefunds: vi.fn().mockResolvedValue([refund(), refund({ id: "r2", status: "requested", stripe_refund_id: null })]),
    });
    const report = await runFinanceHealthCheck(deps);
    expect(report.refunds).toMatchObject({ examined: 2, synced: 1, resubmitted: 1, unresolved: 0, errors: 0 });
    expect(reconcileRefundDeps.applyProviderRefund).toHaveBeenCalledTimes(1);
    expect(reconcileRefundDeps.refundDeps.stripe.refunds.create).toHaveBeenCalledWith(expect.anything(), { idempotencyKey: "refund:r2" });
    expect(raw.sendAlert).not.toHaveBeenCalled();
  });

  it("alerts on refunds that cannot be resolved, and keeps going after one throws", async () => {
    const { deps, raw, reconcileRefundDeps } = setup({
      listStuckRefunds: vi.fn().mockResolvedValue([refund({ id: "bad" }), refund({ id: "ok" })]),
    });
    reconcileRefundDeps.retrieveStripeRefund.mockRejectedValueOnce(new Error("stripe down"));
    const report = await runFinanceHealthCheck(deps);
    expect(report.refunds).toMatchObject({ examined: 2, errors: 1, synced: 1 });
    expect(raw.sendAlert).toHaveBeenCalledTimes(1);
    expect(report.alerts[0]).toContain("bad");
  });

  it("only reports stuck settlements; it never touches them", async () => {
    const { deps, raw } = setup({
      listStuckSettlements: vi.fn().mockResolvedValue([{ id: "s1", eatery_id: "e1", amount_cents: 1600, created_at: "2026-10-09T00:00:00Z" }]),
    });
    const report = await runFinanceHealthCheck(deps);
    expect(report.settlements_stuck).toBe(1);
    expect(report.alerts[0]).toMatch(/do not settle that eatery again/);
    expect(raw.sendAlert).toHaveBeenCalledTimes(1);
  });

  it("alerts on ledger reconciliation problems", async () => {
    const { deps } = setup({ getReconciliation: vi.fn().mockResolvedValue({ ok: false, issues: [{ check: "fee_charge" }] }) });
    const report = await runFinanceHealthCheck(deps);
    expect(report.reconciliation_issues).toBe(1);
    expect(report.alerts[0]).toContain("reconciliation");
  });

  it("survives a failing processor-fee backfill and a failing alert channel", async () => {
    const { deps } = setup({
      backfillProcessorFees: vi.fn().mockRejectedValue(new Error("stripe down")),
      getReconciliation: vi.fn().mockResolvedValue({ ok: false, issues: [{}] }),
      sendAlert: vi.fn().mockRejectedValue(new Error("email down")),
    });
    const report = await runFinanceHealthCheck(deps);
    expect(report.processor_fees).toBeNull();
    expect(report.alerts).toHaveLength(1);
  });
});
