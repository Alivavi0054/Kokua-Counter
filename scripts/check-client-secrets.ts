import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const staticDir = path.join(process.cwd(), ".next", "static");
const forbiddenMarkers = ["sb_secret", "sk_test", "service_role"];
const violations: string[] = [];

function inspectDirectory(directory: string) {
  for (const entry of readdirSync(directory)) {
    const entryPath = path.join(directory, entry);
    if (statSync(entryPath).isDirectory()) {
      inspectDirectory(entryPath);
      continue;
    }

    const contents = readFileSync(entryPath).toString("utf8");
    if (forbiddenMarkers.some((marker) => contents.includes(marker))) {
      violations.push(path.relative(process.cwd(), entryPath));
    }
  }
}

try {
  inspectDirectory(staticDir);
} catch {
  console.error("Client-secret guard could not read .next/static. Run npm run build first.");
  process.exit(1);
}

if (violations.length > 0) {
  console.error(`Forbidden secret marker found in ${violations.length} built client file(s).`);
  process.exit(1);
}

console.log("Built client contains no forbidden secret markers.");