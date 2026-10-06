import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/guards";
import { cancelQr } from "@/lib/ledger";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  qr_id: z.string().uuid(),
});

export async function POST(request: Request) {
  const auth = await requireApiRole("student");
  if (!auth.ok) return auth.response;

  const limited = rateLimit(`qr-cancel:${auth.user.id}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Please wait before cancelling this pass." }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "This pass could not be cancelled." }, { status: 400 });
  }

  try {
    const result = await cancelQr({
      qrId: parsed.data.qr_id,
      studentUserId: auth.user.id,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            result.error_code === "not_found"
              ? "This pass could not be found."
              : "This pass cannot be cancelled right now.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true, status: "cancelled" });
  } catch {
    return NextResponse.json({ error: "Could not cancel this pass." }, { status: 500 });
  }
}
