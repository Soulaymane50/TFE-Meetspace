import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ensureLoggedOut, login } from "./utils/helpers";

const BASE_URL = process.env.FRONT_URL || "http://localhost:5173";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";
const workspaces = [
  { path: "/my-reservations", name: "réservations client" },
  { path: "/organizer/events", name: "événements organisateur" },
  { path: "/admin", name: "tableau de bord admin" },
  { path: "/admin/finances", name: "finance admin" },
];
const viewports = [
  { name: "desktop", width: 1366, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

test("authenticated workspaces remain accessible in light/dark and desktop/mobile", async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Set E2E admin credentials to test authenticated workspaces.");
  await ensureLoggedOut(page);
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  for (const theme of ["light", "dark"]) {
    for (const workspace of workspaces) {
      await page.evaluate((selectedTheme) => localStorage.setItem("theme", selectedTheme), theme);

      for (const viewport of viewports) {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await page.goto(`${BASE_URL}${workspace.path}`);
          await page.waitForLoadState("domcontentloaded");
          await expect(page.locator("body")).toBeVisible();

          const dimensions = await page.locator("body").evaluate((body) => ({
            clientWidth: body.clientWidth,
            scrollWidth: body.scrollWidth,
          }));
          expect(
            dimensions.scrollWidth,
            `${workspace.name} déborde horizontalement en ${theme}/${viewport.name}`,
          ).toBeLessThanOrEqual(dimensions.clientWidth);

          const results = await new AxeBuilder({ page }).analyze();
          const blockingViolations = results.violations.filter(
            (violation) => violation.impact === "critical" || violation.impact === "serious",
          );
          expect(
            blockingViolations,
            `${workspace.name} ${theme}/${viewport.name}: ${JSON.stringify(blockingViolations, null, 2)}`,
          ).toEqual([]);
        }
      }
    }
});
