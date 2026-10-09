import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/guards";
import { describeError } from "@/lib/errors";
import { listContributionsMissingProcessorFee, recordProcessorFee } from "@/lib/finance";
import { rateLimit } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe/client";
import { fetchProcessorFee } from "@/lib/stripe/processor-fees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Backfills Stripe processing fees for completed payments that do not have one recorded yet. */
export async function POST() {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return auth.response;

  const limited = rateLimit(`admin-finance-reconcile:${auth.user.id}`, 5, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 });
  }

  try {
    const missing = await listContributionsMissingProcessorFee(25);
    const stripe = getStripe();
    let recorded = 0;
    let unavailable = 0;
    for (const item of missing) {
      try {
        const fee = await fetchProcessorFee(stripe, item.payment_intent_id);
        if (!fee) {
          unavailable += 1;
          continue;
        }
        await recordProcessorFee({
          contributionId: item.contribution_id,
          paymentIntentId: item.payment_intent_id,
          feeCents: fee.feeCents,
          balanceTransactionId: fee.balanceTransactionId,
        });
        recorded += 1;
      } catch (error) {
        unavailable += 1;
        console.error("admin/finance-reconcile: fee lookup failed", describeError(error));
      }
    }
    return NextResponse.json({ checked: missing.length, recorded, unavailable });
  } catch (error) {
    console.error("admin/finance-reconcile: failed", describeError(error));
    return NextResponse.json({ error: "Could not reconcile processor fees." }, { status: 500 });
  }
}
