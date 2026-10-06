import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guards";
import { QR_TTL_MINUTES } from "@/lib/public-constants";
import { generateQrToken, hashQrToken } from "@/lib/crypto/qr-token";
import { createQrHold } from "@/lib/ledger";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireApiRole("student");
  if (!auth.ok) return auth.response;

  const limited = rateLimit(`qr-generate:${auth.user.id}`, 5, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Please wait before requesting another pass." }, { status: 429 });
  }

  const token = generateQrToken();
  const expiresAt = new Date(Date.now() + QR_TTL_MINUTES * 60_000).toISOString();
  try {
    const result = await createQrHold({
      studentId: auth.user.id,
      tokenHash: hashQrToken(token),
      expiresAt,
    });
    if (!result.ok) {
      const message =
        result.error_code === "active_pass_exists"
          ? "You already have an active meal pass. Use it or wait for it to expire."
          : result.error_code === "daily_limit_reached"
            ? "You've already used today's meal pass. A new one will be available tomorrow."
            : result.error_code === "too_many_attempts"
              ? "You've reached today's pass limit. Please try again tomorrow."
              : result.error_code === "cooldown"
                ? "Please wait a minute before requesting another pass."
                : result.error_code === "pool_unavailable"
                  ? "Meal passes aren't available right now. Please try again later."
                  : "This account can't request a meal pass right now.";
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({
      token,
      qr_id: result.qr_id,
      expires_at: result.expires_at,
    });
  } catch {
    return NextResponse.json({ error: "Could not create a meal pass." }, { status: 500 });
  }
}