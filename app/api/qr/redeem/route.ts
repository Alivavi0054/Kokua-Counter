import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/guards";
import { hashQrToken } from "@/lib/crypto/qr-token";
import { redeemQr } from "@/lib/ledger";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  token: z.string().trim().min(16).max(128),
});

const failureMessages = {
  invalid: "This code is not recognized.",
  already_used: "This meal pass has already been used.",
  expired: "This meal pass has expired.",
  unavailable: "Redemption is unavailable for this eatery right now.",
} as const;

export async function POST(request: Request) {
  const auth = await requireApiRole("eatery");
  if (!auth.ok) return auth.response;

  const limited = rateLimit(`qr-redeem:${auth.user.id}`, 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many scan attempts. Please wait." }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "This code is not recognized." }, { status: 400 });
  }

  try {
    const result = await redeemQr({
      tokenHash: hashQrToken(parsed.data.token),
      eateryUserId: auth.user.id,
    });
    if (!result.ok) {
      return NextResponse.json({
        error_code: result.error_code,
        error: failureMessages[result.error_code],
      }, { status: result.error_code === "unavailable" ? 503 : 409 });
    }
    return NextResponse.json({
      redemption_id: result.redemption_id,
      eatery_name: result.eatery_name,
      redeemed_at: result.redeemed_at,
    });
  } catch {
    return NextResponse.json({ error: "Could not verify this meal pass." }, { status: 500 });
  }
}