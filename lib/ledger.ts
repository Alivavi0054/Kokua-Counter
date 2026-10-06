import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerDailyLimits } from "@/lib/constants";
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

export async function recordCredit(params: {
  contributionId: string;
  checkoutSessionId: string;
  paymentIntentId: string;
}): Promise<void> {
  const { error } = await createAdminClient().rpc("record_credit", {
    p_contribution_id: params.contributionId,
    p_checkout_session_id: params.checkoutSessionId,
    p_payment_intent_id: params.paymentIntentId,
  });
  if (error) throw error;
}

export async function recordRefund(params: {
  contributionId: string;
  stripeRefundId: string;
  amountCents: number;
}): Promise<void> {
  const { error } = await createAdminClient().rpc("record_refund", {
    p_contribution_id: params.contributionId,
    p_stripe_refund_id: params.stripeRefundId,
    p_amount_cents: params.amountCents,
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

export async function getPoolBalanceCents(): Promise<number> {
  const { data, error } = await createAdminClient().rpc("get_pool_balance");
  if (error) throw error;
  return Number(data ?? 0);
}
