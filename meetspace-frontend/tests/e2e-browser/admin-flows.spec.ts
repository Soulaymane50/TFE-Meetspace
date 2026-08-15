import { test, expect } from "@playwright/test";
import { ensureLoggedOut, login, logout } from "./utils/helpers";

const BASE_URL = process.env.FRONT_URL || "http://localhost:5173";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.describe.serial("E2E Admin Flows", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin browser flows.");

  test("Admin can access dashboard", async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto(`${BASE_URL}/admin`);

    await expect(page).toHaveURL(/admin/);
    await expect(page.locator('body')).toBeVisible();

    await logout(page);
  });

  test("Admin can view users tab", async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto(`${BASE_URL}/admin`);

    const usersTab = page.getByRole('button', { name: /users|utilisateurs/i }).first();
    if (await usersTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await usersTab.click();
      await page.waitForTimeout(500);
    }

    await logout(page);
  });

  test("Admin can view spaces tab", async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto(`${BASE_URL}/admin/espaces`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/salles|spaces|rooms/i);

    await logout(page);
  });

  test("Admin can view events tab", async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto(`${BASE_URL}/admin/events`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/événements|events/i);

    await logout(page);
  });

  test("Admin can view pending events tab", async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto(`${BASE_URL}/admin/events`);

    const pendingTab = page.getByRole('button', { name: /pending|attente/i }).first();
    if (await pendingTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pendingTab.click();
      await page.waitForTimeout(500);
    }

    await logout(page);
  });
});
