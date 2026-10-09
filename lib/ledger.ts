import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerDailyLimits, QR_TTL_MINUTES } from "@/lib/constants";
import type { Json } from "@/types/database";

export type QrHoldResult =
  | { ok: true; qr_id: string; expires_at: string }
  | {
      ok: false;
      error_code:
        | "not_eligible"
        | "active_pass_exists"
        | "daily_limit_reached"
        | "too_many_attempts"
        | "cooldown"
        | "pool_unavailable";
    };

export type RedeemResult =
  | {
      ok: true;
      redemption_id: string;
      eatery_name: string;
      redeemed_at: string;
    }
  | {
      ok: false;
      error_code:
        | "invalid"
        | "already_used"
        | "expired"
        | "unavailable"
        | "eatery_limit"
        | "try_later";
    };

export type CancelQrResult =
  | { ok: true; status: "cancelled" }
  | { ok: false; error_code: "not_found" | "unavailable" };

function asObject(value: Json | Json[]): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error("unexpected_rpc_payload");
}

/** Books a verified, paid checkout: principal to the pool, operational fee to the operations ledger. */
export async function recordCredit(params: {
  contributionId: string;
  checkoutSessionId: string;
  paymentIntentId: string;
  /** The total Stripe actually charged; the database refuses to book it if it differs from the snapshot. */
  amountTotalCents?: number;
}): Promise<void> {
  const { error } = await createAdminClient().rpc("record_credit", {
    p_contribution_id: params.contributionId,
    p_checkout_session_id: params.checkoutSessionId,
    p_payment_intent_id: params.paymentIntentId,
    p_amount_total_cents: params.amountTotalCents ?? null,
  });
  if (error) throw error;
}

/**
 * Applies a provider refund. amountCents is the TOTAL returned to the donor; the database splits it
 * between donation principal and operational fee. "pending" only registers it, "succeeded" books it.
 */
export async function recordRefund(params: {
  contributionId: string;
  stripeRefundId: string;
  amountCents: number;
  internalRefundId?: string | null;
  providerStatus?: "pending" | "succeeded";
}): Promise<void> {
  const { error } = await createAdminClient().rpc("record_refund", {
    p_contribution_id: params.contributionId,
    p_stripe_refund_id: params.stripeRefundId,
    p_amount_cents: params.amountCents,
    p_internal_refund_id: params.internalRefundId ?? null,
    p_provider_status: params.providerStatus ?? "succeeded",
  });
  if (error) throw error;
}

export async function recordRefundReversal(stripeRefundId: string): Promise<void> {
  const { error } = await createAdminClient().rpc("record_refund_reversal", {
    p_stripe_refund_id: stripeRefundId,
  });
  if (error) throw error;
}

export async function createQrHold(params: {
  studentId: string;
  tokenHash: string;
  expiresAt: string;
}): Promise<QrHoldResult> {
  const limits = getServerDailyLimits();
  const { data, error } = await createAdminClient().rpc("create_qr_hold", {
    p_student_id: params.studentId,
    p_token_hash: params.tokenHash,
    p_expires_at: params.expiresAt,
    p_meals_per_day: limits.MEALS_PER_DAY,
    p_passes_generated_per_day: limits.PASSES_GENERATED_PER_DAY,
    p_qr_ttl_minutes: QR_TTL_MINUTES,
    p_now: new Date().toISOString(),
  });
  if (error) throw error;
  const payload = asObject(data);
  if (payload.ok === true) {
    return {
      ok: true,
      qr_id: String(payload.qr_id),
      expires_at: String(payload.expires_at),
    };
  }
  return {
    ok: false,
    error_code: payload.error_code as Exclude<QrHoldResult, { ok: true }>["error_code"],
  };
}

export async function expireStaleQrs(): Promise<number> {
  const { data, error } = await createAdminClient().rpc("expire_stale_qrs");
  if (error) throw error;
  return Number(data ?? 0);
}

export async function cancelQr(params: {
  qrId: string;
  studentUserId: string;
}): Promise<CancelQrResult> {
  type CancelQrRpcClient = {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{
      data: Json | null;
      error: { message: string } | null;
    }>;
  };

  const admin = createAdminClient() as unknown as CancelQrRpcClient;
  const { data, error } = await admin.rpc("cancel_qr", {
    p_qr_id: params.qrId,
    p_student_user_id: params.studentUserId,
  });
  if (error) throw error;
  const payload = asObject(data);
  if (payload.ok === true) {
    return { ok: true, status: "cancelled" };
  }
  return {
    ok: false,
    error_code: payload.error_code as "not_found" | "unavailable",
  };
}

export async function redeemQr(params: {
  tokenHash: string;
  eateryUserId: string;
}): Promise<RedeemResult> {
  const limits = getServerDailyLimits();
  const { data, error } = await createAdminClient().rpc("redeem_qr", {
    p_token_hash: params.tokenHash,
    p_eatery_user_id: params.eateryUserId,
    p_eatery_daily_limit: limits.EATERY_DAILY_LIMIT,
    p_now: new Date().toISOString(),
  });
  if (error) throw error;
  const payload = asObject(data);
  if (payload.ok === true) {
    return {
      ok: true,
      redemption_id: String(payload.redemption_id),
      eatery_name: String(payload.eatery_name),
      redeemed_at: String(payload.redeemed_at),
    };
  }
  return {
    ok: false,
    error_code: payload.error_code as
      | "invalid"
      | "already_used"
      | "expired"
      | "unavailable"
      | "eatery_limit"
      | "try_later",
  };
}

export async function recordQrScanFailure(eateryUserId: string): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("record_qr_scan_failure", {
    p_eatery_user_id: eateryUserId,
    p_now: new Date().toISOString(),
  });
  if (error) throw error;
  return data === true;
}

export async function getPoolBalanceCents(): Promise<number> {
  const { data, error } = await createAdminClient().rpc("get_pool_balance");
  if (error) throw error;
  return Number(data ?? 0);
}

export type CreateSettlementResult =
  | { ok: true; settlement_id: string; amount_cents: number; stripe_connect_account_id: string }
  | { ok: false; error_code: "eatery_not_found" | "payouts_not_connected" | "nothing_to_settle" };

export async function createSettlement(eateryId: string): Promise<CreateSettlementResult> {
  const { data, error } = await createAdminClient().rpc("create_settlement", {
    p_eatery_id: eateryId,
  });
  if (error) throw error;
  const payload = asObject(data);
  if (payload.ok === true) {
    return {
      ok: true,
      settlement_id: String(payload.settlement_id),
      amount_cents: Number(payload.amount_cents),
      stripe_connect_account_id: String(payload.stripe_connect_account_id),
    };
  }
  return {
    ok: false,
    error_code: payload.error_code as "eatery_not_found" | "payouts_not_connected" | "nothing_to_settle",
  };
}

export async function markSettlementResult(params: {
  settlementId: string;
  status: "paid" | "failed";
  stripeTransferId?: string;
}): Promise<void> {
  const { error } = await createAdminClient().rpc("mark_settlement_result", {
    p_settlement_id: params.settlementId,
    p_status: params.status,
    p_stripe_transfer_id: params.stripeTransferId ?? null,
  });
  if (error) throw error;
}
