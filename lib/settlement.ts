export type CreatedSettlement = {
  ok: true;
  settlement_id: string;
  amount_cents: number;
  stripe_connect_account_id: string;
};

export type CreateSettlementOutcome =
  | CreatedSettlement
  | { ok: false; error_code: "eatery_not_found" | "payouts_not_connected" | "nothing_to_settle" };

export type SettlementDeps = {
  createSettlement: (eateryId: string) => Promise<CreateSettlementOutcome>;
  markSettlementResult: (params: {
    settlementId: string;
    status: "paid" | "failed";
    stripeTransferId?: string;
  }) => Promise<void>;
  stripe: {
    transfers: {
      create: (
        params: {
          amount: number;
          currency: string;
          destination: string;
          metadata: Record<string, string>;
        },
        options: { idempotencyKey: string },
      ) => Promise<{ id: string }>;
    };
  };
  log?: (message: string, detail: Record<string, unknown>) => void;
};

export type SettleEateryResult =
  | { status: "paid"; settlementId: string; amountCents: number }
  | {
      status: "not_settleable";
      errorCode: "eatery_not_found" | "payouts_not_connected" | "nothing_to_settle";
    }
  /** Stripe rejected the transfer; the settlement was marked failed and redemptions released. */
  | { status: "transfer_failed"; settlementId: string }
  /**
   * Money may have moved (transfer succeeded but the DB update failed, or Stripe's
   * response was ambiguous). Redemptions stay locked to the settlement so they cannot
   * be paid twice; an admin must reconcile manually.
   */
  | { status: "needs_reconciliation"; settlementId: string; transferId: string | null };

// Errors where we cannot know whether Stripe created the transfer.
const AMBIGUOUS_STRIPE_ERROR_TYPES = new Set([
  "StripeConnectionError",
  "StripeAPIError",
  "api_error",
]);

function isAmbiguousTransferError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { type, rawType } = error as { type?: unknown; rawType?: unknown };
  return (
    (typeof type === "string" && AMBIGUOUS_STRIPE_ERROR_TYPES.has(type)) ||
    (typeof rawType === "string" && AMBIGUOUS_STRIPE_ERROR_TYPES.has(rawType))
  );
}

function errorSummary(error: unknown): string {
  if (error && typeof error === "object") {
    const { type, code } = error as { type?: unknown; code?: unknown };
    return [type, code].filter((part): part is string => typeof part === "string").join("/") || "error";
  }
  return "error";
}

export async function settleEatery(eateryId: string, deps: SettlementDeps): Promise<SettleEateryResult> {
  const log = deps.log ?? (() => {});
  const created = await deps.createSettlement(eateryId);
  if (!created.ok) {
    return { status: "not_settleable", errorCode: created.error_code };
  }
  const settlementId = created.settlement_id;

  let transferId: string;
  try {
    const transfer = await deps.stripe.transfers.create(
      {
        amount: created.amount_cents,
        currency: "usd",
        destination: created.stripe_connect_account_id,
        metadata: { settlement_id: settlementId },
      },
      { idempotencyKey: settlementId },
    );
    transferId = transfer.id;
  } catch (error) {
    if (isAmbiguousTransferError(error)) {
      log("settlement transfer outcome unknown; left in processing for reconciliation", {
        settlementId,
        error: errorSummary(error),
      });
      return { status: "needs_reconciliation", settlementId, transferId: null };
    }
    try {
      await deps.markSettlementResult({ settlementId, status: "failed" });
    } catch (markError) {
      log("settlement transfer failed and could not be marked failed", {
        settlementId,
        error: errorSummary(markError),
      });
    }
    return { status: "transfer_failed", settlementId };
  }

  try {
    await deps.markSettlementResult({ settlementId, status: "paid", stripeTransferId: transferId });
  } catch (error) {
    // The money has moved. Never release the redemptions here or they would be paid again.
    log("settlement transfer succeeded but marking it paid failed; reconcile manually", {
      settlementId,
      transferId,
      error: errorSummary(error),
    });
    return { status: "needs_reconciliation", settlementId, transferId };
  }

  return { status: "paid", settlementId, amountCents: created.amount_cents };
}
