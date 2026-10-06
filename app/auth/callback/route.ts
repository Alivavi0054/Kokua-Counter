import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isHawaiiEduEmail } from "@/lib/auth/roles";
import { getServerEnv } from "@/lib/env";

function safeNext(path: string | null) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const origin = getServerEnv().NEXT_PUBLIC_APP_URL;
  const supabase = createClient();

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=unauthorized`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/auth/login?error=unauthorized`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/auth/login?error=unauthorized`);
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    if (!isHawaiiEduEmail(user.email)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/auth/login?error=domain`);
    }

    const localPart = user.email.split("@")[0] ?? "Student";
    const { error: insertError } = await admin.from("users").insert({
      id: user.id,
      role: "student",
      display_name: localPart,
      public_alias: localPart,
      verified_school_domain: "hawaii.edu",
      is_active: true,
    });

    if (insertError) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/auth/login?error=unauthorized`);
    }

    return NextResponse.redirect(`${origin}${next ?? "/student"}`);
  }

  const destination =
    next ??
    (profile.role === "admin"
      ? "/admin"
      : profile.role === "eatery"
        ? "/eatery"
        : "/student");

  return NextResponse.redirect(`${origin}${destination}`);
}
