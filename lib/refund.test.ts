import { describe, expect, it } from "vitest";
import { buildRefundIdempotencyKey } from "@/lib/refund";

const base = {
  contributionId: "22222222-2222-4222-8222-222222222222",
  amountCents: 500,
  refundedAmountCents: 0,
};

describe("buildRefundIdempotencyKey", () => {
  it("is deterministic so a double submit reuses the same key", () => {
    expect(buildRefundIdempotencyKey(base)).toBe(buildRefundIdempotencyKey({ ...base }));
  });

  it("changes when the amount or the already-refunded total changes", () => {
    const key = buildRefundIdempotencyKey(base);
    expect(buildRefundIdempotencyKey({ ...base, amountCents: 600 })).not.toBe(key);
    expect(buildRefundIdempotencyKey({ ...base, refundedAmountCents: 500 })).not.toBe(key);
    expect(buildRefundIdempotencyKey({ ...base, contributionId: "33333333-3333-4333-8333-333333333333" })).not.toBe(key);
  });

  it("stays within Stripe's 255 character limit", () => {
    expect(buildRefundIdempotencyKey({ ...base, amountCents: 99_999_999 }).length).toBeLessThan(255);
  });
});
