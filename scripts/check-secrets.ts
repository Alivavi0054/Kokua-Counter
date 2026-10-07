import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const SECRET_PATTERNS = [
  /sk_[A-Za-z0-9]+/g,
  /sb_secret/gi,
  /service_role/gi,
  /whsec_[A-Za-z0-9]+/g,
  /postgres(?:ql)?:\/\/[^\s"'<>]+:[^\s"'<>@]+@/gi,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /Authorization:\s*Bearer\s+[A-Za-z0-9._-]+/gi,
];

const PLACEHOLDER_HINTS = [
  "example",
  "placeholder",
  "replace_me",
  "changeme",
  "your_key",
  "your_secret",
  "demo",
];

export function detectSecretPatterns(content: string): string[] {
  const hits: string[] = [];
  const seen = new Set<string>();

  for (const pattern of SECRET_PATTERNS) {
    for (const match of content.match(pattern) ?? []) {
      const normalized = match.toLowerCase();
      const hasPlaceholderHint = PLACEHOLDER_HINTS.some((hint) => normalized.includes(hint));
      const isEnvNameOnly =
        normalized.includes("service_role") ||
        normalized.includes("sb_secret") ||
        normalized.includes("next_public_") ||
        normalized.includes("supabase_") ||
        normalized.includes("stripe_") ||
        normalized.includes("database_url") ||
        normalized.includes("auth_token");

      if (isEnvNameOnly || hasPlaceholderHint) {
        continue;
      }

      const truncated = match.slice(0, 18);
      if (!seen.has(truncated)) {
        seen.add(truncated);
        hits.push(truncated);
      }
    }
  }

  return hits;
}

const repoRoot = path.resolve(__dirname, "..");
const skipDirs = new Set([".git", ".next", "node_modules", "coverage", "dist", "build"]);
const skipFiles = new Set([
  "lib/security.test.ts",
  "scripts/check-client-secrets.ts",
]);

function scanDir(currentDir: string, hits: string[]) {
  for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      scanDir(fullPath, hits);
      continue;
    }
    if (entry.name === ".env" || entry.name.startsWith(".env.")) continue;
    if (entry.name.endsWith(".example") || entry.name.endsWith(".example.")) continue;
    const relativePath = path.relative(repoRoot, fullPath).replace(/\\/g, "/");
    if (skipFiles.has(relativePath)) continue;
    if (!/\.(ts|tsx|js|mjs|cjs|json|md|sql|txt)$/i.test(entry.name)) continue;

    const content = readFileSync(fullPath, "utf8");
    const matches = detectSecretPatterns(content);
    if (matches.length > 0) {
      hits.push(`${path.relative(repoRoot, fullPath)}:${matches.length}`);
    }
  }
}

function main() {
  const hits: string[] = [];
  scanDir(repoRoot, hits);

  const nextStaticDir = path.join(repoRoot, ".next", "static");
  try {
    scanDir(nextStaticDir, hits);
  } catch {
    // .next/static may not exist yet.
  }

  if (hits.length > 0) {
    console.error("Potential secret patterns detected:");
    for (const hit of hits) {
      console.error(`- ${hit}`);
    }
    process.exit(1);
  }

  console.log("No secret patterns found in tracked source files.");
}

if (require.main === module) {
  main();
}
