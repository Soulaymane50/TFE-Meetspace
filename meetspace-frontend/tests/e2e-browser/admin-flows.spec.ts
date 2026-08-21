import { test, expect } from "@playwright/test";
import { ensureLoggedOut, login, logout } from "./utils/helpers";

const BASE_URL = process.env.FRONT_URL || "http://localhost:5173";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.describe.serial("E2E Admin Flows", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run admin browser flows.");

  test("Admin can navigate through every administration workspace", async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await test.step("dashboard and users", async () => {
      await page.goto(`${BASE_URL}/admin`);
      await expect(page).toHaveURL(/admin/);
      await expect(page.locator("body")).toBeVisible();

      const usersTab = page.getByRole("tab", { name: /user|utilisateur|compte/i }).first();
      await usersTab.click();
      await expect(usersTab).toHaveAttribute("aria-selected", "true");
    });

    await test.step("spaces", async () => {
      await page.goto(`${BASE_URL}/admin/espaces`);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(/salles|spaces|rooms/i);
    });

    await test.step("events and pending filter", async () => {
      await page.goto(`${BASE_URL}/admin/events`);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(/événements|events/i);
      const pendingTab = page.getByRole("button", { name: /pending|attente/i }).first();
      if (await pendingTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pendingTab.click();
        await page.waitForTimeout(300);
      }
    });

    await test.step("invalid URL filters fall back safely", async () => {
      await page.goto(`${BASE_URL}/admin?tab=unknown`);
      await expect(page.getByRole("tab", { name: /overview|vue d'ensemble|aperçu/i })).toHaveAttribute(
        "aria-selected",
        "true",
      );

      await page.goto(`${BASE_URL}/organizer/events?status=unknown`);
      await expect(page.getByRole("button", { name: /all|tous/i }).last()).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });

    await logout(page);
  });
});
