// Runs the permission checks end-to-end against a production build of this app, with
// Supabase replaced by a local in-memory mock. Requires `npm run build` first.
// Uses dummy credentials only; nothing talks to real Supabase or Stripe.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

if (!existsSync(".next/BUILD_ID")) {
  console.error("No production build found. Run `npm run build` first.");
  process.exit(2);
}

const PORT = process.env.E2E_APP_PORT ?? "3999";
const MOCK_PORT = process.env.E2E_MOCK_PORT ?? "54399";
const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "e2e-service-key",
  APP_URL: `http://localhost:${PORT}`,
  STRIPE_SECRET_KEY: "sk_test_e2e_dummy",
  STRIPE_WEBHOOK_SECRET: "whsec_e2e_dummy",
  CRON_SECRET: "e2e-cron-secret",
  ENABLE_DEV_LOGIN: "false",
  E2E_BASE_URL: `http://localhost:${PORT}`,
  E2E_MOCK_PORT: MOCK_PORT,
};

const server = spawn("npx", ["next", "start", "-p", PORT], { env, stdio: ["ignore", "pipe", "pipe"] });
let ready = false;
server.stdout.on("data", (chunk) => { if (/Ready|started server/i.test(String(chunk))) ready = true; });
server.stderr.on("data", (chunk) => process.stderr.write(chunk));

const stop = () => server.kill("SIGTERM");
process.on("exit", stop);

for (let i = 0; i < 60 && !ready; i += 1) await new Promise((r) => setTimeout(r, 500));
if (!ready) { console.error("App did not start in time."); stop(); process.exit(2); }

const checks = spawn("node", ["scripts/e2e/permissions.mjs"], { env, stdio: "inherit" });
checks.on("exit", (code) => { stop(); process.exit(code ?? 1); });
