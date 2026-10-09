import { defineConfig, devices } from "@playwright/test";

const appPort = process.env.E2E_APP_PORT ?? "3999";
const baseURL = `http://localhost:${appPort}`;

// Runs against a production build served with an in-memory Supabase mock (dummy credentials only).
//   npm run build && npm run test:browser
// Uses the Chrome installed on the machine; set PW_CHANNEL= (empty) to use Playwright's own Chromium
// after `npx playwright install chromium`.
const channel = process.env.PW_CHANNEL === undefined ? "chrome" : process.env.PW_CHANNEL || undefined;

export default defineConfig({
  testDir: "tests/browser",
  testMatch: "**/*.pw.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "test-results/html" }]],
  outputDir: "test-results/artifacts",
  use: {
    baseURL,
    channel,
    trace: "retain-on-failure",
    // The app honors prefers-reduced-motion; without it axe can sample text mid-fade and misreport contrast.
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel }, grep: /@mobile/ },
  ],
  webServer: {
    command: "node scripts/e2e/serve.mjs",
    url: `${baseURL}/api/health`,
    timeout: 60_000,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
  },
});
