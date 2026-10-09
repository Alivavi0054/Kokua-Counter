import { describe, expect, it } from "vitest";
import {
  allocateRefund,
  calculateFeeBreakdown,
  calculateOperationalFee,
  formatFeeRate,
  isValidFeeRateBps,
} from "@/lib/fees";
import { DEFAULT_OPERATIONAL_FEE_BPS, MAX_DONATION_CENTS } from "@/lib/public-constants";

describe("operational fee calculation (5% on top)", () => {
  it("defaults to 5%", () => {
    expect(DEFAULT_OPERATIONAL_FEE_BPS).toBe(500);
  });

  it.each([
    [500, 25, 525],
    [800, 40, 840],
    [1000, 50, 1050],
    [2000, 100, 2100],
    [10000, 500, 10500],
  ])("principal %i -> fee %i, total %i", (principal, fee, total) => {
    const breakdown = calculateFeeBreakdown(principal);
    expect(breakdown).toEqual({ principalCents: principal, feeRateBps: 500, operationalFeeCents: fee, totalChargedCents: total });
  });

  it("adds the fee on top: the principal is never reduced", () => {
    const { principalCents, totalChargedCents, operationalFeeCents } = calculateFeeBreakdown(800);
    expect(principalCents).toBe(800);
    expect(totalChargedCents - operationalFeeCents).toBe(800);
  });

  it("rounds half up at cent boundaries", () => {
    // 5% of 10c = 0.5c -> 1c ; of 9c = 0.45c -> 0 ; of 30c = 1.5c -> 2c ; of 29c = 1.45c -> 1c
    expect(calculateOperationalFee(10)).toBe(1);
    expect(calculateOperationalFee(9)).toBe(0);
    expect(calculateOperationalFee(30)).toBe(2);
    expect(calculateOperationalFee(29)).toBe(1);
    expect(calculateOperationalFee(1)).toBe(0);
    expect(calculateOperationalFee(0)).toBe(0);
  });

  it("handles very small and the maximum permitted donations exactly", () => {
    expect(calculateFeeBreakdown(1).totalChargedCents).toBe(1);
    expect(calculateFeeBreakdown(MAX_DONATION_CENTS)).toMatchObject({ operationalFeeCents: 4000, totalChargedCents: 84000 });
  });

  it("never uses floating point: results are exact integers for a sweep of amounts", () => {
    for (let cents = 0; cents <= 100_000; cents += 7) {
      const fee = calculateOperationalFee(cents);
      expect(Number.isInteger(fee)).toBe(true);
      // within half a cent of the exact 5%
      expect(Math.abs(fee * 20 - cents)).toBeLessThanOrEqual(10);
    }
  });

  it("supports other configured rates", () => {
    expect(calculateOperationalFee(800, 250)).toBe(20);
    expect(calculateOperationalFee(800, 0)).toBe(0);
    expect(calculateOperationalFee(800, 2000)).toBe(160);
  });

  it("rejects invalid configuration and amounts", () => {
    for (const bad of [-1, 2001, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isValidFeeRateBps(bad)).toBe(false);
      expect(() => calculateOperationalFee(800, bad)).toThrow(RangeError);
    }
    expect(() => calculateOperationalFee(-1)).toThrow(RangeError);
    expect(() => calculateOperationalFee(1.5)).toThrow(RangeError);
    expect(isValidFeeRateBps(0)).toBe(true);
    expect(isValidFeeRateBps(2000)).toBe(true);
  });

  it("formats rates", () => {
    expect(formatFeeRate(500)).toBe("5%");
    expect(formatFeeRate(250)).toBe("2.5%");
    expect(formatFeeRate(125)).toBe("1.25%");
    expect(formatFeeRate(0)).toBe("0%");
  });

  it("a rate change affects only new calculations, not an earlier snapshot", () => {
    const earlier = calculateFeeBreakdown(800, 500);
    const later = calculateFeeBreakdown(800, 1000);
    expect(earlier.operationalFeeCents).toBe(40);
    expect(later.operationalFeeCents).toBe(80);
    // refunds use the snapshot values, so the earlier payment still allocates against $0.40
    expect(
      allocateRefund({ principalCents: earlier.principalCents, feeCents: earlier.operationalFeeCents, principalAlreadyAllocatedCents: 0, feeAlreadyAllocatedCents: 0, amountCents: 420 }),
    ).toEqual({ principalCents: 400, feeCents: 20 });
  });
});

describe("refund allocation", () => {
  const base = { principalCents: 800, feeCents: 40, principalAlreadyAllocatedCents: 0, feeAlreadyAllocatedCents: 0 };

  it("full refund returns the whole charge: $8.00 + $0.40 = $8.40", () => {
    expect(allocateRefund({ ...base, amountCents: 840 })).toEqual({ principalCents: 800, feeCents: 40 });
  });

  it("partial refund of $4.20 is $4.00 principal and $0.20 fee", () => {
    expect(allocateRefund({ ...base, amountCents: 420 })).toEqual({ principalCents: 400, feeCents: 20 });
  });

  it("components always sum to the refund amount and stay within the originals, for every amount", () => {
    for (let amount = 1; amount <= 840; amount += 1) {
      const split = allocateRefund({ ...base, amountCents: amount });
      expect(split.principalCents + split.feeCents).toBe(amount);
      expect(split.principalCents).toBeLessThanOrEqual(800);
      expect(split.feeCents).toBeLessThanOrEqual(40);
      expect(split.principalCents).toBeGreaterThanOrEqual(0);
      expect(split.feeCents).toBeGreaterThanOrEqual(0);
    }
  });

  it("multiple partial refunds never exceed the originals and the last one takes the remainders", () => {
    // 840 = 3 x 280; 280 * 40/840 = 13.33 -> fee 13 each time; final takes exact remainder
    let principalUsed = 0;
    let feeUsed = 0;
    const issued: Array<{ principalCents: number; feeCents: number }> = [];
    for (const amount of [280, 280, 280]) {
      const split = allocateRefund({ ...base, principalAlreadyAllocatedCents: principalUsed, feeAlreadyAllocatedCents: feeUsed, amountCents: amount });
      issued.push(split);
      principalUsed += split.principalCents;
      feeUsed += split.feeCents;
    }
    expect(issued[0]).toEqual({ principalCents: 267, feeCents: 13 });
    expect(issued[1]).toEqual({ principalCents: 267, feeCents: 13 });
    expect(issued[2]).toEqual({ principalCents: 266, feeCents: 14 });
    expect(principalUsed).toBe(800);
    expect(feeUsed).toBe(40);
  });

  it("random refund sequences never over-refund and always exhaust exactly", () => {
    let seed = 12345;
    const next = (max: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return 1 + (seed % max);
    };
    for (let run = 0; run < 200; run += 1) {
      const principal = 100 * (1 + next(500));
      const fee = calculateOperationalFee(principal);
      let principalUsed = 0;
      let feeUsed = 0;
      let remaining = principal + fee;
      while (remaining > 0) {
        const amount = Math.min(remaining, next(Math.max(1, Math.ceil(remaining / 2)) + 1));
        const split = allocateRefund({ principalCents: principal, feeCents: fee, principalAlreadyAllocatedCents: principalUsed, feeAlreadyAllocatedCents: feeUsed, amountCents: amount });
        expect(split.principalCents + split.feeCents).toBe(amount);
        principalUsed += split.principalCents;
        feeUsed += split.feeCents;
        remaining -= amount;
        expect(principalUsed).toBeLessThanOrEqual(principal);
        expect(feeUsed).toBeLessThanOrEqual(fee);
      }
      expect(principalUsed).toBe(principal);
      expect(feeUsed).toBe(fee);
    }
  });

  it("refuses to refund more than what remains", () => {
    expect(() => allocateRefund({ ...base, amountCents: 841 })).toThrow("refund_exceeds_remaining");
    expect(() =>
      allocateRefund({ ...base, principalAlreadyAllocatedCents: 400, feeAlreadyAllocatedCents: 20, amountCents: 421 }),
    ).toThrow("refund_exceeds_remaining");
    expect(() => allocateRefund({ ...base, amountCents: 0 })).toThrow("refund_amount_must_be_positive");
  });

  it("works for legacy payments that carried no fee", () => {
    expect(allocateRefund({ principalCents: 800, feeCents: 0, principalAlreadyAllocatedCents: 0, feeAlreadyAllocatedCents: 0, amountCents: 300 })).toEqual({
      principalCents: 300,
      feeCents: 0,
    });
  });
});

describe("percentToBps (admin input)", () => {
  it("parses whole and fractional percentages exactly", async () => {
    const { percentToBps } = await import("@/lib/fees");
    expect(percentToBps("5")).toBe(500);
    expect(percentToBps("5.25")).toBe(525);
    expect(percentToBps("0.5")).toBe(50);
    expect(percentToBps("0")).toBe(0);
    expect(percentToBps(" 20 ")).toBe(2000);
    expect(percentToBps("7.1")).toBe(710);
  });

  it("rejects invalid, negative, over-cap or imprecise input", async () => {
    const { percentToBps } = await import("@/lib/fees");
    for (const bad of ["", "abc", "-1", "20.01", "21", "100", "5.255", "5,5", "1e1", "5%", "NaN"]) {
      expect(percentToBps(bad), bad).toBeNull();
    }
  });
});
