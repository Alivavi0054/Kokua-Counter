import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAdminAction } from "@/lib/audit";
import { requireApiRole } from "@/lib/auth/guards";
import { describeError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { reconcileRefund } from "@/lib/refund-reconcile";
import { realReconcileDeps } from "@/lib/stripe/reconcile-deps";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidSchema = z.string().uuid();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Reconciles one refund with Stripe (see lib/refund-reconcile.ts). Safe to repeat. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return auth.response;

  const limited = rateLimit(`admin-refund-reconcile:${auth.user.id}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 });
  }

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data: refund, error } = await createAdminClient()
    .from("refunds")
    .select("id, contribution_id, status, amount_cents, principal_cents, fee_cents, stripe_refund_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !refund) {
    return NextResponse.json({ error: "Refund not found." }, { status: 404 });
  }

  try {
    const result = await reconcileRefund(refund, realReconcileDeps());
    if (result.outcome === "nothing_to_do") {
      return NextResponse.json({ message: `Nothing to reconcile: this refund is ${result.status}.` });
    }
    await recordAdminAction({
      actorId: auth.user.id,
      action: "refund.reconciled",
      targetType: "refund",
      targetId: id,
      details: { outcome: result.outcome },
    });
    if (result.outcome === "synced") {
      return NextResponse.json({ message: `Stripe reports this refund as ${result.stripeStatus}.` });
    }
    if (result.outcome === "resubmitted") {
      return NextResponse.json({ message: "Refund submitted to Stripe. The ledger updates when Stripe confirms it." });
    }
    return NextResponse.json({ error: "Stripe could not confirm this refund. Try again shortly." }, { status: 502 });
  } catch (reconcileError) {
    console.error("admin/refund-reconcile: failed", describeError(reconcileError));
    return NextResponse.json({ error: "Could not reconcile this refund." }, { status: 502 });
  }
}
