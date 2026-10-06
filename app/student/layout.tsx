import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/guards";

export default async function StudentLayout({ children }: { children: ReactNode }) {
  await requireRole("student");
  return children;
}