import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Metadata } from "next";
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
  const [contributionsResult, activeQrsResult, redemptionsResult, eateriesResult, recentResult, balanceCents] =
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
      getPoolBalanceCents(),
    ]);

  if (
    contributionsResult.error || activeQrsResult.error || redemptionsResult.error ||
    eateriesResult.error || recentResult.error
  ) {
    throw new Error("Could not load admin metrics.");
  }

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
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Program overview</p>
        <h1 className="font-serif text-4xl">Kōkua Counter</h1>
      </div>
      {!hasData ? <p className="text-muted-foreground">No program activity yet.</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{metric.label}</CardTitle></CardHeader>
            <CardContent>
              <p className="font-serif text-3xl">{metric.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{metric.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Recent redemptions</h2>
        {!recentRedemptions.length ? (
          <p className="text-muted-foreground">No completed meals yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr><th className="px-4 py-3 font-medium">Time</th><th className="px-4 py-3 font-medium">Eatery</th><th className="px-4 py-3 text-right font-medium">Amount</th></tr>
              </thead>
              <tbody className="divide-y">
                {recentRedemptions.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">{new Date(item.redeemed_at).toLocaleString("en-US", { timeZone: "Pacific/Honolulu" })}</td>
                    <td className="px-4 py-3">{eateryNames.get(item.eatery_id) ?? "Participating eatery"}</td>
                    <td className="px-4 py-3 text-right">{formatUsdFromCents(item.amount_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}