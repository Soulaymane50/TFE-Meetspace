import { test, expect } from "@playwright/test";
import { ensureLoggedOut } from "./utils/helpers";

const BASE_URL = process.env.FRONT_URL || "http://localhost:5173";

test.describe("Premium public experience", () => {
  test.beforeEach(async ({ page }) => {
    await ensureLoggedOut(page);
  });

  test("quick access stays hidden and keyboard friendly", async ({ page }) => {
    await page.goto(BASE_URL);

    await expect(page.locator("header kbd")).toHaveCount(0);
    await page.keyboard.press("Control+k");

    const dialog = page.getByRole("dialog");
    const search = dialog.locator("input");
    await expect(dialog).toBeVisible();
    await expect(search).toBeFocused();

    await search.fill("parking");
    await expect(dialog.getByRole("option")).toHaveCount(1);
    await search.press("Enter");
    await expect(page).toHaveURL(/\/parking$/);
  });

  test("room booking keeps the protected destination through login", async ({ page }) => {
    await page.goto(`${BASE_URL}/espace`);

    const bookingLink = page.locator('a[href^="/reservations/new/"]').first();
    await expect(bookingLink).toBeVisible();
    const destination = await bookingLink.getAttribute("href");
    await bookingLink.click();

    await expect(page).toHaveURL(/\/login$/);
    const routeState = await page.evaluate(() => window.history.state?.usr?.from);
    expect(routeState).toBe(destination);
  });

  test("room catalogue can be searched, filtered and compared", async ({ page }) => {
    await page.goto(`${BASE_URL}/espace`);

    const tools = page.getByTestId("room-catalog-tools");
    const results = page.getByTestId("room-results");
    await expect(tools).toBeVisible();

    await tools.locator('input[type="search"]').fill("Orion");
    await expect(results.getByText("Salle Premium Orion", { exact: true })).toBeVisible();
    await expect(results.getByText("Salle Horizon", { exact: true })).toHaveCount(0);

    await results.getByTestId("room-compare-toggle").first().click();
    await expect(page.getByTestId("room-comparison")).toContainText("Salle Premium Orion");

    await tools.locator('input[type="search"]').fill("");
    await tools.locator('[role="group"] button').last().click();
    await expect(results.getByText("Salle Horizon", { exact: true })).toBeVisible();
    await expect(results.getByText("Salle Premium Orion", { exact: true })).toHaveCount(0);
  });

  test("core public routes remain free of horizontal overflow", async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 900 },
      { width: 1440, height: 1000 },
    ]) {
      await page.setViewportSize(viewport);
      for (const route of ["/", "/events", "/espace", "/parking", "/contact"]) {
        await page.goto(`${BASE_URL}${route}`);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${route} at ${viewport.width}px`).toBeLessThanOrEqual(1);
      }
    }
  });
});
