import "server-only";
import { describeError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/** Every audited admin action. Add new ones here so the history stays searchable by a fixed vocabulary. */
export type AdminAction =
  | "fee.rate_changed"
  | "user.created"
  | "user.activated"
  | "user.deactivated"
  | "eatery.created"
  | "eatery.activated"
  | "eatery.deactivated"
  | "organization.created"
  | "refund.started"
  | "refund.reconciled"
  | "settlement.paid"
  | "settlement.failed"
  | "settlement.needs_reconciliation"
  | "finance.processor_fees_backfilled"
  | "export.organizations"
  | "export.registrations"
  | "export.finance";

/**
 * Records an admin action in the append-only audit log. Details must be small and non-sensitive:
 * ids, amounts and states, never passwords, tokens, emails or card data.
 *
 * Best effort by design: an audit-table outage must not block an admin from fixing a real problem,
 * but the failure is logged loudly so it can be investigated.
 */
export async function recordAdminAction(params: {
  actorId: string;
  action: AdminAction;
  targetType?: string;
  targetId?: string;
  details?: Record<string, Json | undefined>;
}): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from("admin_audit_log")
      .insert({
        actor_user_id: params.actorId,
        action: params.action,
        target_type: params.targetType ?? null,
        target_id: params.targetId ?? null,
        details: (params.details as Json) ?? null,
      });
    if (error) throw error;
  } catch (error) {
    console.error("audit: could not record admin action", params.action, describeError(error));
  }
}
