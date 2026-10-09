import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/guards";
import { rollbackAuthUser } from "@/lib/admin-accounts";
import { describeError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const createEaterySchema = z.object({
  name: z.string().trim().min(2).max(200),
  address: z.string().trim().min(2).max(300),
  island: z.string().trim().min(2).max(100),
  ownerEmail: z.string().trim().email().max(254),
  ownerPassword: z.string().min(8).max(128),
  ownerDisplayName: z.string().trim().min(2).max(120),
}).strict();

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    || "eatery";
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return auth.response;

  const limited = rateLimit(`admin-eatery-create:${auth.user.id}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = createEaterySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
  }

  const { name, address, island, ownerEmail, ownerPassword, ownerDisplayName } = parsed.data;
  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: ownerEmail,
    password: ownerPassword,
    email_confirm: true,
    user_metadata: { role: "eatery" },
  });

  if (createError || !created.user) {
    console.error("admin/eateries: createUser failed", describeError(createError));
    return NextResponse.json({ error: "Could not create the eatery owner account." }, { status: 409 });
  }

  const { error: profileError } = await admin.from("users").upsert(
    {
      id: created.user.id,
      role: "eatery",
      display_name: ownerDisplayName,
      public_alias: ownerDisplayName,
      is_active: true,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    console.error("admin/eateries: owner profile upsert failed", describeError(profileError));
    await rollbackAuthUser(admin, created.user.id, "admin/eateries");
    return NextResponse.json({ error: "Could not create the eatery." }, { status: 500 });
  }

  const baseSlug = slugify(name);
  let slug = baseSlug;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { error: eateryError } = await admin.from("eateries").insert({
      owner_user_id: created.user.id,
      name,
      slug,
      address,
      island,
      contact_email: ownerEmail,
      is_active: true,
    });

    if (!eateryError) {
      return NextResponse.json({ message: "Eatery created successfully.", slug });
    }

    if (eateryError.code !== "23505") {
      console.error("admin/eateries: eatery insert failed", describeError(eateryError));
      await rollbackAuthUser(admin, created.user.id, "admin/eateries");
      return NextResponse.json({ error: "Could not create the eatery." }, { status: 500 });
    }

    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  console.error("admin/eateries: could not find a unique slug");
  await rollbackAuthUser(admin, created.user.id, "admin/eateries");
  return NextResponse.json({ error: "Could not create a unique eatery slug." }, { status: 500 });
}
