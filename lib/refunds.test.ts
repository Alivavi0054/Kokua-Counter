import { describe, expect, it, vi } from "vitest";
import { refundIdempotencyKey, startRefund, type RefundDeps, type ReserveResult } from "@/lib/refunds";

const reserved = (overrides: Partial<Extract<ReserveResult, { ok: true }>> = {}): ReserveResult => ({
  ok: true,
  replay: false,
  refund_id: "refund-1",
  status: "requested",
  amount_cents: 420,
  principal_cents: 400,
  fee_cents: 20,
  stripe_refund_id: null,
  payment_intent_id: "pi_1",
  ...overrides,
});

function makeDeps(reserve: ReserveResult = reserved()) {
  const reserveRefund = vi.fn<RefundDeps["reserveRefund"]>().mockResolvedValue(reserve);
  const markRefundSubmitted = vi.fn<RefundDeps["markRefundSubmitted"]>().mockResolvedValue(undefined);
  const markRefundFailed = vi.fn<RefundDeps["markRefundFailed"]>().mockResolvedValue(undefined);
  const create = vi.fn<RefundDeps["stripe"]["refunds"]["create"]>().mockResolvedValue({ id: "re_1", status: "pending" });
  const log = vi.fn();
  const deps: RefundDeps = { reserveRefund, markRefundSubmitted, markRefundFailed, stripe: { refunds: { create } }, log };
  return { deps, reserveRefund, markRefundSubmitted, markRefundFailed, create, log };
}

const params = { contributionId: "contrib-1", amountCents: 420, reason: "requested", requestedBy: "admin-1", idempotencyRef: "click-12345678" };

describe("startRefund", () => {
  it("reserves first, then refunds the TOTAL amount at Stripe with a reservation-based idempotency key", async () => {
    const { deps, create, markRefundSubmitted, reserveRefund } = makeDeps();
    const result = await startRefund(params, deps);

    expect(reserveRefund).toHaveBeenCalledWith(params);
    expect(create).toHaveBeenCalledWith(
      { payment_intent: "pi_1", amount: 420, reason: "requested_by_customer", metadata: { contribution_id: "contrib-1", internal_refund_id: "refund-1" } },
      { idempotencyKey: refundIdempotencyKey("refund-1") },
    );
    expect(markRefundSubmitted).toHaveBeenCalledWith("refund-1", "re_1");
    expect(result).toMatchObject({ status: "started", stripeRefundId: "re_1", amountCents: 420, principalCents: 400, feeCents: 20 });
  });

  it("does not call Stripe when the database rejects the refund (over-refund, dispute, nothing left)", async () => {
    for (const code of ["exceeds_remaining", "disputed", "nothing_to_refund", "not_refundable"]) {
      const { deps, create } = makeDeps({ ok: false, error_code: code });
      const result = await startRefund(params, deps);
      expect(result).toMatchObject({ status: "rejected", errorCode: code });
      expect(create).not.toHaveBeenCalled();
    }
  });

  it("a duplicate request whose refund is already at Stripe creates nothing new", async () => {
    const { deps, create } = makeDeps(reserved({ replay: true, status: "pending", stripe_refund_id: "re_existing" }));
    const result = await startRefund(params, deps);
    expect(create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: "started", replay: true, stripeRefundId: "re_existing" });
  });

  it("a replay that never reached Stripe is retried with the SAME idempotency key", async () => {
    const { deps, create } = makeDeps(reserved({ replay: true }));
    await startRefund(params, deps);
    expect(create.mock.calls[0][1]).toEqual({ idempotencyKey: "refund:refund-1" });
  });

  it("releases the reservation when Stripe definitively rejects the refund", async () => {
    const { deps, create, markRefundFailed, markRefundSubmitted } = makeDeps();
    create.mockRejectedValue(Object.assign(new Error("charge already refunded"), { type: "StripeInvalidRequestError" }));
    const result = await startRefund(params, deps);
    expect(result).toEqual({ status: "failed", refundId: "refund-1" });
    expect(markRefundFailed).toHaveBeenCalledWith("refund-1", "stripe_rejected", expect.stringContaining("charge already refunded"));
    expect(markRefundSubmitted).not.toHaveBeenCalled();
  });

  it("keeps the reservation (no release) when Stripe's answer is unknown", async () => {
    const { deps, create, markRefundFailed } = makeDeps();
    create.mockRejectedValue(Object.assign(new Error("timeout"), { type: "StripeConnectionError" }));
    const result = await startRefund(params, deps);
    expect(result).toEqual({ status: "needs_reconciliation", refundId: "refund-1" });
    expect(markRefundFailed).not.toHaveBeenCalled();
  });

  it("still reports success if Stripe created the refund but recording its id failed (the webhook finishes it)", async () => {
    const { deps, markRefundSubmitted, log } = makeDeps();
    markRefundSubmitted.mockRejectedValue(new Error("db down"));
    const result = await startRefund(params, deps);
    expect(result).toMatchObject({ status: "started", stripeRefundId: "re_1" });
    expect(log).toHaveBeenCalled();
  });

  it("fails a refund that has no payment to refund", async () => {
    const { deps, markRefundFailed, create } = makeDeps(reserved({ payment_intent_id: null }));
    expect(await startRefund(params, deps)).toEqual({ status: "failed", refundId: "refund-1" });
    expect(markRefundFailed).toHaveBeenCalledWith("refund-1", "no_payment_intent", null);
    expect(create).not.toHaveBeenCalled();
  });
});
