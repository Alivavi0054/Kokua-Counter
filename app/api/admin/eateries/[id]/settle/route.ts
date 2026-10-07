import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/guards";
import { createSettlement, markSettlementResult } from "@/lib/ledger";
import { rateLimit } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe/client";

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

  const created = await createSettlement(id);
  if (!created.ok) {
    return NextResponse.json({ error: errorMessages[created.error_code] }, { status: 409 });
  }

  try {
    const transfer = await getStripe().transfers.create({
      amount: created.amount_cents,
      currency: "usd",
      destination: created.stripe_connect_account_id,
      metadata: { settlement_id: created.settlement_id },
    });
    await markSettlementResult({
      settlementId: created.settlement_id,
      status: "paid",
      stripeTransferId: transfer.id,
    });
  } catch {
    await markSettlementResult({ settlementId: created.settlement_id, status: "failed" });
    return NextResponse.json({ error: "Could not complete the payout transfer." }, { status: 502 });
  }

  return NextResponse.json({
    message: "Settlement completed.",
    settlement_id: created.settlement_id,
    amount_cents: created.amount_cents,
  });
}
