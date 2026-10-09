import { alertBox, expect, test, expectAccessible, snapshot } from "./helpers";

const breakdown = (page: import("@playwright/test").Page) => page.getByLabel("Payment breakdown");

test.describe("donation checkout", () => {
  test("shows donation, 5% fee and total, and says the pool gets the full donation", async ({ page }, testInfo) => {
    await page.goto("/donate");
    const box = breakdown(page);
    await expect(box).toContainText("Your donation to the meal pool");
    await expect(box).toContainText("$8.00");
    await expect(box).toContainText("Operational fee (5%)");
    await expect(box).toContainText("$0.40");
    await expect(box).toContainText("Total payment");
    await expect(box).toContainText("$8.40");
    await expect(box).toContainText("The meal pool receives the full $8.00.");
    await expect(box).toContainText("not a donation");
    await expect(page.getByRole("button", { name: "Pay $8.40" })).toBeEnabled();
    await expectAccessible(page, "donate-breakdown", testInfo);
    await snapshot(page, "donate-breakdown", testInfo);
  });

  test("the breakdown follows the chosen amount", async ({ page }) => {
    await page.goto("/donate");
    await page.getByRole("button", { name: /\$24\.00/ }).click();
    await expect(breakdown(page)).toContainText("$1.20");
    await expect(breakdown(page)).toContainText("$25.20");
    await page.getByRole("button", { name: /\$80\.00/ }).click();
    await expect(breakdown(page)).toContainText("$4.00");
    await expect(breakdown(page)).toContainText("$84.00");
    await page.getByRole("button", { name: "Custom" }).click();
    await page.getByLabel("Amount in dollars").fill("10");
    await expect(breakdown(page)).toContainText("$0.50");
    await expect(breakdown(page)).toContainText("$10.50");
  });

  test("invalid amounts show no breakdown and cannot be submitted", async ({ page }) => {
    await page.goto("/donate");
    await page.getByRole("button", { name: "Custom" }).click();
    for (const bad of ["5", "8.5", "0", "801", "-8"]) {
      await page.getByLabel("Amount in dollars").fill(bad);
      await expect(breakdown(page)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Continue to checkout" })).toBeDisabled();
    }
  });

  test("sends only the donation plus an expected-total check and a request key; never fee fields", async ({ page }) => {
    let captured: { body: Record<string, unknown>; key: string | undefined } | null = null;
    await page.route("**/api/donate/checkout", async (route) => {
      captured = { body: route.request().postDataJSON(), key: route.request().headers()["idempotency-key"] };
      await route.fulfill({ json: { url: "/donate/canceled" } });
    });
    await page.goto("/donate");
    await page.getByRole("button", { name: "Pay $8.40" }).click();
    await page.waitForURL(/\/donate\/canceled/);
    expect(captured).not.toBeNull();
    const { body, key } = captured!;
    expect(body).toEqual({ amount_cents: 800, expected_total_cents: 840, is_anonymous: true });
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(body)).not.toMatch(/fee_|operational/);
  });

  test("if the fee changed meanwhile the donor is told and nothing is charged", async ({ page }) => {
    await page.route("**/api/donate/checkout", (route) =>
      route.fulfill({
        status: 409,
        json: { error: "The operational fee changed. Please review the updated total and try again.", breakdown: { donation_cents: 800, operational_fee_cents: 80, operational_fee_rate_bps: 1000, total_cents: 880 } },
      }),
    );
    await page.goto("/donate");
    await page.getByRole("button", { name: "Pay $8.40" }).click();
    await expect(alertBox(page)).toContainText("fee changed");
    await expect(breakdown(page)).toContainText("Operational fee (10%)");
    await expect(breakdown(page)).toContainText("$8.80");
    await expect(page.getByRole("button", { name: "Pay $8.80" })).toBeEnabled();
  });

  test("a retry after a network failure reuses the same request key", async ({ page }) => {
    const keys: Array<string | undefined> = [];
    await page.route("**/api/donate/checkout", async (route) => {
      keys.push(route.request().headers()["idempotency-key"]);
      if (keys.length === 1) await route.abort("failed");
      else await route.fulfill({ json: { url: "/donate/canceled" } });
    });
    await page.goto("/donate");
    await page.getByRole("button", { name: "Pay $8.40" }).click();
    await expect(alertBox(page)).toBeVisible();
    await page.getByRole("button", { name: "Pay $8.40" }).click();
    await page.waitForURL(/\/donate\/canceled/);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });

  test("the confirmation page for an unknown session stays calm", async ({ page }, testInfo) => {
    await page.goto("/donate/success?session_id=cs_test_unknownsession123");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Thank you");
    await expectAccessible(page, "donate-success", testInfo);
  });
});
