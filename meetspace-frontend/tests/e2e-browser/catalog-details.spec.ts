import { test, expect } from "@playwright/test";
import { ensureLoggedOut } from "./utils/helpers";

const BASE_URL = process.env.FRONT_URL || "http://localhost:5173";

test.describe("Shareable catalog details", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
  });

  test("room filters are reflected in the URL and details remain bookable", async ({ page }) => {
    await page.goto(`${BASE_URL}/espace`);

    const search = page.getByTestId("room-catalog-tools").locator('input[type="search"]');
    await search.fill("Orion");
    await expect(page).toHaveURL(/q=Orion/);

    const details = page.getByTestId("room-results").locator('a[href^="/espace/"]').first();
    await expect(details).toBeVisible();
    await details.click();

    await expect(page).toHaveURL(/\/espace\/\d+$/);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator('a[href^="/reservations/new/"]').last()).toBeVisible();
  });

  test("event details expose a calendar download", async ({ page }) => {
    await page.goto(`${BASE_URL}/events`);

    const details = page.locator('a[href^="/events/"]:not([href^="/events/register/"])').first();
    const href = await details.getAttribute("href");
    expect(href).toMatch(/^\/events\/\d+$/);
    await page.goto(`${BASE_URL}${href}`);

    await expect(page.locator("h1")).toBeVisible();
    const calendarButton = page.getByRole("button", { name: /calendrier|calendar|kalender/i });
    const downloadPromise = page.waitForEvent("download");
    await calendarButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.ics$/);
  });

  test("parking date selection is shareable", async ({ page }) => {
    await page.goto(`${BASE_URL}/parking`);
    const dateButtons = page.locator('[class*="dateSelector"] button');
    if (await dateButtons.count() > 1) {
      await dateButtons.nth(1).click();
      await expect(page).toHaveURL(/date=/);
    }

    const details = page.locator('a[href^="/parking/"]:not([href^="/parking/reserve/"])').first();
    const href = await details.getAttribute("href");
    expect(href).toMatch(/^\/parking\/\d+$/);
    await page.goto(`${BASE_URL}${href}`);
    await expect(page.locator("h1")).toBeVisible();
  });
});