import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guards";
import { QR_TTL_MS } from "@/lib/constants";
import { generateQrToken, hashQrToken } from "@/lib/crypto/qr-token";
import { createQrHold } from "@/lib/ledger";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST() {
  const auth = await requireApiRole("student");
  if (!auth.ok) return auth.response;

  const limited = rateLimit(`qr-generate:${auth.user.id}`, 5, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Please wait before requesting another pass." }, { status: 429 });
  }

  const token = generateQrToken();
  const expiresAt = new Date(Date.now() + QR_TTL_MS).toISOString();
  try {
    const result = await createQrHold({
      studentId: auth.user.id,
      tokenHash: hashQrToken(token),
      expiresAt,
    });
    if (!result.ok) {
      const message =
        result.error_code === "already_active"
          ? "An active pass already exists. It cannot be reissued; wait for it to expire."
          : result.error_code === "insufficient_pool"
            ? "Meal passes are temporarily unavailable. Please check back soon."
            : "This account cannot request a meal pass.";
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