import type { Metadata } from "next";
import { AdminUsersTable } from "@/components/admin-users-table";
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
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">Admin tools</p>
        <h1 className="font-serif text-4xl">Users</h1>
      </div>

      {!users?.length ? (
        <p className="text-muted-foreground">No users yet.</p>
      ) : (
        <AdminUsersTable users={users} currentUserId={current.id} />
      )}
    </div>
  );
}
