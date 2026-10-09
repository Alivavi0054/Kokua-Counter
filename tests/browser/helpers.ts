import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";

export { expect };

// Every test gets its own client IP (the header the app trusts on Vercel), so the sign-in and checkout
// rate limits, which are per IP, do not make unrelated tests interfere with each other.
let nextClient = Math.floor(Math.random() * 200);
export const test = base.extend({
  page: async ({ page }, applyFixture) => {
    nextClient += 1;
    await page.context().setExtraHTTPHeaders({ "x-real-ip": `198.51.${100 + (nextClient % 100)}.${(nextClient % 250) + 1}` });
    await applyFixture(page);
  },
});

export const MOCK = `http://127.0.0.1:${process.env.E2E_MOCK_PORT ?? "54399"}`;

export const accounts = {
  admin: { email: "admin@example.com", home: "/admin" },
  eatery: { email: "eatery@example.com", home: "/eatery" },
  student: { email: "student@hawaii.edu", home: "/student" },
} as const;

/** Signs in through the real login form (password "pw" is accepted by the mock for every account). */
export async function signIn(page: Page, role: keyof typeof accounts, password = "pw") {
  await page.goto("/auth/login");
  await page.getByLabel("Email address").fill(accounts[role].email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

export async function signInAndWait(page: Page, role: keyof typeof accounts) {
  await signIn(page, role);
  await page.waitForURL((url) => url.pathname === accounts[role].home);
}

/** Collects console errors and uncaught exceptions so a test can assert the page was clean. */
export function watchForErrors(page: Page): string[] {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    // Vercel Analytics only exists on Vercel; its script 404s on a local server and is not an app error.
    if (message.type() === "error" && !message.text().includes("/_vercel/") && !message.location().url.includes("/_vercel/")) problems.push(`console: ${message.text()}`);
  });
  return problems;
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page should not scroll sideways").toBeLessThanOrEqual(1);
}

/** WCAG 2.x A/AA scan. Fails on serious or critical problems and attaches the full list otherwise. */
export async function expectAccessible(page: Page, label: string, testInfo: TestInfo) {
  // Let CSS transitions and animations finish so axe never measures a colour half-way through a change.
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.slice(0, 4).map((node) => ({
      target: node.target.join(" "),
      detail: node.any[0]?.data && typeof node.any[0].data === "object"
        ? Object.fromEntries(Object.entries(node.any[0].data).filter(([key]) => ["fgColor", "bgColor", "contrastRatio", "fontSize", "expectedContrastRatio"].includes(key)))
        : undefined,
    })),
  }));
  if (summary.length > 0) {
    await testInfo.attach(`axe-${label}.json`, { body: JSON.stringify(summary, null, 2), contentType: "application/json" });
  }
  const blocking = summary.filter((violation) => violation.impact === "serious" || violation.impact === "critical");
  expect(blocking, `accessibility problems on ${label}:\n${JSON.stringify(blocking, null, 2)}`).toEqual([]);
}

export async function snapshot(page: Page, name: string, testInfo: TestInfo) {
  mkdirSync("test-results/screens", { recursive: true });
  await page.screenshot({ path: `test-results/screens/${testInfo.project.name}-${name}.png`, fullPage: true });
}

/** The page's own alerts, excluding Next's invisible route announcer (which also has role="alert"). */
export function alertBox(page: Page) {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}
