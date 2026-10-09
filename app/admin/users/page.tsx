import type { Metadata } from "next";
import { AdminCreateUserForm } from "@/components/admin-create-user-form";
import { AdminUsersTable } from "@/components/admin-users-table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Users",
  description: "Manage Kōkua Counter user accounts.",
};

export default async function AdminUsersPage() {
  const current = await requireRole("admin");
  const admin = createAdminClient();
  const { data: users, error } = await admin
    .from("users")
    .select("id, role, display_name, is_active, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error("Could not load users.");
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Admin" title="Users" description="Create accounts and activate or deactivate access." />

      <AdminCreateUserForm />

      {!users?.length ? (
        <EmptyState title="No users yet" />
      ) : (
        <AdminUsersTable users={users} currentUserId={current.id} />
      )}
    </div>
  );
}
