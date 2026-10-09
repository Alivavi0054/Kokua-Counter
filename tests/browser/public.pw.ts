import { expect, test, expectAccessible, expectNoHorizontalScroll, snapshot, watchForErrors } from "./helpers";

const pages = [
  ["home", "/"],
  ["about", "/about"],
  ["donate", "/donate"],
  ["sign-in", "/auth/login"],
  ["school-register", "/school/register"],
  ["privacy", "/privacy"],
  ["terms", "/terms"],
] as const;

for (const [name, path] of pages) {
  test(`${name} renders cleanly, fits the screen and is accessible @mobile`, async ({ page }, testInfo) => {
    const problems = watchForErrors(page);
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page, name, testInfo);
    await snapshot(page, name, testInfo);
    expect(problems).toEqual([]);
  });
}

test("the header shows sign-in when signed out and the legal pages are linked from the footer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();
  await page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByText(/privacy contact|program administrator/i).first()).toBeVisible();
  expect(await page.getByText(/\[OWNER/).count()).toBe(0);
});

test("unknown pages show a friendly 404", async ({ page }) => {
  const response = await page.goto("/definitely-not-a-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.getByRole("link", { name: "Return home" }).click();
  await expect(page).toHaveURL("/");
});

test("search engines get a sitemap and robots file that hide private areas", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/donate");
  expect(sitemap).not.toContain("/admin");
});

test("mobile menu opens and links work @mobile", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await page.goto("/");
  await page.getByLabel("Open menu").click();
  await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL(/\/about$/);
});
