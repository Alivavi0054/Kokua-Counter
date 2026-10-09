import type { Metadata } from "next";
import { AdminCreateEateryForm } from "@/components/admin-create-eatery-form";
import { AdminEateriesTable } from "@/components/admin-eateries-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Eateries",
  description: "Manage participating eateries for Kōkua Counter.",
};

export default async function AdminEateriesPage() {
  await requireRole("admin");
  const admin = createAdminClient();
  const { data: eateries, error } = await admin
    .from("eateries")
    .select("id, name, island, address, contact_email, is_active, stripe_connect_account_id, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Could not load eateries.");
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Admin" title="Eateries" description="Add participating eateries, manage access and settle payouts." />

      <AdminCreateEateryForm />

      {!eateries?.length ? (
        <EmptyState title="No eateries yet">Create the first participating eatery with the form above.</EmptyState>
      ) : (
        <AdminEateriesTable eateries={eateries} />
      )}
    </div>
  );
}
