import { test, expect } from "@playwright/test";
import { ensureLoggedOut, login, logout } from "./utils/helpers";

const BASE_URL = process.env.FRONT_URL || "http://localhost:5173";
const USER_EMAIL = "TestUser@TestUser.TestUser";
const USER_PASSWORD = "123456@789";

test.describe.serial("E2E Authentication", () => {
  test("User can login and logout", async ({ page }) => {
    await ensureLoggedOut(page);

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
