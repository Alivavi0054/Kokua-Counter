import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerEnv } from "@/lib/env";

export async function POST() {
  const supabase = createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${getServerEnv().NEXT_PUBLIC_APP_URL}/`, {
    status: 302,
  });
}
