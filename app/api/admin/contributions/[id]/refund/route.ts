import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiRole } from "@/lib/auth/guards";
import { describeError } from "@/lib/errors";
import { databaseRefundDeps } from "@/lib/finance";
import { rateLimit } from "@/lib/rate-limit";
import { startRefund } from "@/lib/refunds";
import { getStripe } from "@/lib/stripe/client";

const uuidSchema = z.string().uuid();
const requestKeySchema = z.string().regex(/^[A-Za-z0-9_-]{8,100}$/);
const bodySchema = z.object({
  /** Total amount to return to the donor. Omit for everything still refundable. */
  amount_cents: z.number().int().positive().optional(),
  reason: z.string().trim().max(200).optional(),
}).strict();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rejection: Record<string, { status: number; message: string }> = {
  not_found: { status: 404, message: "Contribution not found." },
  not_refundable: { status: 409, message: "This contribution has no completed payment to refund." },
  disputed: { status: 409, message: "This payment has an open dispute and cannot be refunded." },
  nothing_to_refund: { status: 409, message: "This contribution has already been fully refunded or has refunds in progress." },
  exceeds_remaining: { status: 400, message: "Refund amount exceeds the remaining refundable amount." },
  invalid_amount: { status: 400, message: "Invalid refund amount." },
  idempotency_key_reused: { status: 400, message: "That request key was already used for a different refund." },
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  // Only administrators may refund, and only server-side: donors cannot refund their own payments.
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

  const rawKey = request.headers.get("idempotency-key");
  if (rawKey && !requestKeySchema.safeParse(rawKey).success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let result;
  try {
    result = await startRefund(
      {
        contributionId: id,
        amountCents: parsed.data.amount_cents ?? null,
        reason: parsed.data.reason || null,
        requestedBy: auth.user.id,
        idempotencyRef: rawKey,
      },
      {
        ...databaseRefundDeps(),
        stripe: getStripe(),
        log: (message, detail) => console.error(`admin/refund: ${message}`, detail),
      },
    );
  } catch (error) {
    console.error("admin/refund: unexpected failure", describeError(error));
    return NextResponse.json({ error: "Could not start the refund." }, { status: 500 });
  }

  switch (result.status) {
    case "rejected": {
      const known = rejection[result.errorCode] ?? { status: 409, message: "Could not start the refund." };
      return NextResponse.json({ error: known.message }, { status: known.status });
    }
    case "failed":
      return NextResponse.json({ error: "Stripe could not start the refund. Nothing was refunded." }, { status: 502 });
    case "needs_reconciliation":
      return NextResponse.json(
        {
          error: "The refund request could not be confirmed with Stripe. It is held for review: use Reconcile on the Finance page before trying again.",
          refund_id: result.refundId,
        },
        { status: 202 },
      );
    case "started":
      return NextResponse.json({
        message: "Refund started. The ledger will update once Stripe confirms it.",
        refund_id: result.refundId,
        replay: result.replay,
        refund: {
          total_cents: result.amountCents,
          donation_cents: result.principalCents,
          operational_fee_cents: result.feeCents,
        },
      });
  }
}
