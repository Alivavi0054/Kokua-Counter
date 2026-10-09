"use client";

import { useMemo, useState } from "react";
import { UserActiveToggle } from "@/components/admin-user-toggle";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { TableShell } from "@/components/ui/table-shell";

type AdminUserRow = {
  id: string;
  role: string;
  display_name: string;
  is_active: boolean;
};

export function AdminUsersTable({ users, currentUserId }: { users: AdminUserRow[]; currentUserId: string }) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesTerm = !term || user.display_name.toLowerCase().includes(term);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      return matchesTerm && matchesRole;
    });
  }, [users, query, roleFilter]);

  const roles = useMemo(() => Array.from(new Set(users.map((user) => user.role))), [users]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="max-w-sm"
          aria-label="Search users"
        />
        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          className="h-11 rounded-lg border border-input bg-card px-3 text-sm shadow-sm"
          aria-label="Filter by role"
        >
          <option value="all">All roles</option>
          {roles.map((role) => (
            <option key={role} value={role} className="capitalize">
              {role}
            </option>
          ))}
        </select>
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="No users match your search" />
      ) : (
        <TableShell minWidth="36rem">
            <thead className="bg-muted/70 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium text-foreground">{user.display_name}</td>
                  <td className="px-4 py-3"><Badge variant={user.role === "admin" ? "default" : "secondary"} className="capitalize">{user.role}</Badge></td>
                  <td className="px-4 py-3">
                    <Badge variant={user.is_active ? "success" : "outline"}>
                      {user.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {user.id === currentUserId ? (
                      <span className="text-xs text-muted-foreground">This is you</span>
                    ) : (
                      <UserActiveToggle userId={user.id} isActive={user.is_active} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
        </TableShell>
      )}
    </div>
  );
}
