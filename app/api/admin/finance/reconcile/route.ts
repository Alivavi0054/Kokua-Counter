import { NextResponse } from "next/server";
import { recordAdminAction } from "@/lib/audit";
import { requireApiRole } from "@/lib/auth/guards";
import { describeError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { backfillProcessorFees } from "@/lib/stripe/reconcile-deps";

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
    const result = await backfillProcessorFees(25);
    await recordAdminAction({ actorId: auth.user.id, action: "finance.processor_fees_backfilled", details: result });
    return NextResponse.json(result);
  } catch (error) {
    console.error("admin/finance-reconcile: failed", describeError(error));
    return NextResponse.json({ error: "Could not reconcile processor fees." }, { status: 500 });
  }
}
