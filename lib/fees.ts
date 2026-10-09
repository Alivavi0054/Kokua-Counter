import { DEFAULT_OPERATIONAL_FEE_BPS, MAX_OPERATIONAL_FEE_BPS } from "@/lib/public-constants";

/**
 * Operational fee arithmetic. All amounts are integer cents and the rate is an integer number
 * of basis points (1 bp = 0.01%), so no binary floating point is ever involved.
 *
 * ROUNDING RULE (permanent, mirrored by public.calculate_operational_fee in SQL):
 *   fee = round-half-up(principal * rateBps / 10_000) to the nearest cent,
 *   computed as floor((principal * rateBps + 5_000) / 10_000).
 *
 * The database is authoritative: contributions snapshot the rate and fee when they are created
 * (public.create_contribution). These helpers exist for previews and tests, and must agree with SQL.
 */

export type FeeBreakdown = {
  principalCents: number;
  feeRateBps: number;
  operationalFeeCents: number;
  totalChargedCents: number;
};

export function isValidFeeRateBps(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_OPERATIONAL_FEE_BPS;
}

function assertCents(value: number, name: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer number of cents`);
  }
}

export function calculateOperationalFee(principalCents: number, feeRateBps: number = DEFAULT_OPERATIONAL_FEE_BPS): number {
  assertCents(principalCents, "principalCents");
  if (!isValidFeeRateBps(feeRateBps)) {
    throw new RangeError(`feeRateBps must be an integer between 0 and ${MAX_OPERATIONAL_FEE_BPS}`);
  }
  return Math.floor((principalCents * feeRateBps + 5_000) / 10_000);
}

export function calculateFeeBreakdown(principalCents: number, feeRateBps: number = DEFAULT_OPERATIONAL_FEE_BPS): FeeBreakdown {
  const operationalFeeCents = calculateOperationalFee(principalCents, feeRateBps);
  return {
    principalCents,
    feeRateBps,
    operationalFeeCents,
    totalChargedCents: principalCents + operationalFeeCents,
  };
}

/** "5%" or "2.5%": exact for any whole basis-point rate. */
export function formatFeeRate(feeRateBps: number): string {
  const percent = feeRateBps / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

export type RefundAllocation = { principalCents: number; feeCents: number };

/**
 * Split a refund (or reversal) amount between donation principal and operational fee.
 * Mirrors public.allocate_refund_components in SQL.
 *
 * - The amount is allocated proportionally to the ORIGINAL principal/fee split of the payment
 *   (fee share = round-half-up(amount * fee / total)), never to the currently configured rate.
 * - principalCents + feeCents always equals the refund amount.
 * - A refund that consumes everything still refundable takes exactly the remaining principal and
 *   remaining fee, so rounding remainders always land on the final refund.
 * - Component totals can never exceed the original principal or fee.
 */
export function allocateRefund(params: {
  principalCents: number;
  feeCents: number;
  principalAlreadyAllocatedCents: number;
  feeAlreadyAllocatedCents: number;
  amountCents: number;
}): RefundAllocation {
  const { principalCents, feeCents, principalAlreadyAllocatedCents, feeAlreadyAllocatedCents, amountCents } = params;
  const remainingPrincipal = principalCents - principalAlreadyAllocatedCents;
  const remainingFee = feeCents - feeAlreadyAllocatedCents;
  const remainingTotal = remainingPrincipal + remainingFee;

  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new RangeError("refund_amount_must_be_positive");
  if (remainingPrincipal < 0 || remainingFee < 0) throw new RangeError("allocation_state_invalid");
  if (amountCents > remainingTotal) throw new RangeError("refund_exceeds_remaining");

  if (amountCents === remainingTotal) {
    return { principalCents: remainingPrincipal, feeCents: remainingFee };
  }

  const total = principalCents + feeCents;
  let fee = Math.floor((2 * amountCents * feeCents + total) / (2 * total));
  fee = Math.min(fee, remainingFee);
  let principal = amountCents - fee;
  if (principal > remainingPrincipal) {
    principal = remainingPrincipal;
    fee = amountCents - remainingPrincipal;
  }
  return { principalCents: principal, feeCents: fee };
}

/**
 * Parses an administrator-entered percentage such as "5", "5.25" or "0" into basis points using
 * string arithmetic only (never floating point). Returns null for anything invalid or above the cap.
 */
export function percentToBps(input: string): number | null {
  const match = /^(\d{1,2})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0") || "0");
  const bps = whole * 100 + fraction;
  return isValidFeeRateBps(bps) ? bps : null;
}
