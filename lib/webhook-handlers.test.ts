import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { disputeFeeCents, handleStripeEvent, type WebhookDeps } from "@/lib/stripe/webhook-handlers";

function makeDeps(overrides: Record<string, unknown> = {}) {
  const base = {
    getContribution: vi.fn<WebhookDeps["getContribution"]>().mockResolvedValue({ amount_cents: 800, operational_fee_cents: 40, fee_rate_bps: 500, total_charged_cents: 840, currency: "usd" }),
    findContributionIdByPaymentIntent: vi.fn<WebhookDeps["findContributionIdByPaymentIntent"]>().mockResolvedValue("contrib-1"),
    markContributionFailed: vi.fn<WebhookDeps["markContributionFailed"]>().mockResolvedValue(undefined),
    recordCredit: vi.fn<WebhookDeps["recordCredit"]>().mockResolvedValue(undefined),
    recordRefund: vi.fn<WebhookDeps["recordRefund"]>().mockResolvedValue(undefined),
    recordRefundReversal: vi.fn<WebhookDeps["recordRefundReversal"]>().mockResolvedValue(undefined),
    recordDisputeOpened: vi.fn<WebhookDeps["recordDisputeOpened"]>().mockResolvedValue(undefined),
    recordDisputeClosed: vi.fn<WebhookDeps["recordDisputeClosed"]>().mockResolvedValue(undefined),
    fetchProcessorFee: vi.fn<WebhookDeps["fetchProcessorFee"]>().mockResolvedValue({ feeCents: 55, balanceTransactionId: "txn_1" }),
    recordProcessorFee: vi.fn<WebhookDeps["recordProcessorFee"]>().mockResolvedValue(undefined),
    sendReceipt: vi.fn<NonNullable<WebhookDeps["sendReceipt"]>>().mockResolvedValue(undefined),
    log: vi.fn(),
  };
  return { ...base, ...overrides } as typeof base;
}

const event = (type: string, object: unknown) => ({ id: "evt_1", type, data: { object } }) as unknown as Stripe.Event;

const paidSession = (overrides: Record<string, unknown> = {}) => ({
  id: "cs_1",
  payment_status: "paid",
  payment_intent: "pi_1",
  amount_total: 840,
  currency: "usd",
  metadata: { contribution_id: "contrib-1" },
  ...overrides,
});

describe("checkout events", () => {
  let deps: ReturnType<typeof makeDeps>;
  beforeEach(() => {
    deps = makeDeps();
  });

  it("books a paid checkout using the amount Stripe actually charged (principal + fee)", async () => {
    await handleStripeEvent(event("checkout.session.completed", paidSession()), deps);
    expect(deps.recordCredit).toHaveBeenCalledWith({ contributionId: "contrib-1", checkoutSessionId: "cs_1", paymentIntentId: "pi_1", amountTotalCents: 840 });
    expect(deps.recordProcessorFee).toHaveBeenCalledWith({ contributionId: "contrib-1", paymentIntentId: "pi_1", feeCents: 55, balanceTransactionId: "txn_1" });
  });

  it("emails a receipt with the stored amounts using the address from the Stripe session", async () => {
    await handleStripeEvent(event("checkout.session.completed", paidSession({ customer_details: { email: "donor@example.com" } })), deps);
    expect(deps.sendReceipt).toHaveBeenCalledWith({ contributionId: "contrib-1", email: "donor@example.com", donationCents: 800, feeCents: 40, feeRateBps: 500, totalCents: 840 });
  });

  it("falls back to the checkout email, and passes null when the donor gave none", async () => {
    await handleStripeEvent(event("checkout.session.completed", paidSession({ customer_email: "fallback@example.com" })), deps);
    expect(deps.sendReceipt.mock.calls[0][0].email).toBe("fallback@example.com");
    await handleStripeEvent(event("checkout.session.completed", paidSession()), deps);
    expect(deps.sendReceipt.mock.calls[1][0].email).toBeNull();
  });

  it("a receipt failure never fails the payment", async () => {
    deps.sendReceipt.mockRejectedValue(new Error("email provider down"));
    await handleStripeEvent(event("checkout.session.completed", paidSession({ customer_details: { email: "donor@example.com" } })), deps);
    expect(deps.recordCredit).toHaveBeenCalledTimes(1);
    expect(deps.log).toHaveBeenCalledWith("receipt email not sent", expect.anything());
  });

  it("no receipt for unpaid sessions or mismatched amounts", async () => {
    await handleStripeEvent(event("checkout.session.completed", paidSession({ payment_status: "unpaid" })), deps);
    await expect(handleStripeEvent(event("checkout.session.completed", paidSession({ amount_total: 800 })), deps)).rejects.toThrow();
    expect(deps.sendReceipt).not.toHaveBeenCalled();
  });

  it("recognises nothing for an unpaid or merely created session", async () => {
    await handleStripeEvent(event("checkout.session.completed", paidSession({ payment_status: "unpaid" })), deps);
    expect(deps.recordCredit).not.toHaveBeenCalled();
  });

  it("refuses to book when Stripe's total differs from the snapshot (e.g. donation-only amount)", async () => {
    await expect(handleStripeEvent(event("checkout.session.completed", paidSession({ amount_total: 800 })), deps)).rejects.toThrow("checkout_amount_mismatch");
    await expect(handleStripeEvent(event("checkout.session.completed", paidSession({ currency: "eur" })), deps)).rejects.toThrow("checkout_amount_mismatch");
    expect(deps.recordCredit).not.toHaveBeenCalled();
  });

  it("still books the donation when the processing fee cannot be fetched yet", async () => {
    deps.fetchProcessorFee.mockRejectedValue(new Error("stripe down"));
    await handleStripeEvent(event("checkout.session.completed", paidSession()), deps);
    expect(deps.recordCredit).toHaveBeenCalledTimes(1);
    expect(deps.recordProcessorFee).not.toHaveBeenCalled();
    expect(deps.log).toHaveBeenCalled();
  });

  it("an internal failure after Stripe took the money surfaces as an error so Stripe retries, then succeeds", async () => {
    deps.recordCredit.mockRejectedValueOnce(new Error("database unavailable"));
    await expect(handleStripeEvent(event("checkout.session.completed", paidSession()), deps)).rejects.toThrow("database unavailable");
    await handleStripeEvent(event("checkout.session.completed", paidSession()), deps); // the retry
    expect(deps.recordCredit).toHaveBeenCalledTimes(2);
    // both attempts use the same idempotent keys, so the database books it once (see tests/db)
    expect(deps.recordCredit.mock.calls[0][0]).toEqual(deps.recordCredit.mock.calls[1][0]);
  });

  it("repeated events apply identically (idempotency is enforced by the database keys)", async () => {
    for (let i = 0; i < 3; i += 1) await handleStripeEvent(event("checkout.session.async_payment_succeeded", paidSession()), deps);
    expect(new Set(deps.recordCredit.mock.calls.map((call) => JSON.stringify(call[0]))).size).toBe(1);
  });

  it("failed and expired checkouts are marked failed without any revenue", async () => {
    await handleStripeEvent(event("checkout.session.expired", paidSession({ payment_status: "unpaid" })), deps);
    await handleStripeEvent(event("checkout.session.async_payment_failed", paidSession({ payment_status: "unpaid" })), deps);
    expect(deps.markContributionFailed).toHaveBeenNthCalledWith(1, "contrib-1", "checkout_expired");
    expect(deps.markContributionFailed).toHaveBeenNthCalledWith(2, "contrib-1", "async_payment_failed");
    expect(deps.recordCredit).not.toHaveBeenCalled();
  });
});

describe("refund events", () => {
  const refund = (overrides: Record<string, unknown> = {}) => ({
    id: "re_1",
    amount: 420,
    status: "succeeded",
    payment_intent: "pi_1",
    metadata: { internal_refund_id: "int-1", contribution_id: "contrib-1" },
    ...overrides,
  });

  it("books a succeeded refund with the total amount and the internal id", async () => {
    const deps = makeDeps();
    await handleStripeEvent(event("refund.updated", refund()), deps);
    expect(deps.recordRefund).toHaveBeenCalledWith({ contributionId: "contrib-1", stripeRefundId: "re_1", amountCents: 420, internalRefundId: "int-1", providerStatus: "succeeded" });
  });

  it("registers pending refunds without booking them", async () => {
    const deps = makeDeps();
    for (const status of ["pending", "requires_action"]) {
      await handleStripeEvent(event("refund.created", refund({ status })), deps);
    }
    expect(deps.recordRefund.mock.calls.every((call) => call[0].providerStatus === "pending")).toBe(true);
  });

  it("reverses failed and canceled refunds", async () => {
    const deps = makeDeps();
    await handleStripeEvent(event("refund.updated", refund({ status: "failed" })), deps);
    await handleStripeEvent(event("refund.updated", refund({ status: "canceled" })), deps);
    expect(deps.recordRefundReversal).toHaveBeenCalledTimes(2);
    expect(deps.recordRefund).not.toHaveBeenCalled();
  });

  it("falls back to the contribution id in metadata, and errors (so Stripe retries) when the payment is unknown", async () => {
    const deps = makeDeps({ findContributionIdByPaymentIntent: vi.fn().mockResolvedValue(null) });
    await handleStripeEvent(event("refund.created", refund()), deps);
    expect(deps.recordRefund.mock.calls[0][0].contributionId).toBe("contrib-1");

    const orphan = makeDeps({ findContributionIdByPaymentIntent: vi.fn().mockResolvedValue(null) });
    await expect(handleStripeEvent(event("refund.created", refund({ metadata: {} })), orphan)).rejects.toThrow("refund_contribution_not_found");
  });

  it("charge.refunded applies each embedded refund by its own status", async () => {
    const deps = makeDeps();
    await handleStripeEvent(
      event("charge.refunded", { refunds: { data: [refund({ id: "re_a" }), refund({ id: "re_b", status: "pending" })] } }),
      deps,
    );
    expect(deps.recordRefund.mock.calls.map((call) => [call[0].stripeRefundId, call[0].providerStatus])).toEqual([["re_a", "succeeded"], ["re_b", "pending"]]);
  });

  it("a refund event that arrives before the payment is booked is retried (database rejects it)", async () => {
    const deps = makeDeps({ recordRefund: vi.fn().mockRejectedValue(new Error("contribution_not_completed")) });
    await expect(handleStripeEvent(event("refund.updated", refund()), deps)).rejects.toThrow("contribution_not_completed");
  });
});

describe("dispute events", () => {
  const dispute = (overrides: Record<string, unknown> = {}) => ({
    id: "dp_1",
    amount: 840,
    reason: "fraudulent",
    status: "needs_response",
    payment_intent: "pi_1",
    balance_transactions: [{ fee: 1500 }, { fee: 0 }],
    ...overrides,
  });

  it("sums dispute fees from balance transactions", () => {
    expect(disputeFeeCents(dispute() as unknown as Stripe.Dispute)).toBe(1500);
    expect(disputeFeeCents({ balance_transactions: undefined } as unknown as Stripe.Dispute)).toBe(0);
  });

  it("opens a dispute with its fee", async () => {
    const deps = makeDeps();
    await handleStripeEvent(event("charge.dispute.created", dispute()), deps);
    expect(deps.recordDisputeOpened).toHaveBeenCalledWith({ contributionId: "contrib-1", stripeDisputeId: "dp_1", amountCents: 840, reason: "fraudulent", stripeStatus: "needs_response", disputeFeeCents: 1500 });
  });

  it("closing as lost ensures the dispute exists first, then books the loss; anything else is a win", async () => {
    const deps = makeDeps();
    await handleStripeEvent(event("charge.dispute.closed", dispute({ status: "lost" })), deps);
    expect(deps.recordDisputeOpened).toHaveBeenCalledTimes(1);
    expect(deps.recordDisputeClosed).toHaveBeenCalledWith({ stripeDisputeId: "dp_1", outcome: "lost", disputeFeeCents: 1500 });

    await handleStripeEvent(event("charge.dispute.closed", dispute({ status: "won" })), deps);
    await handleStripeEvent(event("charge.dispute.closed", dispute({ status: "warning_closed" })), deps);
    expect(deps.recordDisputeClosed.mock.calls.slice(1).every((call) => call[0].outcome === "won")).toBe(true);
  });

  it("errors for a dispute on an unknown payment so Stripe retries", async () => {
    const deps = makeDeps({ findContributionIdByPaymentIntent: vi.fn().mockResolvedValue(null) });
    await expect(handleStripeEvent(event("charge.dispute.created", dispute()), deps)).rejects.toThrow("dispute_contribution_not_found");
  });
});

describe("unrelated events", () => {
  it("are ignored", async () => {
    const deps = makeDeps();
    await handleStripeEvent(event("customer.created", {}), deps);
    expect(deps.recordCredit).not.toHaveBeenCalled();
  });
});
