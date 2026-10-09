import { toCsv } from "@/lib/csv";

/**
 * Month statements for the accountant. Everything is derived from the two append-only ledgers, in
 * Hawaiʻi time (UTC-10 all year, Hawaiʻi has no daylight saving).
 */

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isValidMonth(value: string | null | undefined): value is string {
  return typeof value === "string" && MONTH.test(value) && Number(value.slice(0, 4)) >= 2020 && Number(value.slice(0, 4)) <= 2100;
}

/** [from, to) as ISO instants for a YYYY-MM month in Pacific/Honolulu. */
export function monthRangeHonolulu(month: string): { from: string; to: string } {
  const match = MONTH.exec(month);
  if (!match) throw new RangeError("month must be YYYY-MM");
  const year = Number(match[1]);
  const monthIndex = Number(match[2]);
  const nextYear = monthIndex === 12 ? year + 1 : year;
  const nextMonth = monthIndex === 12 ? 1 : monthIndex + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: new Date(`${year}-${pad(monthIndex)}-01T00:00:00-10:00`).toISOString(),
    to: new Date(`${nextYear}-${pad(nextMonth)}-01T00:00:00-10:00`).toISOString(),
  };
}

export type ExportEntry = {
  created_at: string;
  ledger: "pool" | "operations";
  entry_type: string;
  amount_cents: number;
  contribution_id: string | null;
  refund_id: string | null;
  reference_key: string | null;
};

const honolulu = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Pacific/Honolulu",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function honoluluTimestamp(iso: string): string {
  const parts = Object.fromEntries(honolulu.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/** Numbers (not strings) so a negative amount is never mistaken for a spreadsheet formula. */
const dollars = (cents: number) => cents / 100;

export function entriesCsv(entries: ExportEntry[]): string {
  const sorted = [...entries].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.ledger.localeCompare(b.ledger));
  return toCsv(
    sorted.map((entry) => ({
      date_hst: honoluluTimestamp(entry.created_at),
      ledger: entry.ledger,
      entry_type: entry.entry_type,
      amount_usd: dollars(entry.amount_cents),
      amount_cents: entry.amount_cents,
      contribution_id: entry.contribution_id,
      refund_id: entry.refund_id,
      reference: entry.reference_key,
    })),
    [
      { key: "date_hst", header: "Date (Hawaii time)" },
      { key: "ledger", header: "Ledger" },
      { key: "entry_type", header: "Entry type" },
      { key: "amount_usd", header: "Amount (USD)" },
      { key: "amount_cents", header: "Amount (cents)" },
      { key: "contribution_id", header: "Contribution ID" },
      { key: "refund_id", header: "Refund ID" },
      { key: "reference", header: "Reference" },
    ],
  );
}

export type StatementSummary = {
  donationsReceivedCents: number;
  donationsRefundedCents: number;
  feesChargedCents: number;
  feesRefundedCents: number;
  processorFeesCents: number;
  disputeFeesCents: number;
  mealsRedeemedCents: number;
};

export function summarize(entries: ExportEntry[]): StatementSummary {
  const total = (ledger: ExportEntry["ledger"], types: string[]) =>
    entries.filter((e) => e.ledger === ledger && types.includes(e.entry_type)).reduce((sum, e) => sum + e.amount_cents, 0);
  return {
    donationsReceivedCents: total("pool", ["credit"]),
    donationsRefundedCents: -total("pool", ["refund"]) - total("pool", ["refund_reversal"]),
    feesChargedCents: total("operations", ["fee_charge"]),
    feesRefundedCents: -total("operations", ["fee_refund"]) - total("operations", ["fee_refund_reversal"]),
    processorFeesCents: -total("operations", ["processor_fee", "processor_fee_reversal"]),
    disputeFeesCents: -total("operations", ["dispute_fee", "dispute_fee_reversal"]),
    mealsRedeemedCents: -total("pool", ["redemption"]),
  };
}

export function summaryCsv(month: string, entries: ExportEntry[]): string {
  const s = summarize(entries);
  const netFees = s.feesChargedCents - s.feesRefundedCents;
  const rows: Array<{ section: string; line: string; cents: number }> = [
    { section: "Donations (meal pool)", line: "Donations received", cents: s.donationsReceivedCents },
    { section: "Donations (meal pool)", line: "Donations refunded (incl. chargebacks)", cents: s.donationsRefundedCents },
    { section: "Donations (meal pool)", line: "Net donations", cents: s.donationsReceivedCents - s.donationsRefundedCents },
    { section: "Donations (meal pool)", line: "Meals redeemed (value)", cents: s.mealsRedeemedCents },
    { section: "Operational revenue", line: "Operational fees charged", cents: s.feesChargedCents },
    { section: "Operational revenue", line: "Operational fees refunded", cents: s.feesRefundedCents },
    { section: "Operational revenue", line: "Net fees retained (before expenses)", cents: netFees },
    { section: "Operational revenue", line: "Payment processor fees", cents: s.processorFeesCents },
    { section: "Operational revenue", line: "Dispute costs", cents: s.disputeFeesCents },
    { section: "Operational revenue", line: "Net operational revenue", cents: netFees - s.processorFeesCents - s.disputeFeesCents },
  ];
  return toCsv(
    rows.map((row) => ({ month, ...row, usd: dollars(row.cents) })),
    [
      { key: "month", header: "Month" },
      { key: "section", header: "Section" },
      { key: "line", header: "Line" },
      { key: "usd", header: "Amount (USD)" },
      { key: "cents", header: "Amount (cents)" },
    ],
  );
}
