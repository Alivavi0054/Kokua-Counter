import { alertBox, expect, test, MOCK, expectAccessible, expectNoHorizontalScroll, signInAndWait, snapshot, watchForErrors } from "./helpers";

test.describe("student", () => {
  test.beforeEach(async ({ request }) => {
    await request.post(`${MOCK}/__mock/reset`);
  });

  test("gets a single-use pass, sees it redeemed, and finds it in their history @mobile", async ({ page }, testInfo) => {
    const problems = watchForErrors(page);
    await signInAndWait(page, "student");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Ready for a meal?");
    await expectAccessible(page, "student-home", testInfo);

    await page.getByRole("button", { name: "Get meal pass" }).click();
    await expect(page.getByText("Show this pass at the counter")).toBeVisible();
    await expect(page.locator("svg[role=img]").first()).toBeVisible(); // the QR code
    await expect(page.getByRole("timer")).toBeVisible();
    await expect(page.getByText(/Pass expires at/)).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectAccessible(page, "student-pass", testInfo);
    await snapshot(page, "student-pass", testInfo);

    // an eatery scans it
    await page.request.post(`${MOCK}/__mock/redeem`);
    await expect(page.getByText("Enjoy your meal!")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("link", { name: "View history" }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Meal pass history");
    await expect(page.getByText("Meal redeemed")).toBeVisible();
    await expectAccessible(page, "student-history", testInfo);
    expect(problems.filter((p) => !p.includes("/api/qr/status"))).toEqual([]);
  });

  test("a second pass request while one is active is refused politely", async ({ page, request }) => {
    await signInAndWait(page, "student");
    await page.getByRole("button", { name: "Get meal pass" }).click();
    await expect(page.getByText("Show this pass at the counter")).toBeVisible();
    // simulate a second device asking again
    const again = await page.request.post("/api/qr/generate", { headers: { origin: "http://localhost:3999" } });
    expect(again.status()).toBe(409);
    expect((await again.json()).error).toMatch(/active meal pass/);
    void request;
  });
});

test.describe("eatery", () => {
  test("sees today's counter, payouts status and can open the scanner", async ({ page }, testInfo) => {
    const problems = watchForErrors(page);
    await signInAndWait(page, "eatery");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Kai's Poi Shack");
    await expect(page.getByText("Meals accepted today")).toBeVisible();
    await expect(page.getByText("Not connected")).toBeVisible();
    await expectAccessible(page, "eatery-home", testInfo);
    await snapshot(page, "eatery-home", testInfo);

    await page.getByRole("link", { name: "Scan meal pass" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Scan meal pass");
    await expect(page.getByRole("button", { name: "Enable camera" })).toBeVisible();
    await expectAccessible(page, "eatery-scan", testInfo);
    expect(problems).toEqual([]);
  });

  test("the camera starts with a (fake) device and shows the active state", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "fake camera flags are Chromium only");
    await page.context().grantPermissions(["camera"]);
    await signInAndWait(page, "eatery");
    await page.goto("/eatery/scan");
    await page.getByRole("button", { name: "Enable camera" }).click();
    await expect(page.getByText("Camera is active and scanning")).toBeVisible({ timeout: 20_000 });
  });

  test("payout setup failures are explained without developer jargon", async ({ page }) => {
    await page.route("**/api/eatery/connect/onboard", (route) => route.fulfill({ status: 403, json: { error: "Payout setup is not available yet." } }));
    await signInAndWait(page, "eatery");
    await page.getByRole("button", { name: "Set up payouts" }).click();
    await expect(alertBox(page)).toContainText("contact the program team");
    await expect(alertBox(page)).not.toContainText("npm run");
  });
});

test.describe("admin", () => {
  test("can reach every section from the admin navigation", async ({ page }, testInfo) => {
    const problems = watchForErrors(page);
    await signInAndWait(page, "admin");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Kōkua Counter");
    await expectAccessible(page, "admin-overview", testInfo);
    await snapshot(page, "admin-overview", testInfo);

    const nav = page.getByRole("navigation", { name: "Admin sections" });
    const sections: Array<[string, string, string]> = [
      ["Finance", "/admin/finance", "Finance"],
      ["Contributions", "/admin/contributions", "Contributions"],
      ["Users", "/admin/users", "Users"],
      ["Eateries", "/admin/eateries", "Eateries"],
      ["Organizations", "/admin/organizations", "Organizations"],
      ["School registrations", "/admin/registrations", "School registrations"],
      ["Audit log", "/admin/audit", "Audit log"],
    ];
    for (const [label, path, heading] of sections) {
      await nav.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL((url) => url.pathname === path);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
      await expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
      await expectAccessible(page, `admin-${path.split("/").pop()}`, testInfo);
      await snapshot(page, `admin-${path.split("/").pop()}`, testInfo);
    }
    expect(problems).toEqual([]);
  });

  test("finance shows the separated ledgers, the fee setting and statement downloads", async ({ page }) => {
    await signInAndWait(page, "admin");
    await page.goto("/admin/finance");
    await expect(page.getByRole("heading", { name: "Operational revenue", exact: true })).toBeVisible();
    await expect(page.getByText("Operational fees charged")).toBeVisible();
    await expect(page.getByText("Payment processor fees")).toBeVisible();
    await expect(page.getByText("Net operational revenue")).toBeVisible();
    await expect(page.getByText("Current fee: 5%")).toBeVisible();
    await expect(page.getByText("Ledgers reconcile")).toBeVisible();
    await expect(page.getByLabel("Month", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Summary CSV" })).toBeVisible();
  });

  test("the fee form only accepts valid percentages", async ({ page }) => {
    await signInAndWait(page, "admin");
    await page.goto("/admin/finance");
    const input = page.getByLabel("New fee (%)");
    const button = page.getByRole("button", { name: /Set fee to|Enter a valid percentage/ });
    for (const bad of ["abc", "21", "-1", "5.555", ""]) {
      await input.fill(bad);
      await expect(button, bad).toBeDisabled();
    }
    await input.fill("7.5");
    await expect(page.getByRole("button", { name: "Set fee to 7.5%" })).toBeEnabled();
  });

  test("the statement download returns a CSV file", async ({ page }) => {
    await signInAndWait(page, "admin");
    const response = await page.request.get("/api/admin/finance/export?month=2026-10&view=summary");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    expect(await response.text()).toContain("Net operational revenue");
  });

  test("list search keeps its text, and filters are applied from the URL", async ({ page }) => {
    await signInAndWait(page, "admin");
    await page.goto("/admin/users?q=Student&role=student");
    await expect(page.getByRole("searchbox").or(page.getByLabel("Search by name"))).toHaveValue("Student");
    await expect(page.getByLabel("All roles")).toHaveValue("student");
    await expect(page.getByText(/Page 1 of 1/)).toBeVisible();
    await page.getByRole("link", { name: "Clear" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/admin/users" && url.search === "");
  });

  test("the refund control previews the donation/fee split before confirming", async ({ page }) => {
    await signInAndWait(page, "admin");
    await page.goto("/admin/contributions");
    await page.getByRole("button", { name: "Refund" }).first().click();
    await expect(page.getByText(/Amount to return to the donor/)).toBeVisible();
    await page.getByLabel(/Amount to return/).fill("4.20");
    await expect(page.getByText(/Reverses \$4\.00 donation \+ \$0\.20 operational fee/)).toBeVisible();
    await page.getByLabel(/Amount to return/).fill("9999");
    await expect(page.getByText(/Enter an amount up to/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm refund" })).toBeDisabled();
  });
});
