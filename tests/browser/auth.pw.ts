import { alertBox, expect, test, accounts, expectAccessible, signIn, signInAndWait } from "./helpers";

test.describe("sign in", () => {
  for (const role of ["admin", "eatery", "student"] as const) {
    test(`${role} lands on their own dashboard and sees their role in the header`, async ({ page }) => {
      await signInAndWait(page, role);
      await expect(page.getByRole("banner").getByRole("button", { name: "Sign out" })).toBeVisible();
      await expect(page.getByRole("banner")).toContainText(role === "admin" ? "Administrator" : role === "eatery" ? "Eatery" : "Student");
    });
  }

  test("wrong password shows a clear, generic error", async ({ page }, testInfo) => {
    await signIn(page, "admin", "not-the-password");
    await expect(alertBox(page)).toContainText("Could not sign in");
    await expect(page).toHaveURL(/\/auth\/login/);
    await expectAccessible(page, "sign-in-error", testInfo);
  });

  test("students need a hawaii.edu address, deactivated and unconfirmed accounts are turned away", async ({ page }) => {
    const cases: Array<[string, RegExp]> = [
      ["outsider@gmail.com", /@hawaii\.edu/],
      ["inactive@example.com", /deactivated/],
      ["unconfirmed@hawaii.edu", /Confirm your email/],
      ["noprofile@example.com", /not set up/],
    ];
    for (const [email, message] of cases) {
      await page.goto("/auth/login");
      await page.getByLabel("Email address").fill(email);
      await page.getByLabel("Password", { exact: true }).fill("pw");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(alertBox(page)).toContainText(message);
      await expect(page).toHaveURL(/\/auth\/login/);
    }
  });

  test("password visibility can be toggled and empty submissions are explained", async ({ page }) => {
    await page.goto("/auth/login");
    const password = page.getByLabel("Password", { exact: true });
    await password.fill("secret");
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByLabel("Email address").fill("");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(alertBox(page)).toContainText("required");
  });
});

test.describe("permissions in the browser", () => {
  test("signed-out visitors are sent to sign in and back to where they were going", async ({ page }) => {
    await page.goto("/student/history");
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fstudent%2Fhistory/);
    await page.getByLabel("Email address").fill(accounts.student.email);
    await page.getByLabel("Password", { exact: true }).fill("pw");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/student/history");
  });

  test("each role is bounced from the other areas to its own dashboard", async ({ page }) => {
    const areas = ["/admin", "/eatery", "/student"];
    for (const role of ["admin", "eatery", "student"] as const) {
      await page.context().clearCookies();
      await signInAndWait(page, role);
      for (const area of areas.filter((a) => a !== accounts[role].home)) {
        await page.goto(area);
        await expect(page, `${role} opening ${area}`).toHaveURL((url) => url.pathname === accounts[role].home);
      }
    }
  });

  test("signed-in users skip the login form", async ({ page }) => {
    await signInAndWait(page, "student");
    await page.goto("/auth/login");
    await expect(page).toHaveURL((url) => url.pathname === "/student");
  });

  test("signing out returns to the home page and closes the private areas", async ({ page }) => {
    await signInAndWait(page, "admin");
    await page.getByRole("banner").getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
