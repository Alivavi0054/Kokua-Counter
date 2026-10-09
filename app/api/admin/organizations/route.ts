import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/guards";
import { describeError } from "@/lib/errors";
import { createOrganization } from "@/lib/organization-store";
import { rateLimit } from "@/lib/rate-limit";

const organizationSchema = z.object({
  name: z.string().trim().min(2).max(200),
  mission: z.string().trim().max(300).optional().or(z.literal("")),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(60).optional().or(z.literal("")),
  website: z.string().trim().url().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
}).strict();

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) {
    return auth.response;
  }

  const limited = rateLimit(`admin-org-create:${auth.user.id}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
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
  try {
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
  } catch (error) {
    console.error("admin/organizations: create failed", describeError(error));
    return NextResponse.json({ error: "Could not create the organization." }, { status: 500 });
  }

  return NextResponse.json({ message: "Organization created successfully." });
}
