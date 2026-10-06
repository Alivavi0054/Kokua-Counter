import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isHawaiiEduEmail } from "@/lib/auth/roles";
import { getAppUrl } from "@/lib/env";

function safeNext(path: string | null) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return null;
  return path;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const origin = getAppUrl("authentication callback redirects");
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

  if (!user?.email || !user.email_confirmed_at) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/auth/login?error=unverified`);
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "student" && !isHawaiiEduEmail(user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/auth/login?error=domain`);
  }

  if (!profile) {
    if (!isHawaiiEduEmail(user.email)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/auth/login?error=domain`);
    }

    const { data: profileResult, error: profileCreateError } = await admin.rpc("create_student_profile", {
      p_user_id: user.id,
      p_display_name: "Student",
    });

    const profileStatus = profileResult && typeof profileResult === "object" && !Array.isArray(profileResult)
      ? profileResult as { ok?: boolean; error_code?: string }
      : null;

    if (profileCreateError || profileStatus?.ok !== true) {
      await supabase.auth.signOut();
      const error = profileStatus?.error_code === "student_email_already_used" ? "email-used" : "unauthorized";
      return NextResponse.redirect(`${origin}/auth/login?error=${error}`);
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
