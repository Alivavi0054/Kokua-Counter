import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { asStripeId, constructStripeEvent } from "@/lib/stripe/webhook";
import { recordCredit, recordRefund, recordRefundReversal } from "@/lib/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function markContributionFailed(session: Stripe.Checkout.Session) {
  const contributionId = session.metadata?.contribution_id;
  if (!contributionId) throw new Error("checkout_missing_contribution_id");
  const admin = createAdminClient();
  const { error } = await admin
    .from("contributions")
    .update({ status: "failed" })
    .eq("id", contributionId)
    .eq("status", "pending");
  if (error) throw error;
}

async function contributionIdFromPaymentIntent(paymentIntentId: string | null) {
  if (!paymentIntentId) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contributions")
    .select("id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") return;
  const contributionId = session.metadata?.contribution_id;
  const paymentIntentId = asStripeId(session.payment_intent);
  if (!contributionId || !paymentIntentId) {
    throw new Error("checkout_missing_ids");
  }
  const admin = createAdminClient();
  const { data: contribution, error } = await admin
    .from("contributions")
    .select("amount_cents, currency")
    .eq("id", contributionId)
    .maybeSingle();
  if (error || !contribution) throw new Error("checkout_contribution_not_found");
  if (session.amount_total !== contribution.amount_cents || session.currency?.toLowerCase() !== contribution.currency) {
    throw new Error("checkout_amount_mismatch");
  }
  await recordCredit({
    contributionId,
    checkoutSessionId: session.id,
    paymentIntentId,
  });
}

async function handleRefund(refund: Stripe.Refund) {
  const paymentIntentId = asStripeId(refund.payment_intent);
  let contributionId = await contributionIdFromPaymentIntent(paymentIntentId);

  if (!contributionId) {
    contributionId = refund.metadata?.contribution_id ?? null;
  }

  if (!contributionId) {
    throw new Error("refund_contribution_not_found");
  }

  await recordRefund({
    contributionId,
    stripeRefundId: refund.id,
    amountCents: refund.amount,
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET; required for Stripe webhook verification." },
      { status: 500 },
    );
  }

  let event: Stripe.Event;
  try {
    event = constructStripeEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Missing ")) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        await markContributionFailed(event.data.object as Stripe.Checkout.Session);
        break;
      case "refund.created":
      case "refund.updated": {
        const refund = event.data.object as Stripe.Refund;
        if (refund.status === "failed" || refund.status === "canceled") {
          await recordRefundReversal(refund.id);
        } else if (refund.status === "succeeded" || refund.status === "pending") {
          await handleRefund(refund);
        }
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const refunds = charge.refunds?.data ?? [];
        for (const refund of refunds) {
          await handleRefund(refund);
        }
        break;
      }
      default:
        break;
    }
  } catch {
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
