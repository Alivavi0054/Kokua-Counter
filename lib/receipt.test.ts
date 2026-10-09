import { describe, expect, it } from "vitest";
import { buildReceiptEmail } from "@/lib/receipt";

const base = {
  contributionId: "abcdef12-3456-4789-8abc-def012345678",
  donationCents: 800,
  feeCents: 40,
  feeRateBps: 500,
  totalCents: 840,
  paidAt: new Date("2026-10-09T20:30:00Z"),
};

describe("buildReceiptEmail", () => {
  it("itemizes donation, fee and total consistently with checkout", () => {
    const { subject, text } = buildReceiptEmail(base);
    expect(subject).toBe("Your Kōkua Counter donation receipt ($8.40)");
    expect(text).toContain("Your donation to the shared meal pool: $8.00 (1 meal)");
    expect(text).toContain("Operational fee (5%): $0.40");
    expect(text).toContain("Total charged: $8.40");
    expect(text).toContain("The meal pool receives your full $8.00 donation.");
    expect(text).toContain("It is not part of your donation.");
    expect(text).toContain("ABCDEF12");
    expect(text).toContain("10:30 AM"); // 20:30 UTC is 10:30 in Honolulu
  });

  it("leaves out the fee lines for legacy fee-free payments", () => {
    const { text } = buildReceiptEmail({ ...base, feeCents: 0, feeRateBps: 0, totalCents: 800 });
    expect(text).not.toContain("Operational fee");
    expect(text).toContain("Total charged: $8.00");
  });

  it("includes configured organization and contact details, with neutral wording otherwise", () => {
    const withDetails = buildReceiptEmail({ ...base, operatingOrganization: "Kōkua Foundation", contactEmail: "help@example.org" });
    expect(withDetails.text).toContain("Operating organization: Kōkua Foundation.");
    expect(withDetails.text).toContain("help@example.org");
    expect(buildReceiptEmail(base).text).toContain("program administrator");
  });

  it("never contains the donor's email or card details", () => {
    const { text } = buildReceiptEmail(base);
    expect(text).not.toMatch(/@.*\.(com|org|edu)/);
  });
});
