import { describeError } from "@/lib/errors";

/**
 * Admin refund workflow. The external Stripe call cannot be part of a database transaction, so the
 * flow is: (1) reserve the refund in the database (this fixes the principal/fee split and holds the
 * money so it cannot be refunded twice), (2) call Stripe with an idempotency key derived from the
 * reservation, (3) record the Stripe refund id. The ledgers are only touched later, from the
 * verified Stripe webhook (or reconciliation), never from this function.
 */

export type ReserveResult =
  | {
      ok: true;
      replay: boolean;
      refund_id: string;
      status: string;
      amount_cents: number;
      principal_cents: number;
      fee_cents: number;
      stripe_refund_id: string | null;
      payment_intent_id: string | null;
    }
  | { ok: false; error_code: string; remaining_cents?: number };

export type RefundDeps = {
  reserveRefund: (params: {
    contributionId: string;
    amountCents: number | null;
    reason: string | null;
    requestedBy: string;
    idempotencyRef: string | null;
  }) => Promise<ReserveResult>;
  markRefundSubmitted: (refundId: string, stripeRefundId: string) => Promise<void>;
  markRefundFailed: (refundId: string, code: string, detail: string | null) => Promise<void>;
  stripe: {
    refunds: {
      create: (
        params: { payment_intent: string; amount: number; reason?: "requested_by_customer"; metadata: Record<string, string> },
        options: { idempotencyKey: string },
      ) => Promise<{ id: string; status: string | null }>;
    };
  };
  log?: (message: string, detail: Record<string, unknown>) => void;
};

export type StartRefundResult =
  | {
      status: "started";
      refundId: string;
      replay: boolean;
      amountCents: number;
      principalCents: number;
      feeCents: number;
      stripeRefundId: string;
    }
  | { status: "rejected"; errorCode: string; remainingCents?: number }
  /** Stripe's answer is unknown; the reservation stays in place and the refund needs reconciliation. */
  | { status: "needs_reconciliation"; refundId: string }
  | { status: "failed"; refundId: string };

// Errors after which we cannot know whether Stripe created the refund.
const AMBIGUOUS_ERROR_TYPES = new Set(["StripeConnectionError", "StripeAPIError", "api_error"]);

function isAmbiguous(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { type, rawType } = error as { type?: unknown; rawType?: unknown };
  return (
    (typeof type === "string" && AMBIGUOUS_ERROR_TYPES.has(type)) ||
    (typeof rawType === "string" && AMBIGUOUS_ERROR_TYPES.has(rawType))
  );
}

/** Stripe idempotency key for a reserved refund. Stable across retries, unique per reservation. */
export function refundIdempotencyKey(refundId: string): string {
  return `refund:${refundId}`;
}

/** Submits an already-reserved refund to Stripe (used for the first attempt and for retries). */
export async function submitReservedRefund(
  reserved: Extract<ReserveResult, { ok: true }>,
  contributionId: string,
  deps: RefundDeps,
): Promise<StartRefundResult> {
  const log = deps.log ?? (() => {});
  const base = {
    refundId: reserved.refund_id,
    replay: reserved.replay,
    amountCents: reserved.amount_cents,
    principalCents: reserved.principal_cents,
    feeCents: reserved.fee_cents,
  };

  // Already handed to Stripe (a duplicate request): do not create anything again.
  if (reserved.stripe_refund_id) {
    return { status: "started", ...base, stripeRefundId: reserved.stripe_refund_id };
  }
  if (reserved.status === "failed" || reserved.status === "canceled") {
    return { status: "failed", refundId: reserved.refund_id };
  }
  if (!reserved.payment_intent_id) {
    await deps.markRefundFailed(reserved.refund_id, "no_payment_intent", null);
    return { status: "failed", refundId: reserved.refund_id };
  }

  let stripeRefund: { id: string; status: string | null };
  try {
    stripeRefund = await deps.stripe.refunds.create(
      {
        payment_intent: reserved.payment_intent_id,
        amount: reserved.amount_cents,
        reason: "requested_by_customer",
        metadata: { contribution_id: contributionId, internal_refund_id: reserved.refund_id },
      },
      { idempotencyKey: refundIdempotencyKey(reserved.refund_id) },
    );
  } catch (error) {
    if (isAmbiguous(error)) {
      log("refund submission outcome unknown; reservation kept for reconciliation", {
        refundId: reserved.refund_id,
        error: describeError(error),
      });
      return { status: "needs_reconciliation", refundId: reserved.refund_id };
    }
    log("stripe rejected the refund", { refundId: reserved.refund_id, error: describeError(error) });
    try {
      await deps.markRefundFailed(reserved.refund_id, "stripe_rejected", describeError(error));
    } catch (markError) {
      log("could not mark rejected refund as failed", { refundId: reserved.refund_id, error: describeError(markError) });
    }
    return { status: "failed", refundId: reserved.refund_id };
  }

  try {
    await deps.markRefundSubmitted(reserved.refund_id, stripeRefund.id);
  } catch (error) {
    // Stripe has the refund; the webhook (matched by the internal id in metadata) will still finish it.
    log("refund created at Stripe but recording its id failed", {
      refundId: reserved.refund_id,
      stripeRefundId: stripeRefund.id,
      error: describeError(error),
    });
  }
  return { status: "started", ...base, stripeRefundId: stripeRefund.id };
}

export async function startRefund(
  params: {
    contributionId: string;
    amountCents: number | null;
    reason: string | null;
    requestedBy: string;
    idempotencyRef: string | null;
  },
  deps: RefundDeps,
): Promise<StartRefundResult> {
  const reserved = await deps.reserveRefund(params);
  if (!reserved.ok) {
    return { status: "rejected", errorCode: reserved.error_code, remainingCents: reserved.remaining_cents };
  }
  return submitReservedRefund(reserved, params.contributionId, deps);
}
