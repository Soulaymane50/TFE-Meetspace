import { expect, Page, test } from "@playwright/test";

const BASE_URL = process.env.FRONT_URL || "http://localhost:5173";

function testToken() {
  const payload = Buffer.from(JSON.stringify({ exp: 4_102_444_800 })).toString("base64url");
  return `e30.${payload}.test-signature`;
}

async function installOrganizerSession(page: Page) {
  await page.addInitScript((token) => {
    localStorage.setItem("theme", "light");
    localStorage.setItem("i18nextLng", "fr");
    sessionStorage.setItem("auth", JSON.stringify({
      token,
      user: {
        id: 12,
        firstName: "Nora",
        lastName: "Test",
        email: "organizer@example.invalid",
        role: "ORGANIZER",
        status: "ACTIVE",
      },
    }));
  }, testToken());
}

async function mockScheduleRequests(page: Page) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;

    if (path === "/api/public/espaces") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{
          id: 1,
          name: "Salle Atlas",
          capacity: 100,
          basePrice: 130,
          status: "AVAILABLE",
        }]),
      });
      return;
    }

    if (path === "/api/public/reservations/espace/1/calendar") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{
          id: 77,
          blockType: "RESERVATION",
          startDateTime: "2026-08-31T12:00:00",
          endDateTime: "2026-08-31T14:00:00",
        }]),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

test("changing duration never keeps a newly conflicting room slot", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-08-30T08:00:00+02:00"));
  await installOrganizerSession(page);
  await mockScheduleRequests(page);
  await page.goto(`${BASE_URL}/organizer/events/new`);

  await page.getByRole("button", { name: "Lieu" }).click();
  await page.getByRole("option").filter({ hasText: "Salle Atlas" }).getByRole("button").click();
  await page.getByRole("button", { name: "1h", exact: true }).click();
  await page.getByRole("button", { name: /31 Créneaux limités/ }).click();

  const elevenOClock = page.getByRole("button", { name: "11:00", exact: true });
  await expect(elevenOClock).toBeEnabled();
  await elevenOClock.click();
  await expect(page.getByText("2026-08-31 11:00 → 12:00")).toBeVisible();

  await page.getByRole("button", { name: "2h", exact: true }).click();
  await expect(elevenOClock).toBeDisabled();
  await expect(page.getByText("Choisissez une heure de début pour 2 h")).toBeVisible();
});
