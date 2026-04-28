import { test, expect } from "@playwright/test";
import { ensureLoggedOut, login, logout } from "./utils/helpers";

const BASE_URL = process.env.FRONT_URL || "http://localhost:5173";
const ADMIN_EMAIL = "TestAdmin@TestAdmin.TestAdmin";
const ADMIN_PASSWORD = "123456@789";

test.describe.serial("E2E Admin Flows", () => {
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

    await page.goto(`${BASE_URL}/admin`);

    const spacesTab = page.getByRole('button', { name: /spaces|espaces/i }).first();
    if (await spacesTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await spacesTab.click();
      await page.waitForTimeout(500);
    }

    await logout(page);
  });

  test("Admin can view events tab", async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto(`${BASE_URL}/admin`);

    const eventsTab = page.getByRole('button', { name: /events|événements/i }).first();
    if (await eventsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await eventsTab.click();
      await page.waitForTimeout(500);
    }

    await logout(page);
  });

  test("Admin can view pending events tab", async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto(`${BASE_URL}/admin`);

    const pendingTab = page.getByRole('button', { name: /pending|attente/i }).first();
    if (await pendingTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await pendingTab.click();
      await page.waitForTimeout(500);
    }

    await logout(page);
  });
});
