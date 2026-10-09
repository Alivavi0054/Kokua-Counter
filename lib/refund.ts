/**
 * Deterministic Stripe idempotency key for an admin refund. The same contribution,
 * amount and already-refunded total always map to the same key, so a double-click
 * (or retry) returns the original refund instead of creating a second one. Once the
 * refund is recorded, refunded_amount_cents changes and a new key is produced.
 */
export function buildRefundIdempotencyKey(params: {
  contributionId: string;
  amountCents: number;
  refundedAmountCents: number;
}): string {
  return `refund:${params.contributionId}:${params.amountCents}:${params.refundedAmountCents}`;
}
