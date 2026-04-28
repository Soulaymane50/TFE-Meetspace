import { test, expect } from "@playwright/test";
import { ensureLoggedOut, login, logout } from "./utils/helpers";

const BASE_URL = process.env.FRONT_URL || "http://localhost:5173";
const USER_EMAIL = "TestUser@TestUser.TestUser";
const USER_PASSWORD = "123456@789";

test.describe.serial("E2E User Flows", () => {
  test("User can view events page", async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page, USER_EMAIL, USER_PASSWORD);

    await page.goto(`${BASE_URL}/events`);

    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveURL(/events/);

    await logout(page);
  });

  test("User can view spaces page", async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page, USER_EMAIL, USER_PASSWORD);

    await page.goto(`${BASE_URL}/espaces`);

    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveURL(/espaces/);

    await logout(page);
  });

  test("User can view their reservations", async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page, USER_EMAIL, USER_PASSWORD);

    await page.goto(`${BASE_URL}/my-reservations`);

    await expect(page.locator('body')).toBeVisible();

    await logout(page);
  });

  test("User can view parking page", async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page, USER_EMAIL, USER_PASSWORD);

    await page.goto(`${BASE_URL}/parking`);

    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveURL(/parking/);

    await logout(page);
  });
});
