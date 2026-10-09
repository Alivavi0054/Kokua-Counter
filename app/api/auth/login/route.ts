import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
import { createClient } from "@/lib/supabase/server";
import { isHawaiiEduEmail, isUserRole, roleHome } from "@/lib/auth/roles";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp, isAllowedRedirect, parseJsonBody, verifyOriginMatches } from "@/lib/security";
import { getAppUrl } from "@/lib/env";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export async function POST(request: Request) {
  if (!verifyOriginMatches(request, getAppUrl("login form requests"))) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const clientIp = getClientIp(request);

  const limited = rateLimit(`auth-login:${clientIp}`, 8, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many sign-in attempts. Please wait a minute and try again." }, { status: 429 });
  }

  const parsedBody = await parseJsonBody(request, bodySchema.strict());
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }

  const email = parsedBody.data.email.trim().toLowerCase();
  if (email.length > 254 || parsedBody.data.password.length > 128) {
    return NextResponse.json({ error: "Invalid login details." }, { status: 400 });
  }

  const supabase = await createClient();
  const next = parsedBody.data.next ? isAllowedRedirect(parsedBody.data.next) : null;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: parsedBody.data.password,
  });
  if (error) {
    return NextResponse.json({ error: "Could not sign in." }, { status: 400 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };

  // A valid password is not enough: the account needs an active profile with a known role.
  if (!user || !profile || !isUserRole(profile.role)) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "This account is not set up yet. Contact the program administrator." }, { status: 403 });
  }
  if (!profile.is_active) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "This account has been deactivated. Contact the program administrator." }, { status: 403 });
  }
  if (profile.role === "student") {
    if (!isHawaiiEduEmail(email)) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Use a University of Hawaiʻi email ending in @hawaii.edu." },
        { status: 403 },
      );
    }
    if (!user.email_confirmed_at) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: "Confirm your email address first, then sign in." }, { status: 403 });
    }
  }

  return NextResponse.json({ redirect: next ?? roleHome(profile.role) });
}
