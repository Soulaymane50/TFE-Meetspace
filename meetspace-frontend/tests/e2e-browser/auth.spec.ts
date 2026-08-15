import { test, expect } from "@playwright/test";
import { ensureLoggedOut, ensureMember, login, logout } from "./utils/helpers";

const BASE_URL = process.env.FRONT_URL || "http://localhost:5173";
const USER_EMAIL = `e2e.auth.${Date.now()}@example.invalid`;
const USER_PASSWORD = "MeetSpace!E2E26";

test.describe.serial("E2E Authentication", () => {
  test("User can login and logout", async ({ page }) => {
    await ensureLoggedOut(page);
    await ensureMember(page, USER_EMAIL, USER_PASSWORD);

    await login(page, USER_EMAIL, USER_PASSWORD);

    await expect(page).not.toHaveURL(/\/login/);

    await logout(page);
  });

  test("Login shows error with wrong credentials", async ({ page }) => {
    await ensureLoggedOut(page);

    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"]', "wrong@email.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');

    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/\/login/);
  });
});
