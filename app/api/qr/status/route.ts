import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.string().uuid();

export async function GET(request: Request) {
  const auth = await requireApiRole("student");
  if (!auth.ok) return auth.response;
  const limited = rateLimit(`qr-status:${auth.user.id}`, 60, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many status checks." }, { status: 429 });
  }

  const qrId = querySchema.safeParse(new URL(request.url).searchParams.get("id"));
  if (!qrId.success) {
    return NextResponse.json({ error: "Invalid pass." }, { status: 400 });
  }

  const supabase = createClient();
  const { data: qr, error } = await supabase
    .from("qr_codes")
    .select("id, status, expires_at, redeemed_at")
    .eq("id", qrId.data)
    .eq("student_user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Could not check pass status." }, { status: 500 });
  }
  if (!qr) return NextResponse.json({ error: "Pass not found." }, { status: 404 });

  if (qr.status !== "redeemed") {
    return NextResponse.json({
      status: qr.status,
      expires_at: qr.expires_at,
      redeemed_at: qr.redeemed_at,
    });
  }

  const { data: redemption } = await supabase
    .from("redemptions")
    .select("metadata, redeemed_at")
    .eq("qr_code_id", qr.id)
    .maybeSingle();
  const metadata = redemption?.metadata;
  const eateryName =
    metadata && typeof metadata === "object" && !Array.isArray(metadata) &&
    typeof metadata.eatery_name === "string"
      ? metadata.eatery_name
      : "Participating eatery";

  return NextResponse.json({
    status: qr.status,
    expires_at: qr.expires_at,
    redeemed_at: redemption?.redeemed_at ?? qr.redeemed_at,
    eatery_name: eateryName,
  });
}