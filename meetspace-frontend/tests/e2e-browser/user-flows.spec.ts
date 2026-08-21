import { test, expect } from "@playwright/test";
import { ensureLoggedOut, ensureMember, login, logout } from "./utils/helpers";

const BASE_URL = process.env.FRONT_URL || "http://localhost:5173";
const USER_EMAIL = `e2e.flows.${Date.now()}@example.invalid`;
const USER_PASSWORD = "MeetSpace!E2E26";

test.describe.serial("E2E User Flows", () => {
  test.beforeEach(async ({ page }) => {
    await ensureMember(page, USER_EMAIL, USER_PASSWORD);
  });

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

    await page.goto(`${BASE_URL}/espace`);

    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveURL(/espace/);

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

  test("Legacy parking reservations route opens the consolidated parking tab", async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page, USER_EMAIL, USER_PASSWORD);

    await page.goto(`${BASE_URL}/my-parking-reservations`);

    await expect(page).toHaveURL(/\/my-reservations\?tab=parking$/);
    await expect(page.getByRole("tab", { name: /parking/i })).toHaveAttribute("aria-selected", "true");
  });

  test("Unknown reservations tab falls back to room reservations", async ({ page }) => {
    await ensureLoggedOut(page);
    await login(page, USER_EMAIL, USER_PASSWORD);

    await page.goto(`${BASE_URL}/my-reservations?tab=unknown`);

    await expect(page.getByRole("tab", { name: /salles|rooms/i })).toHaveAttribute("aria-selected", "true");
  });
});
