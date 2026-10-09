import type { ReactNode } from "react";
import { AdminNav } from "@/components/admin-nav";
import { requireRole } from "@/lib/auth/guards";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireRole("admin");
  return (
    <div className="space-y-8">
      <AdminNav />
      {children}
    </div>
  );
}
