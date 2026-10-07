import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidSchema = z.string().uuid();
const bodySchema = z.object({
  amount_cents: z.number().int().positive().optional(),
}).strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return auth.response;

  const limited = rateLimit(`admin-refund:${auth.user.id}`, 10, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 });
  }

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let body: unknown = {};
  const rawText = await request.text();
  if (rawText.trim()) {
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: contribution, error } = await admin
    .from("contributions")
    .select("id, amount_cents, refunded_amount_cents, status, stripe_payment_intent_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !contribution) {
    return NextResponse.json({ error: "Contribution not found." }, { status: 404 });
  }
  if (!contribution.stripe_payment_intent_id) {
    return NextResponse.json({ error: "This contribution has no completed payment to refund." }, { status: 409 });
  }
  if (contribution.status !== "completed" && contribution.status !== "refunded") {
    return NextResponse.json({ error: "Only completed contributions can be refunded." }, { status: 409 });
  }

  const remaining = contribution.amount_cents - contribution.refunded_amount_cents;
  if (remaining <= 0) {
    return NextResponse.json({ error: "This contribution has already been fully refunded." }, { status: 409 });
  }

  const amountCents = parsed.data.amount_cents ?? remaining;
  if (amountCents > remaining) {
    return NextResponse.json({ error: "Refund amount exceeds the remaining refundable amount." }, { status: 400 });
  }

  try {
    await getStripe().refunds.create({
      payment_intent: contribution.stripe_payment_intent_id,
      amount: amountCents,
      metadata: { contribution_id: contribution.id },
    });
  } catch {
    return NextResponse.json({ error: "Could not start the refund with Stripe." }, { status: 502 });
  }

  return NextResponse.json({
    message: "Refund started. The ledger will update once Stripe confirms it.",
  });
}
