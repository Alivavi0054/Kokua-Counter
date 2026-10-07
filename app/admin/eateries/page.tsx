import type { Metadata } from "next";
import { AdminEateriesTable } from "@/components/admin-eateries-table";
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
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Admin tools</p>
        <h1 className="font-serif text-4xl">Eateries</h1>
      </div>

      {!eateries?.length ? (
        <p className="text-muted-foreground">No eateries have been created yet.</p>
      ) : (
        <AdminEateriesTable eateries={eateries} />
      )}
    </div>
  );
}
