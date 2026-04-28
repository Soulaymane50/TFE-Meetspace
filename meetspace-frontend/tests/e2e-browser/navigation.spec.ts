import { test, expect } from "@playwright/test";
import { ensureLoggedOut } from "./utils/helpers";

const BASE_URL = process.env.FRONT_URL || "http://localhost:5173";

test.describe.serial("E2E Navigation", () => {
  test("Home page loads correctly", async ({ page }) => {
    await ensureLoggedOut(page);

    await page.goto(BASE_URL);

    await expect(page.locator('nav')).toBeVisible();
  });

  test("Can navigate to events page via navbar", async ({ page }) => {
    await ensureLoggedOut(page);

    await page.goto(BASE_URL);

    const eventsLink = page.locator('nav').getByRole('link', { name: /^Events$/i }).first();
    await eventsLink.click();

    await expect(page).toHaveURL(/events/);
  });

  test("Can navigate to spaces page via navbar", async ({ page }) => {
    await ensureLoggedOut(page);

    await page.goto(BASE_URL);

    const spacesLink = page.locator('nav').getByRole('link', { name: /^Spaces$/i }).first();
    await spacesLink.click();

    await expect(page).toHaveURL(/espace/);
  });

  test("Can navigate to parking page via navbar", async ({ page }) => {
    await ensureLoggedOut(page);

    await page.goto(BASE_URL);

    const parkingLink = page.locator('nav').getByRole('link', { name: /^Parking$/i }).first();
    await parkingLink.click();

    await expect(page).toHaveURL(/parking/);
  });
});
