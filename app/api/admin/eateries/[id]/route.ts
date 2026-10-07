import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const updateSchema = z.object({
  is_active: z.boolean(),
}).strict();

const uuidSchema = z.string().uuid();

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) {
    return auth.response;
  }

  const limited = rateLimit(`admin-eatery-update:${auth.user.id}`, 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("eateries")
    .update({ is_active: parsed.data.is_active })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Could not update eatery." }, { status: 500 });
  }

  return NextResponse.json({ message: "Eatery updated." });
}
