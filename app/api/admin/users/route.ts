import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/guards";
import { USER_ROLES } from "@/lib/auth/roles";
import { rollbackAuthUser } from "@/lib/admin-accounts";
import { describeError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const createUserSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  role: z.enum(USER_ROLES),
  displayName: z.string().trim().min(2).max(120),
}).strict();

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return auth.response;

  const limited = rateLimit(`admin-user-create:${auth.user.id}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please complete all required fields." }, { status: 400 });
  }

  const { email, password, role, displayName } = parsed.data;
  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role },
  });

  if (createError || !created.user) {
    console.error("admin/users: createUser failed", describeError(createError));
    return NextResponse.json({ error: "Could not create this account." }, { status: 409 });
  }

  const { error: profileError } = await admin.from("users").upsert(
    {
      id: created.user.id,
      role,
      display_name: displayName,
      public_alias: displayName,
      verified_school_domain: role === "student" ? "hawaii.edu" : null,
      is_active: true,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    console.error("admin/users: profile upsert failed", describeError(profileError));
    await rollbackAuthUser(admin, created.user.id, "admin/users");
    return NextResponse.json({ error: "Could not create this account." }, { status: 500 });
  }

  return NextResponse.json({ message: "User created successfully.", id: created.user.id });
}
