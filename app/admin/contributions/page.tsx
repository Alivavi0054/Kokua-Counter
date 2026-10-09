import type { Metadata } from "next";
import { RefundContributionButton } from "@/components/admin-refund-button";
import { EmptyState } from "@/components/empty-state";
import { ListSearch, Pagination } from "@/components/list-controls";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { TableShell } from "@/components/ui/table-shell";
import { requireRole } from "@/lib/auth/guards";
import { PAGE_SIZE, pageRange, parseListParams, totalPages } from "@/lib/pagination";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatUsdFromCents } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Contributions",
  description: "Every donation with its operational fee, refunds and status.",
};

const STATUSES = ["pending", "completed", "refunded", "failed"] as const;
const statusBadge = { pending: "info", completed: "success", refunded: "outline", failed: "destructive" } as const;

export default async function AdminContributionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  await requireRole("admin");
  const raw = await searchParams;
  const { page } = parseListParams(raw);
  const status = STATUSES.find((candidate) => candidate === raw.status) ?? "";
  const { from, to } = pageRange(page);

  let query = createAdminClient()
    .from("contributions")
    .select(
      "id, amount_cents, operational_fee_cents, total_charged_cents, fee_rate_bps, refunded_amount_cents, fee_refunded_cents, status, failure_reason, created_at",
      { count: "exact" },
    );
  if (status) query = query.eq("status", status);
  const { data: contributions, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) throw new Error("Could not load contributions.");
  const total = count ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Contributions"
        description="Each donation with the operational fee charged on top. Refunds reverse the donation and fee proportionally."
      />
      <div className="space-y-4">
        <ListSearch
          q=""
          searchable={false}
          placeholder="Filter by status"
          clearHref="/admin/contributions"
          filter={{ name: "status", value: status, allLabel: "All statuses", options: STATUSES.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) })) }}
        />
        {!contributions?.length ? (
          <EmptyState title="No contributions match" />
        ) : (
          <TableShell minWidth="52rem">
            <thead className="bg-muted/70 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date (Hawaiʻi)</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Donation</th>
                <th className="px-4 py-3 font-medium">Fee</th>
                <th className="px-4 py-3 font-medium">Total charged</th>
                <th className="px-4 py-3 font-medium">Refunded</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {contributions.map((item) => {
                const remaining = item.total_charged_cents - item.refunded_amount_cents - item.fee_refunded_cents;
                const refundable = (item.status === "completed" || item.status === "refunded") && remaining > 0;
                return (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap px-4 py-3">{new Date(item.created_at).toLocaleString("en-US", { timeZone: "Pacific/Honolulu" })}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadge[item.status]} className="capitalize" title={item.failure_reason ?? undefined}>{item.status}</Badge>
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">{formatUsdFromCents(item.amount_cents)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatUsdFromCents(item.operational_fee_cents)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatUsdFromCents(item.total_charged_cents)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatUsdFromCents(item.refunded_amount_cents + item.fee_refunded_cents)}</td>
                    <td className="px-4 py-3 text-right">
                      {refundable ? (
                        <RefundContributionButton
                          contributionId={item.id}
                          donationCents={item.amount_cents}
                          feeCents={item.operational_fee_cents}
                          refundedDonationCents={item.refunded_amount_cents}
                          refundedFeeCents={item.fee_refunded_cents}
                        />
                      ) : item.status === "refunded" ? (
                        <Badge variant="outline">Fully refunded</Badge>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
        <Pagination basePath="/admin/contributions" page={page} pages={totalPages(total, PAGE_SIZE)} total={total} params={{ status }} />
      </div>
    </div>
  );
}
