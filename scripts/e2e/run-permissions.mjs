// Runs the permission checks end-to-end against a production build of this app, with
// Supabase replaced by a local in-memory mock. Requires `npm run build` first.
// Uses dummy credentials only; nothing talks to real Supabase or Stripe.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { e2eEnv } from "./env.mjs";

// Run Next directly with this Node binary (not through npx) so that stopping it really stops the server
// and leaves the port free for the next test run.
const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");

if (!existsSync(".next/BUILD_ID")) {
  console.error("No production build found. Run `npm run build` first.");
  process.exit(2);
}

const PORT = process.env.E2E_APP_PORT ?? "3999";
const MOCK_PORT = process.env.E2E_MOCK_PORT ?? "54399";
const env = e2eEnv({ appPort: PORT, mockPort: MOCK_PORT });

const server = spawn(process.execPath, [nextBin, "start", "-p", PORT], { env, stdio: ["ignore", "pipe", "pipe"] });
let ready = false;
server.stdout.on("data", (chunk) => { if (/Ready|started server/i.test(String(chunk))) ready = true; });
server.stderr.on("data", (chunk) => process.stderr.write(chunk));

const stop = () => server.kill("SIGTERM");
process.on("exit", stop);

for (let i = 0; i < 60 && !ready; i += 1) await new Promise((r) => setTimeout(r, 500));
if (!ready) { console.error("App did not start in time."); stop(); process.exit(2); }

const checks = spawn("node", ["scripts/e2e/permissions.mjs"], { env, stdio: "inherit" });
checks.on("exit", (code) => { stop(); process.exit(code ?? 1); });
