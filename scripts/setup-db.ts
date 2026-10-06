import { readFileSync, readdirSync } from "fs";
import path from "path";
import { Client } from "pg";
import { requireEnv } from "@/lib/env";

const databaseUrl = requireEnv("DATABASE_URL", "db:setup");

const migrationDir = path.join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationDir)
  .filter((file) => file.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public._migrations_applied (
        id SERIAL PRIMARY KEY,
        file_name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    for (const fileName of migrationFiles) {
      const filePath = path.join(migrationDir, fileName);
      const alreadyApplied = await client.query(
        "SELECT 1 FROM public._migrations_applied WHERE file_name = $1",
        [fileName],
      );

      if (alreadyApplied.rowCount && alreadyApplied.rowCount > 0) {
        console.log(`SKIP ${fileName}`);
        continue;
      }

      const sql = readFileSync(filePath, "utf8");
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO public._migrations_applied (file_name) VALUES ($1)",
          [fileName],
        );
        await client.query("COMMIT");
        console.log(`APPLIED ${fileName}`);
      } catch (error) {
        await client.query("ROLLBACK");
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${message} (${fileName})`);
      }
    }

    console.log("Database setup complete.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Database setup failed: ${message}`);
  process.exit(1);
});
