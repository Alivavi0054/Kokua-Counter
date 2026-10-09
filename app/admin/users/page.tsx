import type { Metadata } from "next";
import { AdminCreateUserForm } from "@/components/admin-create-user-form";
import { AdminUsersTable } from "@/components/admin-users-table";
import { EmptyState } from "@/components/empty-state";
import { ListSearch, Pagination } from "@/components/list-controls";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { PAGE_SIZE, pageRange, parseListParams, totalPages } from "@/lib/pagination";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Users",
  description: "Manage Kōkua Counter user accounts.",
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; role?: string }>;
}) {
  const current = await requireRole("admin");
  const raw = await searchParams;
  const { page, q } = parseListParams(raw);
  const role = USER_ROLES.find((candidate) => candidate === raw.role) ?? "";

  const { from, to } = pageRange(page);
  let query = createAdminClient().from("users").select("id, role, display_name, is_active, created_at", { count: "exact" });
  if (q) query = query.ilike("display_name", `%${q}%`);
  if (role) query = query.eq("role", role);
  const { data: users, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) throw new Error("Could not load users.");

  const total = count ?? 0;
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Admin" title="Users" description="Create accounts and activate or deactivate access." />

      <AdminCreateUserForm />

      <div className="space-y-4">
        <ListSearch
          q={q}
          placeholder="Search by name"
          clearHref="/admin/users"
          filter={{ name: "role", value: role, allLabel: "All roles", options: USER_ROLES.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) })) }}
        />
        {!users?.length ? (
          <EmptyState title={q || role ? "No users match your search" : "No users yet"} />
        ) : (
          <AdminUsersTable users={users} currentUserId={current.id} />
        )}
        <Pagination basePath="/admin/users" page={page} pages={totalPages(total, PAGE_SIZE)} total={total} params={{ q, role }} />
      </div>
    </div>
  );
}
