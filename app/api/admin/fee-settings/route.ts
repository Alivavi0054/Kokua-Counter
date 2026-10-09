import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/guards";
import { describeError } from "@/lib/errors";
import { isValidFeeRateBps } from "@/lib/fees";
import { getCurrentFeeRateBps, listFeeSettings, setOperationalFeeRate } from "@/lib/finance";
import { rateLimit } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  rate_bps: z.number().int().refine(isValidFeeRateBps, "invalid rate"),
  effective_at: z.string().datetime().optional(),
  note: z.string().trim().max(200).optional(),
}).strict();

export async function GET() {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return auth.response;
  try {
    const [current, history] = await Promise.all([getCurrentFeeRateBps(), listFeeSettings()]);
    return NextResponse.json({ current_rate_bps: current, history });
  } catch (error) {
    console.error("admin/fee-settings: read failed", describeError(error));
    return NextResponse.json({ error: "Could not load fee settings." }, { status: 500 });
  }
}

/**
 * Sets the operational fee for FUTURE checkouts. Existing contributions keep the rate they were
 * charged; the effective time can be now or later, never in the past.
 */
export async function POST(request: Request) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return auth.response;

  const limited = rateLimit(`admin-fee-settings:${auth.user.id}`, 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  const parsed = await parseJsonBody(request, bodySchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  try {
    const result = await setOperationalFeeRate({
      rateBps: parsed.data.rate_bps,
      effectiveAt: parsed.data.effective_at ?? null,
      createdBy: auth.user.id,
      note: parsed.data.note || null,
    });
    if (!result.ok) {
      const message =
        result.errorCode === "effective_in_past"
          ? "The effective time cannot be in the past. Fee changes only apply to future checkouts."
          : "That fee rate is not allowed.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  } catch (error) {
    console.error("admin/fee-settings: update failed", describeError(error));
    return NextResponse.json({ error: "Could not update the fee." }, { status: 500 });
  }

  return NextResponse.json({ message: "Operational fee updated for future donations." });
}
