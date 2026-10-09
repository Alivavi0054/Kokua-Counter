// Starts the mocked Supabase and a production build of the app, and keeps both running until stopped.
// Used by Playwright (see playwright.config.ts). Requires `npm run build` first.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { e2eEnv } from "./env.mjs";
import { startMock } from "./mock-supabase.mjs";

if (!existsSync(".next/BUILD_ID")) {
  console.error("No production build found. Run `npm run build` first.");
  process.exit(2);
}

const appPort = process.env.E2E_APP_PORT ?? "3999";
const mockPort = process.env.E2E_MOCK_PORT ?? "54399";
const env = e2eEnv({ appPort, mockPort });

const mock = await startMock(Number(mockPort));
const server = spawn("npx", ["next", "start", "-p", appPort], { env, stdio: "inherit" });

const stop = () => {
  server.kill("SIGTERM");
  mock.close();
};
process.on("SIGTERM", () => { stop(); process.exit(0); });
process.on("SIGINT", () => { stop(); process.exit(0); });
server.on("exit", (code) => { mock.close(); process.exit(code ?? 0); });
