import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/guards";

export default async function EateryLayout({ children }: { children: ReactNode }) {
  await requireRole("eatery");
  return children;
}