import type Stripe from "stripe";
import { describeError } from "@/lib/errors";

/**
 * Applies verified Stripe events to the ledgers. Every database call is idempotent (keyed by Stripe
 * ids), so a replayed or reordered event is harmless. Any failure throws, the route answers 500, and
 * Stripe retries later: nothing is silently dropped, and nothing is recognised before Stripe confirms it.
 */

export type WebhookDeps = {
  getContribution: (id: string) => Promise<{
    amount_cents: number;
    operational_fee_cents: number;
    fee_rate_bps: number;
    total_charged_cents: number;
    currency: string;
  } | null>;
  findContributionIdByPaymentIntent: (paymentIntentId: string) => Promise<string | null>;
  markContributionFailed: (contributionId: string, reason: string) => Promise<void>;
  recordCredit: (params: { contributionId: string; checkoutSessionId: string; paymentIntentId: string; amountTotalCents: number }) => Promise<void>;
  recordRefund: (params: {
    contributionId: string;
    stripeRefundId: string;
    amountCents: number;
    internalRefundId: string | null;
    providerStatus: "pending" | "succeeded";
  }) => Promise<void>;
  recordRefundReversal: (stripeRefundId: string) => Promise<void>;
  recordDisputeOpened: (params: {
    contributionId: string;
    stripeDisputeId: string;
    amountCents: number;
    reason: string | null;
    stripeStatus: string | null;
    disputeFeeCents: number;
  }) => Promise<void>;
  recordDisputeClosed: (params: { stripeDisputeId: string; outcome: "won" | "lost"; disputeFeeCents: number | null }) => Promise<void>;
  /** Best effort: the Stripe processing fee for a payment, or null if it is not available yet. */
  fetchProcessorFee: (paymentIntentId: string) => Promise<{ feeCents: number; balanceTransactionId: string | null } | null>;
  recordProcessorFee: (params: { contributionId: string; paymentIntentId: string; feeCents: number; balanceTransactionId: string | null }) => Promise<void>;
  /**
   * Best effort: emails the donor a receipt (at most once per donation). The address comes from the
   * Stripe session and is never stored. Optional so the webhook works without email configured.
   */
  sendReceipt?: (params: {
    contributionId: string;
    email: string | null;
    donationCents: number;
    feeCents: number;
    feeRateBps: number;
    totalCents: number;
  }) => Promise<void>;
  log?: (message: string, detail?: Record<string, unknown>) => void;
};

export function asStripeId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** Sum of the fees Stripe charged on a dispute's balance transactions (e.g. the dispute fee). */
export function disputeFeeCents(dispute: Stripe.Dispute): number {
  const transactions = (dispute.balance_transactions ?? []) as Array<{ fee?: number }>;
  return transactions.reduce((total, transaction) => total + (typeof transaction.fee === "number" && transaction.fee > 0 ? transaction.fee : 0), 0);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, deps: WebhookDeps) {
  // Only a confirmed payment is recognised; an unpaid (e.g. async pending) session is ignored for now.
  if (session.payment_status !== "paid") return;
  const contributionId = session.metadata?.contribution_id;
  const paymentIntentId = asStripeId(session.payment_intent);
  if (!contributionId || !paymentIntentId) throw new Error("checkout_missing_ids");

  const contribution = await deps.getContribution(contributionId);
  if (!contribution) throw new Error("checkout_contribution_not_found");
  // The amount Stripe collected must equal the snapshot taken at checkout: principal + operational fee.
  if (session.amount_total !== contribution.total_charged_cents || session.currency?.toLowerCase() !== contribution.currency) {
    throw new Error("checkout_amount_mismatch");
  }

  await deps.recordCredit({
    contributionId,
    checkoutSessionId: session.id,
    paymentIntentId,
    amountTotalCents: contribution.total_charged_cents,
  });

  // Processing fee is bookkeeping, not part of confirming the payment: never fail the credit over it.
  // Anything missed here is picked up by the admin reconciliation action.
  try {
    const fee = await deps.fetchProcessorFee(paymentIntentId);
    if (fee) {
      await deps.recordProcessorFee({ contributionId, paymentIntentId, feeCents: fee.feeCents, balanceTransactionId: fee.balanceTransactionId });
    }
  } catch (error) {
    deps.log?.("processor fee not recorded yet; reconciliation will retry", { contributionId, error: describeError(error) });
  }

  // Same rule for the receipt: the donation is already booked, so an email problem must not fail the webhook.
  try {
    await deps.sendReceipt?.({
      contributionId,
      email: session.customer_details?.email ?? session.customer_email ?? null,
      donationCents: contribution.amount_cents,
      feeCents: contribution.operational_fee_cents,
      feeRateBps: contribution.fee_rate_bps,
      totalCents: contribution.total_charged_cents,
    });
  } catch (error) {
    deps.log?.("receipt email not sent", { contributionId, error: describeError(error) });
  }
}

async function markFailed(session: Stripe.Checkout.Session, reason: string, deps: WebhookDeps) {
  const contributionId = session.metadata?.contribution_id;
  if (!contributionId) throw new Error("checkout_missing_contribution_id");
  await deps.markContributionFailed(contributionId, reason);
}

/** Applies the current provider state of a refund (also used by manual reconciliation). */
export async function applyProviderRefund(refund: Stripe.Refund, deps: WebhookDeps) {
  const paymentIntentId = asStripeId(refund.payment_intent);
  const contributionId =
    (paymentIntentId ? await deps.findContributionIdByPaymentIntent(paymentIntentId) : null) ??
    refund.metadata?.contribution_id ??
    null;
  if (!contributionId) throw new Error("refund_contribution_not_found");

  switch (refund.status) {
    case "succeeded":
      await deps.recordRefund({
        contributionId,
        stripeRefundId: refund.id,
        amountCents: refund.amount,
        internalRefundId: refund.metadata?.internal_refund_id ?? null,
        providerStatus: "succeeded",
      });
      break;
    case "pending":
    case "requires_action":
      await deps.recordRefund({
        contributionId,
        stripeRefundId: refund.id,
        amountCents: refund.amount,
        internalRefundId: refund.metadata?.internal_refund_id ?? null,
        providerStatus: "pending",
      });
      break;
    case "failed":
    case "canceled":
      await deps.recordRefundReversal(refund.id);
      break;
    default:
      break;
  }
}

async function openDispute(dispute: Stripe.Dispute, deps: WebhookDeps) {
  const paymentIntentId = asStripeId(dispute.payment_intent);
  const contributionId = paymentIntentId ? await deps.findContributionIdByPaymentIntent(paymentIntentId) : null;
  if (!contributionId) throw new Error("dispute_contribution_not_found");
  await deps.recordDisputeOpened({
    contributionId,
    stripeDisputeId: dispute.id,
    amountCents: dispute.amount,
    reason: dispute.reason ?? null,
    stripeStatus: dispute.status ?? null,
    disputeFeeCents: disputeFeeCents(dispute),
  });
}

export async function handleStripeEvent(event: Stripe.Event, deps: WebhookDeps): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, deps);
      break;
    case "checkout.session.expired":
      await markFailed(event.data.object as Stripe.Checkout.Session, "checkout_expired", deps);
      break;
    case "checkout.session.async_payment_failed":
      await markFailed(event.data.object as Stripe.Checkout.Session, "async_payment_failed", deps);
      break;
    case "refund.created":
    case "refund.updated":
    // Older event name for the same thing; some endpoints are still subscribed to it.
    case "charge.refund.updated":
      await applyProviderRefund(event.data.object as Stripe.Refund, deps);
      break;
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      for (const refund of charge.refunds?.data ?? []) {
        await applyProviderRefund(refund, deps);
      }
      break;
    }
    case "charge.dispute.created":
    case "charge.dispute.updated":
      await openDispute(event.data.object as Stripe.Dispute, deps);
      break;
    case "charge.dispute.closed": {
      const dispute = event.data.object as Stripe.Dispute;
      // Make sure the dispute exists even if its "created" event was missed or arrives later.
      await openDispute(dispute, deps);
      await deps.recordDisputeClosed({
        stripeDisputeId: dispute.id,
        outcome: dispute.status === "lost" ? "lost" : "won",
        disputeFeeCents: disputeFeeCents(dispute),
      });
      break;
    }
    default:
      break;
  }
}
