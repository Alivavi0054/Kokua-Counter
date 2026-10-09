import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createMigratedDb } from "./harness";

// Runs the repo's own SQL accounting suite (also used by `npm run verify` against a real database)
// inside an in-memory Postgres with every migration applied.
describe("supabase/tests/accounting.sql", () => {
  it("passes against the current migrations", async () => {
    const db = await createMigratedDb();
    await db.exec(readFileSync("supabase/tests/accounting.sql", "utf8"));
    expect(true).toBe(true);
  }, 120_000);
});
