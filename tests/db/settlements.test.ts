import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { createMigratedDb } from "./harness";

const ADMIN = "10000000-0000-4000-8000-000000000001";
const STUDENT = "10000000-0000-4000-8000-000000000002";
const EATERY_USER = "10000000-0000-4000-8000-000000000003";

let db: PGlite;
let eateryId: string;
let counter = 0;

type Json = Record<string, unknown>;
const rpc = async (sql: string, params: unknown[] = []) => (await db.query<{ res: Json }>(`SELECT ${sql} AS res`, params)).rows[0].res;
const scalar = async (sql: string, params: unknown[] = []) => Number(Object.values((await db.query<Record<string, unknown>>(sql, params)).rows[0])[0]);

/** A donor pays (with the operational fee) and a student redeems one meal at the test eatery. */
async function redeemOneMeal() {
  counter += 1;
  const c = await rpc("public.create_contribution($1, 800, TRUE, NULL)", [ADMIN]);
  await db.query("SELECT public.record_credit($1, $2, $3, $4)", [c.contribution_id, `cs_${counter}`, `pi_${counter}`, c.total_charged_cents]);
  const hash = (await db.query<{ h: string }>("SELECT encode(extensions.digest($1, 'sha256'), 'hex') AS h", [`token-${counter}`])).rows[0].h;
  const hold = await rpc("public.create_qr_hold($1, $2, now() + interval '30 minutes', 10, 20, 30, now())", [STUDENT, hash]);
  expect(hold.ok, JSON.stringify(hold)).toBe(true);
  const redeemed = await rpc("public.redeem_qr($1, $2, 200, now())", [hash, EATERY_USER]);
  expect(redeemed.ok, JSON.stringify(redeemed)).toBe(true);
}

const settle = () => rpc("public.create_settlement($1, now())", [eateryId]);
const markResult = (id: unknown, status: string, transfer: string | null = null) =>
  db.query("SELECT public.mark_settlement_result($1, $2::public.settlement_status, $3, NULL)", [id, status, transfer]);

beforeEach(async () => {
  db = await createMigratedDb();
  counter = 0;
  eateryId = (await db.query<{ id: string }>("SELECT id FROM public.eateries LIMIT 1")).rows[0].id;
}, 60_000);

describe("create_settlement", () => {
  it("reports unknown eateries, missing payout accounts and nothing to settle", async () => {
    expect((await rpc("public.create_settlement(gen_random_uuid(), now())")).error_code).toBe("eatery_not_found");
    expect((await settle()).error_code).toBe("payouts_not_connected");
    await db.query("UPDATE public.eateries SET stripe_connect_account_id = 'acct_test_1'");
    expect((await settle()).error_code).toBe("nothing_to_settle");
  });

  it("pays exactly the redeemed meal value (donation principal), never any operational fee", async () => {
    await db.query("UPDATE public.eateries SET stripe_connect_account_id = 'acct_test_1'");
    await redeemOneMeal();
    await redeemOneMeal();
    await redeemOneMeal();

    const feesBefore = await scalar("SELECT COALESCE(SUM(amount_cents), 0) FROM public.operations_ledger");
    expect(feesBefore).toBe(120); // 3 x $0.40 kept apart from the pool
    const result = await settle();
    expect(result).toMatchObject({ ok: true, amount_cents: 2400, stripe_connect_account_id: "acct_test_1" });
    expect(await scalar("SELECT COUNT(*) FROM public.redemptions WHERE settlement_id = $1", [result.settlement_id])).toBe(3);
    // settling moves no operating money and no pool money (the meals were already deducted when redeemed)
    expect(await scalar("SELECT COALESCE(SUM(amount_cents), 0) FROM public.operations_ledger")).toBe(feesBefore);
    expect(await scalar("SELECT public.get_pool_balance()")).toBe(0);
  });

  it("cannot pay the same redemptions twice", async () => {
    await db.query("UPDATE public.eateries SET stripe_connect_account_id = 'acct_test_1'");
    await redeemOneMeal();
    const first = await settle();
    expect(first.ok).toBe(true);
    expect((await settle()).error_code).toBe("nothing_to_settle");
    expect(await scalar("SELECT COUNT(*) FROM public.settlements")).toBe(1);
  });

  it("a later settlement contains only meals redeemed since the last one", async () => {
    await db.query("UPDATE public.eateries SET stripe_connect_account_id = 'acct_test_1'");
    await redeemOneMeal();
    const first = await settle();
    await markResult(first.settlement_id, "paid", "tr_1");
    await redeemOneMeal();
    await redeemOneMeal();
    expect(await settle()).toMatchObject({ ok: true, amount_cents: 1600 });
  });
});

describe("mark_settlement_result", () => {
  beforeEach(async () => {
    await db.query("UPDATE public.eateries SET stripe_connect_account_id = 'acct_test_1'");
    await redeemOneMeal();
    await redeemOneMeal();
  });

  it("a failed transfer releases the redemptions so they are paid next time", async () => {
    const first = await settle();
    await markResult(first.settlement_id, "failed");
    expect(await scalar("SELECT COUNT(*) FROM public.redemptions WHERE settlement_id IS NOT NULL")).toBe(0);
    expect(await settle()).toMatchObject({ ok: true, amount_cents: 1600 });
  });

  it("a paid settlement keeps its redemptions and records the transfer", async () => {
    const first = await settle();
    await markResult(first.settlement_id, "paid", "tr_abc");
    const row = (await db.query<{ status: string; stripe_transfer_id: string }>("SELECT status, stripe_transfer_id FROM public.settlements WHERE id = $1", [first.settlement_id])).rows[0];
    expect(row).toMatchObject({ status: "paid", stripe_transfer_id: "tr_abc" });
    expect(await scalar("SELECT COUNT(*) FROM public.redemptions WHERE settlement_id = $1", [first.settlement_id])).toBe(2);
  });

  it("repeating the same result is harmless", async () => {
    const first = await settle();
    await markResult(first.settlement_id, "paid", "tr_abc");
    await markResult(first.settlement_id, "paid", "tr_abc");
    expect(await scalar("SELECT COUNT(*) FROM public.redemptions WHERE settlement_id = $1", [first.settlement_id])).toBe(2);
  });

  it("a settlement that was paid can never be flipped to failed (that would release it to be paid again)", async () => {
    const first = await settle();
    await markResult(first.settlement_id, "paid", "tr_abc");
    await expect(markResult(first.settlement_id, "failed")).rejects.toThrow(/settlement_already_finalised/);
    expect(await scalar("SELECT COUNT(*) FROM public.redemptions WHERE settlement_id = $1", [first.settlement_id])).toBe(2);
    expect((await settle()).error_code).toBe("nothing_to_settle");
  });

  it("a failed settlement cannot later be marked paid after its redemptions were released", async () => {
    const first = await settle();
    await markResult(first.settlement_id, "failed");
    await expect(markResult(first.settlement_id, "paid", "tr_late")).rejects.toThrow(/settlement_already_finalised/);
  });

  it("an unknown settlement id is an error, not a silent no-op", async () => {
    await expect(markResult("00000000-0000-4000-8000-000000000000", "paid", "tr_x")).rejects.toThrow(/settlement_not_found/);
  });
});

describe("refund after payout", () => {
  it("a refund of a donation whose meal was already paid out is booked as a recovery obligation", async () => {
    await db.query("UPDATE public.eateries SET stripe_connect_account_id = 'acct_test_1'");
    await redeemOneMeal();
    const s = await settle();
    await markResult(s.settlement_id, "paid", "tr_1");

    const contributionId = (await db.query<{ id: string }>("SELECT id FROM public.contributions LIMIT 1")).rows[0].id;
    const reserved = await rpc("public.reserve_refund($1, NULL, 'test', $2, NULL)", [contributionId, ADMIN]);
    expect(reserved).toMatchObject({ ok: true, amount_cents: 840 });
    await db.query("SELECT public.record_refund($1, 're_after_payout', 840, $2, 'succeeded')", [contributionId, reserved.refund_id]);

    const summary = await rpc("public.finance_summary()");
    expect(summary).toMatchObject({ outstanding_recovery_cents: 800, settlements_paid_cents: 800, pool_balance_cents: -800, net_fees_retained_cents: 0 });
    expect(await rpc("public.finance_reconciliation()")).toEqual({ ok: true, issues: [] });
  });
});
