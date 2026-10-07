import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const base = process.env.FRONT_URL || "http://localhost:5173";
const events = [
  { id: 1, title: "Rencontre publiée", status: "PUBLISHED" },
  { id: 2, title: "Proposition à examiner", status: "PENDING_APPROVAL" },
  { id: 3, title: "Proposition refusée", status: "REJECTED" },
].map(event => ({ ...event, startDateTime: "2026-11-10T10:00:00", endDateTime: "2026-11-10T12:00:00", location: "Salle Atlas", capacity: 20, price: 10 }));

async function prepare(page, role = "ORGANIZER") {
  await page.clock.install({ time: new Date("2026-10-07T12:00:00") });
  await page.addInitScript(role => {
    localStorage.setItem("auth", JSON.stringify({ token: "filter-test", user: { id: 1, role, firstName: "Camille", lastName: "Laurent", email: "camille@example.test" } }));
    localStorage.setItem("i18nextLng", "fr");
  }, role);
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith("/organizer/events/my") ? events
      : path.endsWith("/finance/summary") ? { events: [] }
      : [];
    await route.fulfill({ json: body });
  });
}

for (const width of [1440, 390]) {
  test(`organizer cards filter, focus the results and restore navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await prepare(page);
    await page.goto(base + "/organizer/events");
    const heading = page.locator("#organizer-results-heading");
    const published = page.getByRole("button", { name: /^Publiés/ });
    const pending = page.getByRole("button", { name: /^En attente 1/ });
    const portfolio = page.getByRole("button", { name: /^Portefeuille/ });
    await expect(portfolio).toContainText("3");
    await portfolio.click();
    await expect(heading).toBeFocused();
    await expect(heading).toBeInViewport();
    await published.click();
    await expect(page).toHaveURL(/status=PUBLISHED/);
    await expect(published).toHaveAttribute("aria-pressed", "true");
    await expect(heading).toBeFocused();
    await expect(heading).toBeInViewport();
    await expect(page.getByTestId("organizer-event-list").getByRole("heading", { level: 3 })).toHaveText(["Rencontre publiée"]);
    await pending.click();
    await expect(page).toHaveURL(/status=PENDING_APPROVAL/);
    await expect(pending).toHaveAttribute("aria-pressed", "true");
    await expect(heading).toBeFocused();
    await expect(heading).toBeInViewport();
    await expect(page.getByTestId("organizer-event-list").getByRole("heading", { level: 3 })).toHaveText(["Proposition à examiner"]);
    await portfolio.click();
    await expect(page).not.toHaveURL(/status=/);
    await expect(page.getByTestId("organizer-event-list").getByRole("heading", { level: 3 })).toHaveCount(3);
    await page.goBack();
    await expect(page).toHaveURL(/status=PENDING_APPROVAL/);
    await expect(page.getByTestId("organizer-event-list").getByRole("heading", { level: 3 })).toHaveText(["Proposition à examiner"]);
    await page.getByRole("button", { name: /^Publiés/ }).hover();
    const cardAxe = await new AxeBuilder({ page }).include('[aria-controls="organizer-event-results"]').analyze();
    expect(cardAxe.violations).toEqual([]);
    const order = await page.evaluate(() => {
      const result = document.querySelector("#organizer-event-results");
      const payouts = document.querySelector('[data-testid="event-settlements"]');
      return Boolean(result.compareDocumentPosition(payouts) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(order).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    const axe = await new AxeBuilder({ page }).include('#organizer-event-results').analyze();
    expect(axe.violations).toEqual([]);
  });
}

test("stale room requests returned by an old API have no approval action", async ({ page }) => {
  await prepare(page, "ADMIN");
  const booking = { id: 1, status: "PENDING_APPROVAL", espace: { name: "Salle Premium Orion" }, user: { email: "camille@example.test" }, totalPrice: 640 };
  await page.route("**/api/admin/reservations/pending", route => route.fulfill({ json: [
    { ...booking, startDateTime: "2026-06-22T09:00:00", endDateTime: "2026-06-22T11:00:00" },
    { ...booking, id: 2, espace: { name: "Salle Premium Executive" }, startDateTime: "2026-11-10T09:00:00", endDateTime: "2026-11-10T11:00:00" },
  ] }));
  await page.goto(base + "/admin/espaces");
  await page.getByRole("button", { name: /^Demandes premium en attente/ }).click();
  await expect(page.getByRole("heading", { name: "Salle Premium Orion" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Salle Premium Executive" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Approuver", exact: true })).toHaveCount(1);
});

test("a room request stops offering approval while the page stays open", async ({ page }) => {
  await prepare(page, "ADMIN");
  await page.route("**/api/admin/reservations/pending", route => route.fulfill({ json: [{
    id: 1, status: "PENDING_APPROVAL", espace: { name: "Salle Premium Orion" }, user: { email: "camille@example.test" }, totalPrice: 640,
    startDateTime: "2026-10-07T12:01:00", endDateTime: "2026-10-07T14:01:00",
  }] }));
  await page.goto(base + "/admin/espaces");
  await page.getByRole("button", { name: /^Demandes premium en attente/ }).click();
  await expect(page.getByRole("button", { name: "Approuver", exact: true })).toHaveCount(1);
  await page.clock.fastForward(61_000);
  await expect(page.getByRole("button", { name: "Approuver", exact: true })).toHaveCount(0);
  await expect(page.getByText("Aucune demande de salle premium en attente")).toBeVisible();
});
