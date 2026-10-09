import { describe, expect, it } from "vitest";
import { entriesCsv, isValidMonth, monthRangeHonolulu, summarize, summaryCsv, type ExportEntry } from "@/lib/finance-export";

const entry = (overrides: Partial<ExportEntry>): ExportEntry => ({
  created_at: "2026-10-05T20:00:00Z",
  ledger: "pool",
  entry_type: "credit",
  amount_cents: 800,
  contribution_id: "c1",
  refund_id: null,
  reference_key: "ref",
  ...overrides,
});

describe("month handling", () => {
  it("validates YYYY-MM", () => {
    expect(isValidMonth("2026-10")).toBe(true);
    for (const bad of ["2026-13", "2026-00", "26-10", "2026-1", "2026-10-01", "", null, undefined, "2019-12", "2101-01", "2026/10", "20261010"]) {
      expect(isValidMonth(bad as string), String(bad)).toBe(false);
    }
  });

  it("uses Hawaii time: a month starts at 10:00 UTC on the 1st", () => {
    expect(monthRangeHonolulu("2026-10")).toEqual({ from: "2026-10-01T10:00:00.000Z", to: "2026-11-01T10:00:00.000Z" });
    expect(monthRangeHonolulu("2026-12")).toEqual({ from: "2026-12-01T10:00:00.000Z", to: "2027-01-01T10:00:00.000Z" });
    expect(monthRangeHonolulu("2028-02").to).toBe("2028-03-01T10:00:00.000Z");
    expect(() => monthRangeHonolulu("nope")).toThrow(RangeError);
  });
});

describe("statements", () => {
  const entries: ExportEntry[] = [
    entry({ amount_cents: 800 }),
    entry({ ledger: "operations", entry_type: "fee_charge", amount_cents: 40 }),
    entry({ ledger: "operations", entry_type: "processor_fee", amount_cents: -55 }),
    entry({ entry_type: "refund", amount_cents: -400, refund_id: "r1" }),
    entry({ ledger: "operations", entry_type: "fee_refund", amount_cents: -20, refund_id: "r1" }),
    entry({ entry_type: "redemption", amount_cents: -800 }),
    entry({ ledger: "operations", entry_type: "dispute_fee", amount_cents: -1500 }),
  ];

  it("summarizes each line from the ledger entries", () => {
    expect(summarize(entries)).toEqual({
      donationsReceivedCents: 800,
      donationsRefundedCents: 400,
      feesChargedCents: 40,
      feesRefundedCents: 20,
      processorFeesCents: 55,
      disputeFeesCents: 1500,
      mealsRedeemedCents: 800,
    });
  });

  it("nets reversals so a reversed refund is not double counted", () => {
    const withReversal = [...entries, entry({ entry_type: "refund_reversal", amount_cents: 400 }), entry({ ledger: "operations", entry_type: "fee_refund_reversal", amount_cents: 20 })];
    expect(summarize(withReversal)).toMatchObject({ donationsRefundedCents: 0, feesRefundedCents: 0 });
  });

  it("summary CSV shows net operational revenue after expenses", () => {
    const csv = summaryCsv("2026-10", entries);
    expect(csv).toContain("2026-10,Operational revenue,Net fees retained (before expenses),0.2,20");
    expect(csv).toContain("Net operational revenue,-15.35,-1535");
  });

  it("entries CSV keeps negative amounts as numbers (never as formula-escaped text) and sorts by time", () => {
    const csv = entriesCsv([entry({ created_at: "2026-10-06T00:00:00Z", amount_cents: -840, entry_type: "refund" }), entry({ created_at: "2026-10-05T00:00:00Z" })]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Date (Hawaii time),Ledger,Entry type,Amount (USD),Amount (cents),Contribution ID,Refund ID,Reference");
    expect(lines[1]).toContain("2026-10-04 14:00:00"); // 00:00Z is 14:00 the previous day in Hawaii
    expect(lines[2]).toContain(",-8.4,-840,");
    expect(csv).not.toContain("'-");
  });

  it("is empty-safe", () => {
    expect(entriesCsv([]).split("\n")).toHaveLength(1);
    expect(summarize([])).toMatchObject({ donationsReceivedCents: 0 });
  });
});
