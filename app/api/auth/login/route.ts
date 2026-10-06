import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { isHawaiiEduEmail } from "@/lib/auth/roles";
import { getServerEnv } from "@/lib/env";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).optional(),
  next: z.string().optional(),
  mode: z.enum(["magic", "password"]),
});

function safeNext(path: string | undefined) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const supabase = createClient();
  const next = safeNext(parsed.data.next);

  if (parsed.data.mode === "magic") {
    if (!isHawaiiEduEmail(parsed.data.email)) {
      return NextResponse.json(
        { error: "Use a University of Hawaiʻi email ending in @hawaii.edu." },
        { status: 400 },
      );
    }
    const origin = getServerEnv().NEXT_PUBLIC_APP_URL;
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email.toLowerCase(),
      options: {
        emailRedirectTo: `${origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`,
        shouldCreateUser: true,
      },
    });
    if (error) {
      return NextResponse.json({ error: "Could not send sign-in link." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!parsed.data.password) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email.toLowerCase(),
    password: parsed.data.password,
  });
  if (error) {
    return NextResponse.json({ error: "Could not sign in." }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
    : { data: null };

  if (profile?.role === "student" && !isHawaiiEduEmail(parsed.data.email)) {
    await supabase.auth.signOut();
    return NextResponse.json(
      { error: "Use a University of Hawaiʻi email ending in @hawaii.edu." },
      { status: 403 },
    );
  }

  const redirect =
    next ??
    (profile?.role === "admin"
      ? "/admin"
      : profile?.role === "eatery"
        ? "/eatery"
        : profile?.role === "student"
          ? "/student"
          : "/");

  return NextResponse.json({ redirect });
}
