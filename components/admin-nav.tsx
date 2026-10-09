"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/finance", label: "Finance" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/eateries", label: "Eateries" },
  { href: "/admin/organizations", label: "Organizations" },
  { href: "/admin/registrations", label: "School registrations" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="-mx-1 flex gap-1 overflow-x-auto border-b pb-3">
      {items.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-foreground/75 hover:bg-secondary hover:text-primary",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
