import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/guards";
import { createSettlement, markSettlementResult } from "@/lib/ledger";
import { rateLimit } from "@/lib/rate-limit";
import { settleEatery } from "@/lib/settlement";
import { getStripe } from "@/lib/stripe/client";
import { recordAdminAction } from "@/lib/audit";

const uuidSchema = z.string().uuid();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const errorMessages = {
  eatery_not_found: "This eatery could not be found.",
  payouts_not_connected: "This eatery has not connected a payout account yet.",
  nothing_to_settle: "There is nothing to settle for this eatery right now.",
} as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return auth.response;

  const limited = rateLimit(`admin-settle:${auth.user.id}`, 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 });
  }

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch (error) {
    console.error("settle: Stripe is not configured", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Payouts are unavailable right now." }, { status: 503 });
  }

  const result = await settleEatery(id, {
    createSettlement,
    markSettlementResult,
    stripe,
    log: (message, detail) => console.error(`settle: ${message}`, detail),
  });

  if (result.status !== "not_settleable") {
    await recordAdminAction({
      actorId: auth.user.id,
      action: result.status === "paid" ? "settlement.paid" : result.status === "transfer_failed" ? "settlement.failed" : "settlement.needs_reconciliation",
      targetType: "eatery",
      targetId: id,
      details: { settlement_id: result.settlementId, ...(result.status === "paid" ? { amount_cents: result.amountCents } : {}) },
    });
  }

  if (result.status === "not_settleable") {
    return NextResponse.json({ error: errorMessages[result.errorCode] }, { status: 409 });
  }
  if (result.status === "transfer_failed") {
    return NextResponse.json({ error: "Could not complete the payout transfer." }, { status: 502 });
  }
  if (result.status === "needs_reconciliation") {
    return NextResponse.json(
      {
        error:
          "The payout may have been sent, but it could not be confirmed in the ledger. Do not retry. Check Stripe and reconcile this settlement manually.",
        settlement_id: result.settlementId,
        transfer_id: result.transferId,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    message: "Settlement completed.",
    settlement_id: result.settlementId,
    amount_cents: result.amountCents,
  });
}
