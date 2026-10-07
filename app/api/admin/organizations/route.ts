import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/guards";
import { createOrganization } from "@/lib/organization-store";

const organizationSchema = z.object({
  name: z.string().trim().min(2).max(200),
  mission: z.string().trim().max(300).optional().or(z.literal("")),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(60).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
}).strict();

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = organizationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please complete the required organization fields." }, { status: 400 });
  }

  const organization = parsed.data;
  await createOrganization({
    name: organization.name,
    mission: organization.mission || undefined,
    contactName: organization.contactName,
    email: organization.email,
    phone: organization.phone || undefined,
    city: organization.city || undefined,
    state: organization.state || undefined,
    website: organization.website || undefined,
    notes: organization.notes || undefined,
  });

  return NextResponse.json({ message: "Organization created successfully." });
}
