import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE_URL = process.env.FRONT_URL || "http://localhost:5173";
const settlement = { eventId: 123, eventTitle: "Rencontre des indépendants", organizerName: "Camille Laurent", eventEndsAt: "2026-09-01T17:00:00", dueAt: "2026-09-01T17:00:00", ticketRevenueCents: 10000, commissionCents: 1000, roomBalanceDeductedCents: 0, amountCents: 9000, status: "READY_FOR_PAYOUT", recordedAt: null, transferReference: null };

async function setup(page, options = {}) {
  const config = { role: "ADMIN", language: "fr", theme: "light", ...options };
  await page.addInitScript((config) => {
    localStorage.setItem("auth", JSON.stringify({ token: "settlement-test", user: { id: 1, email: "test@example.test", firstName: "Camille", lastName: "Laurent", role: config.role } }));
    localStorage.setItem("i18nextLng", config.language);
    localStorage.setItem("theme", config.theme);
  }, config);
  let current = { ...settlement }, writes = 0;
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    let body = [];
    if (url.pathname.endsWith("/finance/settlements")) body = [current];
    if (url.pathname.endsWith("/finance/summary")) body = { events: [] };
    if (url.pathname.endsWith("/finance/trend")) body = { from: "2026-08-01", to: "2026-09-30", points: [] };
    if (url.pathname.endsWith("/payout")) {
      writes++;
      const request = route.request().postDataJSON();
      expect(request).toEqual({ reference: "BANK-REF-1", amountCents: 9000 });
      current = { ...current, status: "PAID", recordedAt: "2026-10-07T15:00:00", transferReference: request.reference };
      body = current;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  return () => writes;
}

test("an admin records only a confirmed external transfer and a refresh keeps it paid", async ({ page }) => {
  const writes = await setup(page);
  await page.goto(BASE_URL + "/admin/finances");
  const panel = page.getByTestId("event-settlements");
  await expect(panel.getByText("À verser à l’organisateur", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Enregistrer un virement" }).click();
  await expect(panel.getByText(/elle ne transfère pas d’argent/)).toBeVisible();
  await panel.getByLabel("Référence du virement bancaire").fill("BANK-REF-1");
  const submit = panel.getByRole("button", { name: "Confirmer le virement", exact: true });
  await expect(submit).toBeDisabled();
  await panel.getByRole("checkbox").check();
  await submit.click();
  await page.getByRole("dialog").getByRole("button", { name: "Annuler" }).click();
  expect(writes()).toBe(0);
  await submit.click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmer le virement", exact: true }).click();
  await expect(panel.getByText("Virement enregistré", { exact: true })).toBeVisible();
  expect(writes()).toBe(1);
  await expect(panel.getByRole("button", { name: "Enregistrer un virement" })).toHaveCount(0);
  await panel.getByRole("button", { name: "Actualiser" }).click();
  await expect(panel.getByText(/BANK-REF-1/)).toBeVisible();
  expect(writes()).toBe(1);
});

for (const language of ["fr", "en", "nl"]) {
  test("settlement panel is accessible on mobile in " + language, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setup(page, { language, theme: "dark" });
    await page.goto(BASE_URL + "/admin/finances");
    const panel = page.getByTestId("event-settlements");
    await expect(panel.getByText(settlement.eventTitle)).toBeVisible();
    await expect(panel).not.toContainText("settlement.");
    const sizes = await panel.evaluate(node => ({ client: node.clientWidth, scroll: node.scrollWidth }));
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
    const results = await new AxeBuilder({ page }).include('[data-testid="event-settlements"]').analyze();
    expect(results.violations).toEqual([]);
  });
}

test("the organizer can read the statement without admin controls", async ({ page }) => {
  await setup(page, { role: "ORGANIZER" });
  await page.goto(BASE_URL + "/organizer/events");
  const panel = page.getByTestId("event-settlements");
  await expect(panel.getByText(settlement.eventTitle)).toBeVisible();
  await expect(panel.getByRole("button", { name: "Enregistrer un virement" })).toHaveCount(0);
  await expect(panel.getByRole("textbox")).toHaveCount(0);
  await expect(panel.getByText("Virement de MeetSpace en attente", { exact: true })).toBeVisible();
  await expect(panel).toContainText("vous n’avez rien à payer");
});

test("an unavailable beneficiary has no transfer action", async ({ page }) => {
  await setup(page);
  await page.route("**/api/admin/finance/settlements", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ ...settlement, status: "BENEFICIARY_UNAVAILABLE" }]) }));
  await page.goto(BASE_URL + "/admin/finances");
  const panel = page.getByTestId("event-settlements");
  await expect(panel.getByText("Bénéficiaire indisponible", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Enregistrer un virement" })).toHaveCount(0);
});

test("approved room rental terms are read only while descriptive edits remain usable", async ({ page }) => {
  await setup(page);
  const room = { id: 3, name: "Salle Atlas", capacity: 80, basePrice: 100, status: "AVAILABLE" };
  const approved = { id: 123, title: "Rencontre des indépendants", description: "Échanges professionnels", startDateTime: "2026-12-18T09:00:00", endDateTime: "2026-12-18T11:00:00", locationType: "EXISTING_SPACE", spaceId: 3, capacity: 20, price: 25, status: "AWAITING_DEPOSIT", roomContractLocked: true };
  await page.route("**/api/admin/espaces", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([room]) }));
  await page.route("**/api/admin/events/123", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(approved) }));
  await page.goto(BASE_URL + "/admin/events/123/edit");
  await expect(page.getByText(/La salle et les horaires sont fixés/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Type de lieu", exact: true })).toBeDisabled();
  await expect(page.locator('#AdminEventForm-title')).toBeEditable();
  await expect(page.locator('#AdminEventForm-description')).toBeEditable();
  await expect(page.locator('input[type="datetime-local"]')).toHaveCount(0);
});
