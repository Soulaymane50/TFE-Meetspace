import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE_URL = process.env.FRONT_URL || "http://localhost:5173";

const summary = {
  meetSpaceEstimatedRevenue: 19_941,
  meetSpacePotentialRevenue: 20_744.5,
  netCashFlow: 93_105.68,
  outstandingReceivables: 570,
  grossCollected: 95_199,
  refundedAmount: 640,
  estimatedProcessingFees: 1_453.32,
  transactionCount: 101,
  directRoomRevenue: 2_860,
  parkingRevenue: 2_472,
  eventCommissionRevenue: 8_999,
  roomCostChargedToOrganizers: 5_610,
  events: [],
};

function trend(from = "2026-07-17", to = "2026-08-15") {
  return {
    from,
    to,
    granularity: "DAY",
    points: Array.from({ length: 30 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 6, 17 + index)).toISOString().slice(0, 10),
      platformRevenue: index * 100,
      grossCollected: index * 300,
      refundedAmount: index === 12 ? 120 : 0,
      processingFees: index * 3,
      netCashFlow: index * 297 - (index === 12 ? 120 : 0),
      transactionCount: index,
    })),
  };
}

test("admin finance is distinct, responsive and accessible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem("auth", JSON.stringify({
      token: "finance-e2e-token",
      user: { id: 1, email: "finance@test.invalid", firstName: "Test", lastName: "Admin", role: "ADMIN" },
    }));
    localStorage.setItem("theme", "dark");
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    let body = [];
    if (url.pathname.endsWith("/finance/summary")) body = summary;
    if (url.pathname.endsWith("/finance/trend")) body = trend(url.searchParams.get("from") || undefined, url.searchParams.get("to") || undefined);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.goto(`${BASE_URL}/admin/finances`);
  const finance = page.getByTestId("admin-finance");
  await expect(finance).toBeVisible();
  await expect(page.locator('svg[role="img"]')).toHaveCount(3);
  await expect(finance.locator('[class*="kpiRail"] article')).toHaveCount(4);
  await expect(finance.locator('[class*="kpiRail"]')).not.toContainText(/Remboursé|Refunded|Terugbetaald/i);

  const dimensions = await finance.evaluate((node) => ({ client: node.clientWidth, scroll: node.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);

  const results = await new AxeBuilder({ page }).include('[data-testid="admin-finance"]').analyze();
  expect(results.violations).toEqual([]);
});
