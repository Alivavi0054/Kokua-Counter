import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { createMigratedDb } from "./harness";

let db: PGlite;
beforeEach(async () => {
  db = await createMigratedDb();
}, 60_000);

describe("admin_audit_log", () => {
  it("accepts entries and can never be edited or deleted", async () => {
    await db.query("INSERT INTO public.admin_audit_log (actor_user_id, action, target_type, details) VALUES ($1, 'fee.rate_changed', 'fee_settings', '{\"rate_bps\":500}')", [
      "10000000-0000-4000-8000-000000000001",
    ]);
    await expect(db.query("UPDATE public.admin_audit_log SET action = 'fee.rate_changed2'")).rejects.toThrow(/append-only/);
    await expect(db.query("DELETE FROM public.admin_audit_log")).rejects.toThrow(/append-only/);
    await expect(db.query("TRUNCATE public.admin_audit_log")).rejects.toThrow(/append-only/);
  });

  it("rejects malformed entries", async () => {
    await expect(db.query("INSERT INTO public.admin_audit_log (actor_user_id, action) VALUES (gen_random_uuid(), 'x')")).rejects.toThrow();
    await expect(db.query("INSERT INTO public.admin_audit_log (actor_user_id, action) VALUES (NULL, 'user.created')")).rejects.toThrow();
  });

  it("is invisible to clients and the service role cannot rewrite it", async () => {
    for (const role of ["anon", "authenticated"]) {
      const r = await db.query<{ ok: boolean }>("SELECT has_table_privilege($1, 'public.admin_audit_log', 'SELECT') AS ok", [role]);
      expect(r.rows[0].ok, role).toBe(false);
    }
    for (const privilege of ["UPDATE", "DELETE", "TRUNCATE"]) {
      const r = await db.query<{ ok: boolean }>("SELECT has_table_privilege('service_role', 'public.admin_audit_log', $1) AS ok", [privilege]);
      expect(r.rows[0].ok, privilege).toBe(false);
    }
    const insert = await db.query<{ ok: boolean }>("SELECT has_table_privilege('service_role', 'public.admin_audit_log', 'INSERT') AS ok");
    expect(insert.rows[0].ok).toBe(true);
  });
});
