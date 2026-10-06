import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { requireEnv } from "@/lib/env";

async function main() {
  const client = new Client({ connectionString: requireEnv("DATABASE_URL", "scripts/verify.ts") });
  await client.connect();
  try {
    const sql = readFileSync(path.join(process.cwd(), "supabase", "tests", "accounting.sql"), "utf8");
    await client.query(sql);
    console.log("Accounting verification passed.");
  } finally {
    await client.end();
  }
}

main().catch(() => {
  console.error("Accounting verification failed. Check the database connection and SQL test output.");
  process.exit(1);
});