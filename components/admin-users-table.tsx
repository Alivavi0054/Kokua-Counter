import { UserActiveToggle } from "@/components/admin-user-toggle";
import { Badge } from "@/components/ui/badge";
import { TableShell } from "@/components/ui/table-shell";

type AdminUserRow = {
  id: string;
  role: string;
  display_name: string;
  is_active: boolean;
};

export function AdminUsersTable({ users, currentUserId }: { users: AdminUserRow[]; currentUserId: string }) {
  return (
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
              {users.map((user) => (
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
  );
}
