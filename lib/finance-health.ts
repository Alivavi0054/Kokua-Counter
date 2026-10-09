import { describeError } from "@/lib/errors";
import { reconcileRefund, type ReconcileDeps, type RefundRow } from "@/lib/refund-reconcile";

export type StuckSettlement = { id: string; eatery_id: string; amount_cents: number; created_at: string };

export type FinanceHealthDeps = {
  listStuckRefunds: (olderThanMinutes: number) => Promise<RefundRow[]>;
  listStuckSettlements: (olderThanMinutes: number) => Promise<StuckSettlement[]>;
  reconcile: ReconcileDeps;
  getReconciliation: () => Promise<{ ok: boolean; issues: Array<Record<string, unknown>> }>;
  backfillProcessorFees: () => Promise<{ checked: number; recorded: number; unavailable: number }>;
  sendAlert: (subject: string, lines: string[]) => Promise<unknown>;
  log?: (message: string, detail?: Record<string, unknown>) => void;
};

export type FinanceHealthReport = {
  refunds: { examined: number; synced: number; resubmitted: number; unresolved: number; errors: number };
  settlements_stuck: number;
  reconciliation_issues: number;
  processor_fees: { checked: number; recorded: number; unavailable: number } | null;
  alerts: string[];
};

const STUCK_AFTER_MINUTES = 15;
const SETTLEMENT_STUCK_AFTER_MINUTES = 30;

/**
 * Daily money health check. It only takes actions that are safe to repeat (re-reading refunds from
 * Stripe, re-submitting with the same idempotency key, booking processing fees). Anything that could
 * move money, such as a settlement left in "processing", is only reported for a human to resolve.
 */
export async function runFinanceHealthCheck(deps: FinanceHealthDeps): Promise<FinanceHealthReport> {
  const log = deps.log ?? (() => {});
  const alerts: string[] = [];
  const report: FinanceHealthReport = {
    refunds: { examined: 0, synced: 0, resubmitted: 0, unresolved: 0, errors: 0 },
    settlements_stuck: 0,
    reconciliation_issues: 0,
    processor_fees: null,
    alerts,
  };

  const stuckRefunds = await deps.listStuckRefunds(STUCK_AFTER_MINUTES);
  report.refunds.examined = stuckRefunds.length;
  for (const refund of stuckRefunds) {
    try {
      const result = await reconcileRefund(refund, deps.reconcile);
      if (result.outcome === "synced") report.refunds.synced += 1;
      else if (result.outcome === "resubmitted") report.refunds.resubmitted += 1;
      else if (result.outcome === "unresolved") {
        report.refunds.unresolved += 1;
        alerts.push(`Refund ${refund.id} (${refund.amount_cents} cents) could not be confirmed with Stripe.`);
      }
    } catch (error) {
      report.refunds.errors += 1;
      log("refund reconciliation failed", { refundId: refund.id, error: describeError(error) });
      alerts.push(`Refund ${refund.id} could not be reconciled: ${describeError(error)}`);
    }
  }

  const stuckSettlements = await deps.listStuckSettlements(SETTLEMENT_STUCK_AFTER_MINUTES);
  report.settlements_stuck = stuckSettlements.length;
  for (const settlement of stuckSettlements) {
    alerts.push(
      `Settlement ${settlement.id} (${settlement.amount_cents} cents, eatery ${settlement.eatery_id}) has been "processing" since ${settlement.created_at}. ` +
        "Check Stripe for the transfer before retrying; do not settle that eatery again until it is resolved.",
    );
  }

  const reconciliation = await deps.getReconciliation();
  report.reconciliation_issues = reconciliation.issues.length;
  if (!reconciliation.ok) {
    alerts.push(`${reconciliation.issues.length} ledger reconciliation issue(s): ${JSON.stringify(reconciliation.issues.slice(0, 3))}`);
  }

  try {
    report.processor_fees = await deps.backfillProcessorFees();
  } catch (error) {
    log("processor fee backfill failed", { error: describeError(error) });
  }

  if (alerts.length > 0) {
    log("finance health check found problems", { count: alerts.length });
    try {
      await deps.sendAlert(`Finance check: ${alerts.length} item(s) need attention`, alerts);
    } catch (error) {
      log("could not send alert", { error: describeError(error) });
    }
  }
  return report;
}
