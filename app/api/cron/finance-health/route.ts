import { NextResponse } from "next/server";
import { authorizeCron } from "@/lib/cron-auth";
import { sendOpsAlert } from "@/lib/email";
import { describeError } from "@/lib/errors";
import { runFinanceHealthCheck } from "@/lib/finance-health";
import { getReconciliation, listStuckRefunds, listStuckSettlements } from "@/lib/finance";
import { backfillProcessorFees, realReconcileDeps } from "@/lib/stripe/reconcile-deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Daily money health check: reconciles stuck refunds, flags stuck payouts and ledger mismatches. */
export async function GET(request: Request) {
  const auth = authorizeCron(request);
  if (!auth.ok) return auth.response;

  try {
    const report = await runFinanceHealthCheck({
      listStuckRefunds,
      listStuckSettlements,
      reconcile: realReconcileDeps(),
      getReconciliation,
      backfillProcessorFees: () => backfillProcessorFees(25),
      sendAlert: sendOpsAlert,
      log: (message, detail) => console.error(`cron/finance-health: ${message}`, detail),
    });
    if (report.alerts.length > 0) {
      console.error("cron/finance-health: attention needed", report.alerts);
    }
    return NextResponse.json(report);
  } catch (error) {
    console.error("cron/finance-health: failed", describeError(error));
    return NextResponse.json({ error: "Finance health check failed." }, { status: 500 });
  }
}
