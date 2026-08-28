import AxeBuilder from "@axe-core/playwright";
import { expect, Page, test } from "@playwright/test";

const BASE_URL = process.env.FRONT_URL || "http://localhost:5173";

function testToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  return `e30.${payload}.test-signature`;
}

async function installSession(page: Page, role: "MEMBER" | "ORGANIZER") {
  await page.addInitScript(({ selectedRole, token }) => {
    localStorage.setItem("theme", "dark");
    localStorage.setItem("i18nextLng", "fr");
    sessionStorage.setItem("auth", JSON.stringify({
      token,
      user: {
        id: selectedRole === "ORGANIZER" ? 12 : 34,
        firstName: selectedRole === "ORGANIZER" ? "Nora" : "Samira",
        lastName: "Test",
        email: `${selectedRole.toLowerCase()}@example.invalid`,
        role: selectedRole,
        status: "ACTIVE",
      },
    }));
  }, { selectedRole: role, token: testToken() });
}

async function mockSharedRequests(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === "/api/organizer/events/my/42") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 42,
          title: "Design Systems Clinic",
          description: "Atelier pratique",
          startDateTime: "2026-09-10T09:30:00",
          endDateTime: "2026-09-10T12:30:00",
          location: "Atelier Canal",
          capacity: 60,
          price: 25,
          status: "PUBLISHED",
        }),
      });
      return;
    }

    if (path === "/api/organizer/events/my/42/attendees") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 81,
            userName: "Samira Test",
            userEmail: "member@example.invalid",
            eventTitle: "Design Systems Clinic",
            eventDate: "2026-09-10T09:30:00",
            numberOfParticipants: 2,
            totalPrice: 50,
            status: "CONFIRMED",
            createdAt: "2026-08-20T11:00:00",
            checkedInAt: null,
          },
          {
            id: 82,
            userName: "Louis Martin",
            userEmail: "louis@example.invalid",
            eventTitle: "Design Systems Clinic",
            eventDate: "2026-09-10T09:30:00",
            numberOfParticipants: 1,
            totalPrice: 25,
            status: "CONFIRMED",
            createdAt: "2026-08-21T09:00:00",
            checkedInAt: "2026-09-10T09:05:00",
          },
        ]),
      });
      return;
    }

    if (path === "/api/organizer/events/my/42/check-in") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          registrationId: 81,
          eventId: 42,
          attendeeName: "Samira Test",
          numberOfParticipants: 2,
          checkedInAt: "2026-09-10T09:12:00",
          alreadyCheckedIn: false,
        }),
      });
      return;
    }

    if (path === "/api/public/events/registrations/me") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{
          id: 99,
          eventId: 42,
          eventTitle: "Design Systems Clinic",
          eventStartDateTime: "2026-09-10T09:30:00",
          eventEndDateTime: "2026-09-10T12:30:00",
          numberOfParticipants: 2,
          totalPrice: 50,
          status: "CONFIRMED",
          createdAt: "2026-08-20T11:00:00",
          ticketToken: "a42fbd8d-4ef0-4cc5-957a-c3d2d5c7f821",
          checkedInAt: null,
        }]),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

test("event ticket renders a printable QR code in dark mode", async ({ page }) => {
  await installSession(page, "MEMBER");
  await mockSharedRequests(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/receipts/event/99`);

  await expect(page.getByRole("heading", { name: "Votre billet événement" })).toBeVisible();
  const qrCode = page.getByRole("img", { name: /QR code d’accès/i });
  await expect(qrCode).toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["critical", "serious"].includes(item.impact || ""))).toEqual([]);
});

test("organizer validates a ticket and updates attendance", async ({ page }) => {
  await installSession(page, "ORGANIZER");
  await mockSharedRequests(page);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${BASE_URL}/organizer/events/42/check-in`);

  await expect(page.getByRole("heading", { name: "Design Systems Clinic" })).toBeVisible();
  await expect(page.getByText("Participants attendus").locator("..").getByText("3")).toBeVisible();
  await page.getByLabel("Code du billet").fill("a42fbd8d-4ef0-4cc5-957a-c3d2d5c7f821");
  await page.getByRole("button", { name: "Valider l’entrée" }).click();
  await expect(page.getByText("Entrée validée")).toBeVisible();
  await expect(page.getByText("Samira Test · 2 participant(s)")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ["critical", "serious"].includes(item.impact || ""))).toEqual([]);
});
