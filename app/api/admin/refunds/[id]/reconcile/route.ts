import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/guards";
import { describeError } from "@/lib/errors";
import { databaseRefundDeps } from "@/lib/finance";
import { rateLimit } from "@/lib/rate-limit";
import { submitReservedRefund, type ReserveResult } from "@/lib/refunds";
import { getStripe } from "@/lib/stripe/client";
import { databaseWebhookDeps } from "@/lib/stripe/webhook-deps";
import { applyProviderRefund } from "@/lib/stripe/webhook-handlers";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidSchema = z.string().uuid();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reconciles one refund with Stripe. A refund still "requested" is submitted again with the same
 * idempotency key (Stripe returns the original refund if it already exists, so this cannot refund
 * twice). A refund with a Stripe id is re-read from Stripe and its current state applied.
 */
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

  const admin = createAdminClient();
  const { data: refund, error } = await admin
    .from("refunds")
    .select("id, contribution_id, status, amount_cents, principal_cents, fee_cents, stripe_refund_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !refund) {
    return NextResponse.json({ error: "Refund not found." }, { status: 404 });
  }
  if (refund.status === "succeeded" || refund.status === "failed" || refund.status === "canceled") {
    return NextResponse.json({ message: `Nothing to reconcile: this refund is ${refund.status}.` });
  }

  try {
    const stripe = getStripe();
    if (refund.stripe_refund_id) {
      const remote = await stripe.refunds.retrieve(refund.stripe_refund_id);
      await applyProviderRefund(remote, databaseWebhookDeps());
      return NextResponse.json({ message: `Stripe reports this refund as ${remote.status ?? "unknown"}.` });
    }

    const { data: contribution } = await admin
      .from("contributions")
      .select("stripe_payment_intent_id")
      .eq("id", refund.contribution_id)
      .maybeSingle();
    const reserved: Extract<ReserveResult, { ok: true }> = {
      ok: true,
      replay: true,
      refund_id: refund.id,
      status: refund.status,
      amount_cents: refund.amount_cents,
      principal_cents: refund.principal_cents,
      fee_cents: refund.fee_cents,
      stripe_refund_id: null,
      payment_intent_id: contribution?.stripe_payment_intent_id ?? null,
    };
    const result = await submitReservedRefund(reserved, refund.contribution_id, {
      ...databaseRefundDeps(),
      stripe,
      log: (message, detail) => console.error(`admin/refund-reconcile: ${message}`, detail),
    });
    if (result.status === "started") {
      return NextResponse.json({ message: "Refund submitted to Stripe. The ledger updates when Stripe confirms it." });
    }
    return NextResponse.json({ error: "Stripe could not confirm this refund. Try again shortly." }, { status: 502 });
  } catch (reconcileError) {
    console.error("admin/refund-reconcile: failed", describeError(reconcileError));
    return NextResponse.json({ error: "Could not reconcile this refund." }, { status: 502 });
  }
}
