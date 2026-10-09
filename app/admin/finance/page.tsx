import type { Metadata } from "next";
import { AdminFeeSettingsForm } from "@/components/admin-fee-settings-form";
import { BackfillProcessorFeesButton, ReconcileRefundButton } from "@/components/admin-reconcile-buttons";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableShell } from "@/components/ui/table-shell";
import { requireRole } from "@/lib/auth/guards";
import { formatFeeRate } from "@/lib/fees";
import { getCurrentFeeRateBps, getFinanceSummary, getReconciliation, listFeeSettings, listRecentRefunds } from "@/lib/finance";
import { formatUsdFromCents } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Finance",
  description: "Operational fees, refunds, disputes and reconciliation.",
};

const refundBadge = { succeeded: "success", pending: "info", requested: "warning", failed: "destructive", canceled: "outline" } as const;

function Metric({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: "warning" }) {
  return (
    <Card className={tone === "warning" ? "border-warning/50" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-serif text-2xl font-semibold tabular-nums text-primary">{value}</p>
        {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  );
}

export default async function AdminFinancePage() {
  await requireRole("admin");
  const [summary, reconciliation, rateBps, history, refunds] = await Promise.all([
    getFinanceSummary(),
    getReconciliation(),
    getCurrentFeeRateBps(),
    listFeeSettings(10),
    listRecentRefunds(25),
  ]);
  const usd = formatUsdFromCents;
  const currentMonth = new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Honolulu", year: "numeric", month: "2-digit" }).slice(0, 7);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Admin"
        title="Finance"
        description="Donations and operational fees are tracked in separate ledgers. Every figure below is derived from the ledgers, not from running totals."
      />

      {reconciliation.ok ? (
        <Alert variant="success">Ledgers reconcile: every contribution matches its ledger entries.</Alert>
      ) : (
        <Alert variant="destructive">
          {reconciliation.issues.length} reconciliation issue(s) found. Do not issue refunds until these are reviewed:{" "}
          {reconciliation.issues.slice(0, 3).map((issue) => `${String(issue.check)} (${String(issue.contribution_id).slice(0, 8)})`).join(", ")}
        </Alert>
      )}

      <section className="space-y-3" aria-labelledby="ops">
        <h2 id="ops" className="font-serif text-2xl font-semibold text-primary">Operational revenue</h2>
        <p className="text-sm text-muted-foreground">
          The operational fee funds platform costs. It is never counted as a donation, and gross fees are not profit: Stripe&apos;s processing fees and dispute costs are
          deducted below.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Metric label="Operational fees charged" value={usd(summary.fees_charged_cents)} detail="From confirmed payments" />
          <Metric label="Operational fees refunded" value={usd(summary.fees_refunded_cents)} detail="Refunds and lost disputes" />
          <Metric label="Net fees retained" value={usd(summary.net_fees_retained_cents)} detail="Before expenses" />
          <Metric label="Payment processor fees" value={usd(summary.processor_fees_cents)} detail="Kept by Stripe, even after refunds" />
          <Metric label="Dispute costs" value={usd(summary.dispute_fees_cents)} detail="Dispute fees charged by Stripe" />
          <Metric label="Net operational revenue" value={usd(summary.net_operational_revenue_cents)} detail="After recorded expenses" />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="pool">
        <h2 id="pool" className="font-serif text-2xl font-semibold text-primary">Meal pool (donations)</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Metric label="Donations received" value={usd(summary.principal_credited_cents)} detail="Principal only, excludes fees" />
          <Metric label="Donations refunded" value={usd(summary.principal_refunded_cents)} detail={`Includes ${usd(summary.chargeback_principal_cents)} lost to chargebacks`} />
          <Metric label="Net donations" value={usd(summary.net_principal_cents)} />
          <Metric label="Pool balance" value={usd(summary.pool_balance_cents)} detail="Available for meals" tone={summary.pool_balance_cents < 0 ? "warning" : undefined} />
          <Metric label="Redeemed meal value" value={usd(summary.redeemed_value_cents)} />
          <Metric label="Eatery payouts" value={usd(summary.settlements_paid_cents)} detail={`${usd(summary.settlements_pending_cents)} pending`} />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="attention">
        <h2 id="attention" className="font-serif text-2xl font-semibold text-primary">Needs attention</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Metric
            label="Outstanding recovery obligations"
            value={usd(summary.outstanding_recovery_cents)}
            detail="Refunded or charged-back donations whose money had already been used for meals. Not recovered automatically."
            tone={summary.outstanding_recovery_cents > 0 ? "warning" : undefined}
          />
          <Metric
            label="Open disputes"
            value={String(summary.disputes_open_count)}
            detail={`${usd(summary.disputes_open_principal_cents)} donation + ${usd(summary.disputes_open_fee_cents)} fee at risk`}
            tone={summary.disputes_open_count > 0 ? "warning" : undefined}
          />
          <Metric
            label="Refunds in progress"
            value={String(summary.refunds_requested_count + summary.refunds_pending_count)}
            detail={`${summary.refunds_requested_count} awaiting Stripe, ${summary.refunds_pending_count} pending`}
            tone={summary.refunds_requested_count > 0 ? "warning" : undefined}
          />
          <Metric label="Unpaid checkouts" value={String(summary.pending_contributions_count)} detail={`${usd(summary.pending_contributions_total_cents)} not yet recognised`} />
        </div>
        <BackfillProcessorFeesButton />
      </section>

      <section className="space-y-3" aria-labelledby="fee">
        <h2 id="fee" className="font-serif text-2xl font-semibold text-primary">Operational fee setting</h2>
        <Card>
          <CardHeader>
            <CardTitle>Current fee: {formatFeeRate(rateBps)}</CardTitle>
            <CardDescription>Added on top of each donation. The donor sees it before paying, and the meal pool always receives the full donation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <AdminFeeSettingsForm currentRateBps={rateBps} />
            <TableShell minWidth="28rem">
              <thead className="bg-muted/70 text-muted-foreground">
                <tr><th className="px-4 py-3 font-medium">Effective</th><th className="px-4 py-3 font-medium">Rate</th><th className="px-4 py-3 font-medium">Reason</th></tr>
              </thead>
              <tbody className="divide-y">
                {history.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">{row.effective_at.startsWith("1970") ? "Launch default" : new Date(row.effective_at).toLocaleString("en-US", { timeZone: "Pacific/Honolulu" })}</td>
                    <td className="px-4 py-3 font-medium">{formatFeeRate(row.rate_bps)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3" aria-labelledby="statements">
        <h2 id="statements" className="font-serif text-2xl font-semibold text-primary">Monthly statements</h2>
        <Card>
          <CardHeader>
            <CardTitle>Download for your accountant</CardTitle>
            <CardDescription>CSV built from the ledgers in Hawaiʻi time: every entry, or a one-page summary of donations, fees, refunds, processing fees and dispute costs.</CardDescription>
          </CardHeader>
          <CardContent>
            <form method="get" action="/api/admin/finance/export" className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="statement-month">Month</Label>
                <Input id="statement-month" type="month" name="month" required defaultValue={currentMonth} max={currentMonth} className="w-48" />
              </div>
              <Button type="submit" name="view" value="summary">Summary CSV</Button>
              <Button type="submit" name="view" value="entries" variant="outline">All entries CSV</Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3" aria-labelledby="refunds">
        <h2 id="refunds" className="font-serif text-2xl font-semibold text-primary">Refunds</h2>
        {refunds.length === 0 ? (
          <EmptyState title="No refunds yet" />
        ) : (
          <TableShell minWidth="52rem">
            <thead className="bg-muted/70 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Requested</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Donation</th>
                <th className="px-4 py-3 font-medium">Fee</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Details</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {refunds.map((refund) => (
                <tr key={refund.id}>
                  <td className="px-4 py-3">{new Date(refund.requested_at).toLocaleString("en-US", { timeZone: "Pacific/Honolulu" })}</td>
                  <td className="px-4 py-3 font-medium tabular-nums">{usd(refund.amount_cents)}</td>
                  <td className="px-4 py-3 tabular-nums">{usd(refund.principal_cents)}</td>
                  <td className="px-4 py-3 tabular-nums">{usd(refund.fee_cents)}</td>
                  <td className="px-4 py-3"><Badge variant={refundBadge[refund.status]} className="capitalize">{refund.status}</Badge></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {refund.source === "external" ? "Created in Stripe · " : ""}
                    {refund.reason ?? "No reason given"}
                    {refund.failure_code ? ` · ${refund.failure_code}` : ""}
                    {refund.recovery_obligation_cents > 0 ? ` · recovery owed ${usd(refund.recovery_obligation_cents)}` : ""}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {refund.status === "requested" || refund.status === "pending" ? <ReconcileRefundButton refundId={refund.id} /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </section>
    </div>
  );
}
