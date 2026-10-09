import type { Metadata } from "next";
import { AdminCreateEateryForm } from "@/components/admin-create-eatery-form";
import { AdminEateriesTable } from "@/components/admin-eateries-table";
import { EmptyState } from "@/components/empty-state";
import { ListSearch, Pagination } from "@/components/list-controls";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth/guards";
import { orIlike, PAGE_SIZE, pageRange, parseListParams, totalPages } from "@/lib/pagination";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Eateries",
  description: "Manage participating eateries for Kōkua Counter.",
};

export default async function AdminEateriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  await requireRole("admin");
  const { page, q } = parseListParams(await searchParams);
  const { from, to } = pageRange(page);

  let query = createAdminClient()
    .from("eateries")
    .select("id, name, island, address, contact_email, is_active, stripe_connect_account_id, created_at", { count: "exact" });
  if (q) query = query.or(orIlike(["name", "island", "address", "contact_email"], q));
  const { data: eateries, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) throw new Error("Could not load eateries.");

  const total = count ?? 0;
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Admin" title="Eateries" description="Add participating eateries, manage access and settle payouts." />

      <AdminCreateEateryForm />

      <div className="space-y-4">
        <ListSearch q={q} placeholder="Search by name, island, address or email" clearHref="/admin/eateries" />
        {!eateries?.length ? (
          <EmptyState title={q ? "No eateries match your search" : "No eateries yet"}>
            {q ? undefined : "Create the first participating eatery with the form above."}
          </EmptyState>
        ) : (
          <AdminEateriesTable eateries={eateries} />
        )}
        <Pagination basePath="/admin/eateries" page={page} pages={totalPages(total, PAGE_SIZE)} total={total} params={{ q }} />
      </div>
    </div>
  );
}
