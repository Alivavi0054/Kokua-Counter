import { NextResponse } from "next/server";
import { getAppUrl, isDevLoginEnabled } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isDevLoginEnabled()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  let form: Record<string, string> | undefined;
  try {
    const body = await request.formData();
    form = Object.fromEntries(body.entries()) as Record<string, string>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = (form?.email ?? "").trim();
  const password = form?.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const appUrl = getAppUrl("developer login redirects");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: "Invalid login." }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/student", appUrl));
}
