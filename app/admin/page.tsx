import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableShell } from "@/components/ui/table-shell";
import type { Metadata } from "next";
import { RefundContributionButton } from "@/components/admin-refund-button";
import { requireRole } from "@/lib/auth/guards";
import { formatUsdFromCents } from "@/lib/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import { expireStaleQrs, getPoolBalanceCents } from "@/lib/ledger";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin overview",
  description: "Current pool and meal activity for Kōkua Counter administrators.",
};

export default async function AdminPage() {
  await requireRole("admin");
  await expireStaleQrs();

  const admin = createAdminClient();
  const [contributionsResult, activeQrsResult, redemptionsResult, eateriesResult, recentResult, recentContributionsResult, balanceCents] =
    await Promise.all([
      admin
        .from("contributions")
        .select("amount_cents, refunded_amount_cents")
        .in("status", ["completed", "refunded"]),
      admin
        .from("qr_codes")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      admin
        .from("redemptions")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed"),
      admin
        .from("eateries")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      admin
        .from("redemptions")
        .select("id, eatery_id, amount_cents, redeemed_at")
        .eq("status", "completed")
        .order("redeemed_at", { ascending: false })
        .limit(8),
      admin
        .from("contributions")
        .select("id, amount_cents, refunded_amount_cents, status, created_at")
        .in("status", ["completed", "refunded"])
        .order("created_at", { ascending: false })
        .limit(8),
      getPoolBalanceCents(),
    ]);

  if (
    contributionsResult.error || activeQrsResult.error || redemptionsResult.error ||
    eateriesResult.error || recentResult.error || recentContributionsResult.error
  ) {
    throw new Error("Could not load admin metrics.");
  }

  const recentContributions = recentContributionsResult.data ?? [];

  const contributions = contributionsResult.data ?? [];
  const grossCents = contributions.reduce((total, item) => total + item.amount_cents, 0);
  const refundedCents = contributions.reduce((total, item) => total + item.refunded_amount_cents, 0);
  const netCents = grossCents - refundedCents;
  const activeQrCount = activeQrsResult.count ?? 0;
  const completedMealCount = redemptionsResult.count ?? 0;
  const activeEateryCount = eateriesResult.count ?? 0;
  const recentRedemptions = recentResult.data ?? [];
  const recentEateryIds = Array.from(new Set(recentRedemptions.map((item) => item.eatery_id)));
  const { data: recentEateries, error: recentEateriesError } = recentEateryIds.length
    ? await admin.from("eateries").select("id, name").in("id", recentEateryIds)
    : { data: [], error: null };
  if (recentEateriesError) throw new Error("Could not load recent redemptions.");
  const eateryNames = new Map<string, string>(
    (recentEateries ?? []).map((item) => [item.id, item.name] as const),
  );
  const metrics = [
    { label: "Gross contributions", value: formatUsdFromCents(grossCents), detail: "Completed payments" },
    { label: "Total refunded", value: formatUsdFromCents(refundedCents), detail: "Refunds recorded by Stripe" },
    { label: "Net contributions", value: formatUsdFromCents(netCents), detail: "Gross less refunds" },
    { label: "Active holds", value: formatUsdFromCents(activeQrCount * 800), detail: `${activeQrCount} active meal passes` },
    { label: "Redeemed value", value: formatUsdFromCents(completedMealCount * 800), detail: `${completedMealCount} completed meals` },
    { label: "Pool balance", value: formatUsdFromCents(balanceCents), detail: "Append-only ledger sum" },
    { label: "Funding deficit", value: formatUsdFromCents(Math.max(0, -balanceCents)), detail: "Amount below zero" },
    { label: "Active QRs", value: String(activeQrCount), detail: "Unexpired meal passes" },
    { label: "Completed meals", value: String(completedMealCount), detail: "All participating eateries" },
    { label: "Active eateries", value: String(activeEateryCount), detail: "Currently participating" },
  ];

  const hasData = grossCents > 0 || refundedCents > 0 || activeQrCount > 0 ||
    completedMealCount > 0 || activeEateryCount > 0;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Program overview"
        title="Kōkua Counter"
        description="Current pool, meal activity and contributions."
      />
      {!hasData ? <EmptyState title="No program activity yet">Contributions and redeemed meals will show up here.</EmptyState> : null}
      <section aria-label="Key metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle></CardHeader>
            <CardContent>
              <p className="font-serif text-3xl font-semibold text-primary">{metric.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{metric.detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-semibold text-primary">Recent redemptions</h2>
        {!recentRedemptions.length ? (
          <EmptyState title="No completed meals yet" />
        ) : (
          <TableShell>
            <thead className="bg-muted/70 text-muted-foreground">
              <tr><th className="px-4 py-3 font-medium">Time</th><th className="px-4 py-3 font-medium">Eatery</th><th className="px-4 py-3 text-right font-medium">Amount</th></tr>
            </thead>
            <tbody className="divide-y">
              {recentRedemptions.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">{new Date(item.redeemed_at).toLocaleString("en-US", { timeZone: "Pacific/Honolulu" })}</td>
                  <td className="px-4 py-3">{eateryNames.get(item.eatery_id) ?? "Participating eatery"}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatUsdFromCents(item.amount_cents)}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-semibold text-primary">Recent contributions</h2>
        {!recentContributions.length ? (
          <EmptyState title="No contributions yet" />
        ) : (
          <TableShell>
            <thead className="bg-muted/70 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Refunded</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentContributions.map((item) => {
                const remaining = item.amount_cents - item.refunded_amount_cents;
                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3">{new Date(item.created_at).toLocaleString("en-US", { timeZone: "Pacific/Honolulu" })}</td>
                    <td className="px-4 py-3 font-medium">{formatUsdFromCents(item.amount_cents)}</td>
                    <td className="px-4 py-3">{formatUsdFromCents(item.refunded_amount_cents)}</td>
                    <td className="px-4 py-3 text-right">
                      {remaining > 0 ? (
                        <RefundContributionButton contributionId={item.id} />
                      ) : (
                        <Badge variant="outline">Fully refunded</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </section>
    </div>
  );
}
