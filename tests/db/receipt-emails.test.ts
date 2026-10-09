import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { createMigratedDb } from "./harness";

let db: PGlite;
let paidId: string;
let pendingId: string;
const claim = async (id: string) => (await db.query<{ ok: boolean }>("SELECT public.claim_receipt_email($1) AS ok", [id])).rows[0].ok;

beforeEach(async () => {
  db = await createMigratedDb();
  const admin = "10000000-0000-4000-8000-000000000001";
  const paid = (await db.query<{ res: { contribution_id: string; total_charged_cents: number } }>("SELECT public.create_contribution($1, 800, TRUE, NULL) AS res", [admin])).rows[0].res;
  await db.query("SELECT public.record_credit($1, 'cs_r', 'pi_r', $2)", [paid.contribution_id, paid.total_charged_cents]);
  paidId = paid.contribution_id;
  pendingId = (await db.query<{ res: { contribution_id: string } }>("SELECT public.create_contribution($1, 800, TRUE, NULL) AS res", [admin])).rows[0].res.contribution_id;
}, 60_000);

describe("receipt email claims", () => {
  it("lets exactly one caller send the receipt for a paid donation", async () => {
    expect(await claim(paidId)).toBe(true);
    expect(await claim(paidId)).toBe(false);
    expect(await claim(paidId)).toBe(false);
  });

  it("never issues a receipt for an unpaid or unknown donation", async () => {
    expect(await claim(pendingId)).toBe(false);
    expect(await claim("00000000-0000-4000-8000-000000000000")).toBe(false);
  });

  it("a released claim can be taken again after a failed send", async () => {
    expect(await claim(paidId)).toBe(true);
    await db.query("SELECT public.release_receipt_email($1)", [paidId]);
    expect(await claim(paidId)).toBe(true);
  });

  it("stores no email address and is closed to clients", async () => {
    const columns = await db.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_name = 'receipt_emails'");
    expect(columns.rows.map((r) => r.column_name).sort()).toEqual(["claimed_at", "contribution_id"]);
    for (const role of ["anon", "authenticated"]) {
      const fn = await db.query<{ ok: boolean }>("SELECT has_function_privilege($1, 'public.claim_receipt_email(uuid)', 'execute') AS ok", [role]);
      const table = await db.query<{ ok: boolean }>("SELECT has_table_privilege($1, 'public.receipt_emails', 'SELECT') AS ok", [role]);
      expect(fn.rows[0].ok || table.rows[0].ok, role).toBe(false);
    }
  });
});
