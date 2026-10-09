import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { TableShell } from "@/components/ui/table-shell";
import { ListSearch, Pagination } from "@/components/list-controls";
import { requireRole } from "@/lib/auth/guards";
import { pageRange, parseListParams, totalPages } from "@/lib/pagination";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Audit log",
  description: "Who changed what in the Kōkua Counter admin tools.",
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  await requireRole("admin");
  const { page, q } = parseListParams(await searchParams);
  const { from, to } = pageRange(page, 50);
  const admin = createAdminClient();
  let query = admin
    .from("admin_audit_log")
    .select("id, actor_user_id, action, target_type, target_id, details, created_at", { count: "exact" });
  if (q) query = query.ilike("action", `%${q}%`);
  const { data: entries, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) throw new Error("Could not load the audit log.");

  const actorIds = Array.from(new Set((entries ?? []).map((entry) => entry.actor_user_id)));
  const { data: actors } = actorIds.length
    ? await admin.from("users").select("id, display_name").in("id", actorIds)
    : { data: [] };
  const names = new Map((actors ?? []).map((actor) => [actor.id, actor.display_name] as const));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Audit log"
        description="A permanent, append-only record of fee changes, refunds, payouts, account changes and exports. Search by action, for example “refund” or “fee”."
      />
      <ListSearch q={q} placeholder="Filter by action (e.g. refund)" clearHref="/admin/audit" />
      {!entries?.length ? (
        <EmptyState title="Nothing recorded yet">Admin actions will appear here as they happen.</EmptyState>
      ) : (
        <TableShell minWidth="48rem">
          <thead className="bg-muted/70 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">When (Hawaiʻi)</th>
              <th className="px-4 py-3 font-medium">Who</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Target</th>
              <th className="px-4 py-3 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((entry) => (
              <tr key={entry.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-3">{new Date(entry.created_at).toLocaleString("en-US", { timeZone: "Pacific/Honolulu" })}</td>
                <td className="px-4 py-3">{names.get(entry.actor_user_id) ?? "Removed account"}</td>
                <td className="px-4 py-3"><Badge variant="secondary">{entry.action}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground">
                  {entry.target_type ?? "—"}
                  {entry.target_id ? <span className="block max-w-40 truncate font-mono text-xs">{entry.target_id}</span> : null}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{entry.details ? JSON.stringify(entry.details) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}
      <Pagination basePath="/admin/audit" page={page} pages={totalPages(count ?? 0, 50)} total={count ?? 0} params={{ q }} />
    </div>
  );
}
