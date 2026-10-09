import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guards";
import { toCsv } from "@/lib/csv";
import { listOrganizations } from "@/lib/organization-store";
import { recordAdminAction } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiRole("admin");
  if (!auth.ok) {
    return auth.response;
  }

  const organizations = await listOrganizations();
  const csv = toCsv(organizations, [
    { key: "name", header: "Name" },
    { key: "mission", header: "Mission" },
    { key: "contactName", header: "Contact name" },
    { key: "email", header: "Email" },
    { key: "phone", header: "Phone" },
    { key: "city", header: "City" },
    { key: "state", header: "State" },
    { key: "website", header: "Website" },
    { key: "notes", header: "Notes" },
    { key: "createdAt", header: "Created at" },
  ]);

  await recordAdminAction({ actorId: auth.user.id, action: "export.organizations", details: { rows: organizations.length } });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"organizations.csv\"",
    },
  });
}
