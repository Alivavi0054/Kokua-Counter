import { describe, expect, it, vi } from "vitest";
import { settleEatery, type CreateSettlementOutcome, type SettlementDeps } from "@/lib/settlement";

const created = {
  ok: true as const,
  settlement_id: "11111111-1111-4111-8111-111111111111",
  amount_cents: 2500,
  stripe_connect_account_id: "acct_test_123",
};

function makeDeps(createResult: CreateSettlementOutcome = created) {
  const createSettlement = vi.fn<SettlementDeps["createSettlement"]>().mockResolvedValue(createResult);
  const markSettlementResult = vi.fn<SettlementDeps["markSettlementResult"]>().mockResolvedValue(undefined);
  const transfersCreate = vi
    .fn<SettlementDeps["stripe"]["transfers"]["create"]>()
    .mockResolvedValue({ id: "tr_test_1" });
  const log = vi.fn<NonNullable<SettlementDeps["log"]>>();
  const deps: SettlementDeps = {
    createSettlement,
    markSettlementResult,
    stripe: { transfers: { create: transfersCreate } },
    log,
  };
  return { deps, markSettlementResult, transfersCreate, log };
}

describe("settleEatery", () => {
  it("pays the transfer with an idempotency key and marks the settlement paid", async () => {
    const { deps, markSettlementResult, transfersCreate } = makeDeps();
    const result = await settleEatery("eatery-1", deps);

    expect(result).toEqual({ status: "paid", settlementId: created.settlement_id, amountCents: 2500 });
    expect(transfersCreate).toHaveBeenCalledWith(
      {
        amount: 2500,
        currency: "usd",
        destination: "acct_test_123",
        metadata: { settlement_id: created.settlement_id },
      },
      { idempotencyKey: created.settlement_id },
    );
    expect(markSettlementResult).toHaveBeenCalledTimes(1);
    expect(markSettlementResult).toHaveBeenCalledWith({
      settlementId: created.settlement_id,
      status: "paid",
      stripeTransferId: "tr_test_1",
    });
  });

  it("does not call Stripe when there is nothing to settle", async () => {
    const { deps, markSettlementResult, transfersCreate } = makeDeps({
      ok: false,
      error_code: "nothing_to_settle",
    });
    const result = await settleEatery("eatery-1", deps);

    expect(result).toEqual({ status: "not_settleable", errorCode: "nothing_to_settle" });
    expect(transfersCreate).not.toHaveBeenCalled();
    expect(markSettlementResult).not.toHaveBeenCalled();
  });

  it("marks the settlement failed (releasing redemptions) when Stripe rejects the transfer", async () => {
    const { deps, markSettlementResult, transfersCreate } = makeDeps();
    transfersCreate.mockRejectedValue(
      Object.assign(new Error("insufficient funds"), { type: "StripeInvalidRequestError" }),
    );
    const result = await settleEatery("eatery-1", deps);

    expect(result).toEqual({ status: "transfer_failed", settlementId: created.settlement_id });
    expect(markSettlementResult).toHaveBeenCalledWith({
      settlementId: created.settlement_id,
      status: "failed",
    });
  });

  it("still reports the transfer failure if marking it failed also throws", async () => {
    const { deps, markSettlementResult, transfersCreate, log } = makeDeps();
    transfersCreate.mockRejectedValue(new Error("boom"));
    markSettlementResult.mockRejectedValue(new Error("db down"));
    const result = await settleEatery("eatery-1", deps);

    expect(result).toEqual({ status: "transfer_failed", settlementId: created.settlement_id });
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("does NOT release redemptions when the transfer succeeded but marking paid failed", async () => {
    const { deps, markSettlementResult, log } = makeDeps();
    markSettlementResult.mockRejectedValue(new Error("db down"));
    const result = await settleEatery("eatery-1", deps);

    expect(result).toEqual({
      status: "needs_reconciliation",
      settlementId: created.settlement_id,
      transferId: "tr_test_1",
    });
    expect(markSettlementResult).toHaveBeenCalledTimes(1);
    expect(markSettlementResult).not.toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("reconcile manually"),
      expect.objectContaining({ settlementId: created.settlement_id, transferId: "tr_test_1" }),
    );
  });

  it("leaves the settlement processing when Stripe's outcome is unknown (connection error)", async () => {
    const { deps, markSettlementResult, transfersCreate } = makeDeps();
    transfersCreate.mockRejectedValue(
      Object.assign(new Error("socket hang up"), { type: "StripeConnectionError" }),
    );
    const result = await settleEatery("eatery-1", deps);

    expect(result).toEqual({
      status: "needs_reconciliation",
      settlementId: created.settlement_id,
      transferId: null,
    });
    expect(markSettlementResult).not.toHaveBeenCalled();
  });
});
