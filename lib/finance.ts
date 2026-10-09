import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import type { RefundDeps, ReserveResult } from "@/lib/refunds";

function asObject(value: Json | null): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  throw new Error("unexpected_rpc_payload");
}

export async function getCurrentFeeRateBps(): Promise<number> {
  const { data, error } = await createAdminClient().rpc("current_fee_rate_bps", {});
  if (error) throw error;
  if (typeof data !== "number") throw new Error("fee_not_configured");
  return data;
}

export type CreatedContribution =
  | {
      ok: true;
      replay: boolean;
      contributionId: string;
      principalCents: number;
      operationalFeeCents: number;
      totalChargedCents: number;
      feeRateBps: number;
      status: string;
      stripeCheckoutSessionId: string | null;
    }
  | { ok: false; errorCode: string };

/** Creates a pending contribution; the database calculates and snapshots the fee. */
export async function createContribution(params: {
  donorUserId: string | null;
  principalCents: number;
  isAnonymous: boolean;
  requestKey: string | null;
}): Promise<CreatedContribution> {
  const { data, error } = await createAdminClient().rpc("create_contribution", {
    p_donor_user_id: params.donorUserId,
    p_principal_cents: params.principalCents,
    p_is_anonymous: params.isAnonymous,
    p_client_request_key: params.requestKey,
  });
  if (error) throw error;
  const payload = asObject(data);
  if (payload.ok !== true) return { ok: false, errorCode: String(payload.error_code) };
  return {
    ok: true,
    replay: payload.replay === true,
    contributionId: String(payload.contribution_id),
    principalCents: Number(payload.principal_cents),
    operationalFeeCents: Number(payload.operational_fee_cents),
    totalChargedCents: Number(payload.total_charged_cents),
    feeRateBps: Number(payload.fee_rate_bps),
    status: String(payload.status),
    stripeCheckoutSessionId: payload.stripe_checkout_session_id ? String(payload.stripe_checkout_session_id) : null,
  };
}

export async function setOperationalFeeRate(params: {
  rateBps: number;
  effectiveAt: string | null;
  createdBy: string;
  note: string | null;
}): Promise<{ ok: true } | { ok: false; errorCode: string }> {
  const { data, error } = await createAdminClient().rpc("set_operational_fee_rate", {
    p_rate_bps: params.rateBps,
    p_effective_at: params.effectiveAt,
    p_created_by: params.createdBy,
    p_note: params.note,
  });
  if (error) throw error;
  const payload = asObject(data);
  return payload.ok === true ? { ok: true } : { ok: false, errorCode: String(payload.error_code) };
}

export async function listFeeSettings(limit = 20) {
  const { data, error } = await createAdminClient()
    .from("fee_settings")
    .select("id, rate_bps, effective_at, note, created_at")
    .order("effective_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function recordProcessorFee(params: {
  contributionId: string;
  paymentIntentId: string;
  feeCents: number;
  balanceTransactionId: string | null;
}): Promise<void> {
  const { error } = await createAdminClient().rpc("record_processor_fee", {
    p_contribution_id: params.contributionId,
    p_payment_intent_id: params.paymentIntentId,
    p_fee_cents: params.feeCents,
    p_balance_transaction_id: params.balanceTransactionId,
  });
  if (error) throw error;
}

export async function recordDisputeOpened(params: {
  contributionId: string;
  stripeDisputeId: string;
  amountCents: number;
  reason: string | null;
  stripeStatus: string | null;
  disputeFeeCents: number;
}): Promise<void> {
  const { error } = await createAdminClient().rpc("record_dispute_opened", {
    p_contribution_id: params.contributionId,
    p_stripe_dispute_id: params.stripeDisputeId,
    p_amount_cents: params.amountCents,
    p_reason: params.reason,
    p_stripe_status: params.stripeStatus,
    p_dispute_fee_cents: params.disputeFeeCents,
  });
  if (error) throw error;
}

export async function recordDisputeClosed(params: {
  stripeDisputeId: string;
  outcome: "won" | "lost";
  disputeFeeCents: number | null;
}): Promise<void> {
  const { error } = await createAdminClient().rpc("record_dispute_closed", {
    p_stripe_dispute_id: params.stripeDisputeId,
    p_outcome: params.outcome,
    p_dispute_fee_cents: params.disputeFeeCents,
  });
  if (error) throw error;
}

export type FinanceSummary = {
  principal_credited_cents: number;
  principal_refunded_cents: number;
  net_principal_cents: number;
  chargeback_principal_cents: number;
  fees_charged_cents: number;
  fees_refunded_cents: number;
  net_fees_retained_cents: number;
  processor_fees_cents: number;
  dispute_fees_cents: number;
  net_operational_revenue_cents: number;
  pool_balance_cents: number;
  redeemed_value_cents: number;
  settlements_paid_cents: number;
  settlements_pending_cents: number;
  pending_contributions_count: number;
  pending_contributions_total_cents: number;
  refunds_requested_count: number;
  refunds_pending_count: number;
  refunds_succeeded_count: number;
  refunds_failed_count: number;
  outstanding_recovery_cents: number;
  disputes_open_count: number;
  disputes_open_principal_cents: number;
  disputes_open_fee_cents: number;
};

export async function getFinanceSummary(): Promise<FinanceSummary> {
  const { data, error } = await createAdminClient().rpc("finance_summary", {});
  if (error) throw error;
  return asObject(data) as unknown as FinanceSummary;
}

export type ReconciliationReport = { ok: boolean; issues: Array<Record<string, unknown>> };

export async function getReconciliation(): Promise<ReconciliationReport> {
  const { data, error } = await createAdminClient().rpc("finance_reconciliation", {});
  if (error) throw error;
  const payload = asObject(data);
  return { ok: payload.ok === true, issues: Array.isArray(payload.issues) ? (payload.issues as Array<Record<string, unknown>>) : [] };
}

export async function listRecentRefunds(limit = 25) {
  const { data, error } = await createAdminClient()
    .from("refunds")
    .select(
      "id, contribution_id, source, status, amount_cents, principal_cents, fee_cents, reason, stripe_refund_id, failure_code, recovery_obligation_cents, requested_at, completed_at",
    )
    .order("requested_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listContributionsMissingProcessorFee(limit = 25) {
  const { data, error } = await createAdminClient().rpc("contributions_missing_processor_fee", { p_limit: limit });
  if (error) throw error;
  return data ?? [];
}

/** Database-backed implementations of the refund workflow's dependencies. */
export function databaseRefundDeps(): Pick<RefundDeps, "reserveRefund" | "markRefundSubmitted" | "markRefundFailed"> {
  return {
    async reserveRefund(params) {
      const { data, error } = await createAdminClient().rpc("reserve_refund", {
        p_contribution_id: params.contributionId,
        p_amount_cents: params.amountCents,
        p_reason: params.reason,
        p_requested_by: params.requestedBy,
        p_idempotency_ref: params.idempotencyRef,
      });
      if (error) throw error;
      return asObject(data) as unknown as ReserveResult;
    },
    async markRefundSubmitted(refundId, stripeRefundId) {
      const { error } = await createAdminClient().rpc("mark_refund_submitted", {
        p_refund_id: refundId,
        p_stripe_refund_id: stripeRefundId,
      });
      if (error) throw error;
    },
    async markRefundFailed(refundId, code, detail) {
      const { error } = await createAdminClient().rpc("mark_refund_failed", {
        p_refund_id: refundId,
        p_failure_code: code,
        p_failure_detail: detail,
      });
      if (error) throw error;
    },
  };
}
