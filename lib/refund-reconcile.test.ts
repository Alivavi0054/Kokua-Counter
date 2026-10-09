import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { reconcileRefund, type ReconcileDeps, type RefundRow } from "@/lib/refund-reconcile";

const row = (overrides: Partial<RefundRow> = {}): RefundRow => ({
  id: "refund-1",
  contribution_id: "contrib-1",
  status: "requested",
  amount_cents: 420,
  principal_cents: 400,
  fee_cents: 20,
  stripe_refund_id: null,
  ...overrides,
});

function makeDeps() {
  const create = vi.fn().mockResolvedValue({ id: "re_new", status: "pending" });
  const deps = {
    getPaymentIntentId: vi.fn().mockResolvedValue("pi_1"),
    retrieveStripeRefund: vi.fn().mockResolvedValue({ id: "re_1", status: "succeeded", amount: 420 } as Stripe.Refund),
    applyProviderRefund: vi.fn().mockResolvedValue(undefined),
    refundDeps: {
      reserveRefund: vi.fn(),
      markRefundSubmitted: vi.fn().mockResolvedValue(undefined),
      markRefundFailed: vi.fn().mockResolvedValue(undefined),
      stripe: { refunds: { create } },
      log: vi.fn(),
    },
  };
  return { deps: deps as unknown as ReconcileDeps, create, raw: deps };
}

describe("reconcileRefund", () => {
  it("leaves finished refunds alone", async () => {
    const { deps, create, raw } = makeDeps();
    for (const status of ["succeeded", "failed", "canceled"]) {
      expect(await reconcileRefund(row({ status }), deps)).toEqual({ outcome: "nothing_to_do", status });
    }
    expect(create).not.toHaveBeenCalled();
    expect(raw.retrieveStripeRefund).not.toHaveBeenCalled();
  });

  it("re-reads a refund Stripe already has and applies its current state", async () => {
    const { deps, create, raw } = makeDeps();
    const result = await reconcileRefund(row({ status: "pending", stripe_refund_id: "re_1" }), deps);
    expect(result).toEqual({ outcome: "synced", stripeStatus: "succeeded" });
    expect(raw.applyProviderRefund).toHaveBeenCalledWith(expect.objectContaining({ id: "re_1", status: "succeeded" }));
    expect(create).not.toHaveBeenCalled();
  });

  it("re-submits a refund Stripe never saw, with the reservation's own idempotency key", async () => {
    const { deps, create } = makeDeps();
    expect(await reconcileRefund(row(), deps)).toEqual({ outcome: "resubmitted" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_1", amount: 420, metadata: { contribution_id: "contrib-1", internal_refund_id: "refund-1" } }),
      { idempotencyKey: "refund:refund-1" },
    );
  });

  it("reports unresolved when Stripe still cannot confirm", async () => {
    const { deps, create } = makeDeps();
    create.mockRejectedValue(Object.assign(new Error("timeout"), { type: "StripeConnectionError" }));
    expect(await reconcileRefund(row(), deps)).toEqual({ outcome: "unresolved" });
  });
});
