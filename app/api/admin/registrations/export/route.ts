import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guards";
import { toCsv } from "@/lib/csv";
import { listSchoolRegistrations } from "@/lib/organization-store";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireApiRole("admin");
  if (!auth.ok) {
    return auth.response;
  }

  const registrations = await listSchoolRegistrations();
  const csv = toCsv(registrations, [
    { key: "schoolName", header: "School name" },
    { key: "contactName", header: "Contact name" },
    { key: "email", header: "Email" },
    { key: "phone", header: "Phone" },
    { key: "schoolType", header: "School type" },
    { key: "students", header: "Estimated students" },
    { key: "city", header: "City" },
    { key: "state", header: "State" },
    { key: "message", header: "Message" },
    { key: "createdAt", header: "Submitted at" },
  ]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"school-registrations.csv\"",
    },
  });
}
