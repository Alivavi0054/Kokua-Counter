import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { requireEnv } from "@/lib/env";

type PostgresFailure = Error & {
  code?: string;
  position?: string;
};

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown verification error.";
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[database connection string redacted]")
    .replace(/((?:password|secret|key)=)[^\s&]+/gi, "$1[redacted]");
}

async function main() {
  const client = new Client({ connectionString: requireEnv("DATABASE_URL", "scripts/verify.ts") });
  await client.connect();
  try {
    const sql = readFileSync(path.join(process.cwd(), "supabase", "tests", "accounting.sql"), "utf8");
    try {
      await client.query(sql);
    } catch (error) {
      const postgresError = error as PostgresFailure;
      const errorLine = postgresError.position
        ? sql.slice(0, Number(postgresError.position) - 1).split("\n").length
        : null;
      const location = errorLine ? ` at accounting.sql line ${errorLine}` : "";
      const code = postgresError.code ? ` [SQLSTATE ${postgresError.code}]` : "";
      throw new Error(`${safeErrorMessage(error)}${code}${location}`);
    }
    console.log("Accounting verification passed.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Accounting verification failed: ${safeErrorMessage(error)}`);
  process.exit(1);
});