import type Stripe from "stripe";
import { submitReservedRefund, type RefundDeps, type ReserveResult } from "@/lib/refunds";

export type RefundRow = {
  id: string;
  contribution_id: string;
  status: string;
  amount_cents: number;
  principal_cents: number;
  fee_cents: number;
  stripe_refund_id: string | null;
};

export type ReconcileDeps = {
  getPaymentIntentId: (contributionId: string) => Promise<string | null>;
  retrieveStripeRefund: (stripeRefundId: string) => Promise<Stripe.Refund>;
  applyProviderRefund: (refund: Stripe.Refund) => Promise<void>;
  refundDeps: RefundDeps;
};

export type ReconcileOutcome =
  | { outcome: "nothing_to_do"; status: string }
  /** Stripe already knew the refund; its current state was applied. */
  | { outcome: "synced"; stripeStatus: string }
  /** Stripe never saw it; it was submitted again with the same idempotency key. */
  | { outcome: "resubmitted" }
  | { outcome: "unresolved" };

/**
 * Brings one unfinished refund in line with Stripe. Safe to run repeatedly:
 *  - a refund Stripe already has is re-read and its status applied (idempotent ledger bookings);
 *  - a refund Stripe has never seen is re-submitted with the reservation's own idempotency key, so
 *    Stripe returns the original if it did create one.
 */
export async function reconcileRefund(row: RefundRow, deps: ReconcileDeps): Promise<ReconcileOutcome> {
  if (row.status !== "requested" && row.status !== "pending") {
    return { outcome: "nothing_to_do", status: row.status };
  }

  if (row.stripe_refund_id) {
    const remote = await deps.retrieveStripeRefund(row.stripe_refund_id);
    await deps.applyProviderRefund(remote);
    return { outcome: "synced", stripeStatus: remote.status ?? "unknown" };
  }

  const reserved: Extract<ReserveResult, { ok: true }> = {
    ok: true,
    replay: true,
    refund_id: row.id,
    status: row.status,
    amount_cents: row.amount_cents,
    principal_cents: row.principal_cents,
    fee_cents: row.fee_cents,
    stripe_refund_id: null,
    payment_intent_id: await deps.getPaymentIntentId(row.contribution_id),
  };
  const result = await submitReservedRefund(reserved, row.contribution_id, deps.refundDeps);
  return result.status === "started" ? { outcome: "resubmitted" } : { outcome: "unresolved" };
}
