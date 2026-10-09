import { formatFeeRate } from "@/lib/fees";
import { formatUsdFromCents, mealsFromCents } from "@/lib/utils";

export type ReceiptInput = {
  contributionId: string;
  donationCents: number;
  feeCents: number;
  feeRateBps: number;
  totalCents: number;
  paidAt: Date;
  operatingOrganization?: string | null;
  contactEmail?: string | null;
};

/** Plain-text donation receipt. Amounts are the stored snapshot, identical to what checkout showed. */
export function buildReceiptEmail(input: ReceiptInput): { subject: string; text: string } {
  const meals = mealsFromCents(input.donationCents);
  const date = new Intl.DateTimeFormat("en-US", { timeZone: "Pacific/Honolulu", dateStyle: "long", timeStyle: "short" }).format(input.paidAt);
  const lines = [
    "Mahalo for your gift to Kōkua Counter!",
    "",
    `Receipt for donation ${input.contributionId.slice(0, 8).toUpperCase()}`,
    `Date: ${date} (Hawaiʻi time)`,
    "",
    `Your donation to the shared meal pool: ${formatUsdFromCents(input.donationCents)}${meals > 0 ? ` (${meals} meal${meals === 1 ? "" : "s"})` : ""}`,
    ...(input.feeCents > 0 ? [`Operational fee (${formatFeeRate(input.feeRateBps)}): ${formatUsdFromCents(input.feeCents)}`] : []),
    `Total charged: ${formatUsdFromCents(input.totalCents)}`,
    "",
    `The meal pool receives your full ${formatUsdFromCents(input.donationCents)} donation.`,
    ...(input.feeCents > 0
      ? ["The operational fee was added on top of your donation to help cover platform operating costs such as software, hosting and staff. It is not part of your donation."]
      : []),
    "",
    `Donations fund the shared pool and are not tax-deductible unless the operating organization is a registered nonprofit.${
      input.operatingOrganization ? ` Operating organization: ${input.operatingOrganization}.` : ""
    }`,
    input.contactEmail ? `Questions or refund requests: ${input.contactEmail}` : "Questions or refund requests: reply to the program administrator.",
    "",
    "Stripe may also send you its own payment receipt.",
  ];
  return { subject: `Your Kōkua Counter donation receipt (${formatUsdFromCents(input.totalCents)})`, text: lines.join("\n") };
}
