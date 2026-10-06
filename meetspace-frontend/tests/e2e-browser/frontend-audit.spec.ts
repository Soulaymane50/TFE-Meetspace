import { test, expect, Page } from "@playwright/test";

const BASE = process.env.FRONT_URL || "http://localhost:5189";
const room = { id: 1, name: "Salle Atlas", capacity: 100, basePrice: 100, type: "MEETING_ROOM", status: "AVAILABLE" };
const event = { id: 17, title: "Audit événement", description: "Description", spaceId: 1, location: room.name, status: "PUBLISHED", capacity: 100, availablePlaces: 0, price: 10, startDateTime: "2026-11-10T10:00", endDateTime: "2026-11-10T12:00" };
const user = { id: 12, role: "ADMIN", status: "ACTIVE", firstName: "Audit", lastName: "Test", email: "audit@example.invalid" };
async function prepare(page: Page, role = "ADMIN", remember = false, language = "en") {
  if (!["localhost", "127.0.0.1"].includes(new URL(BASE).hostname)) throw new Error("Local frontend only");
  await page.clock.install({ time: new Date("2026-10-03T10:30:00") });
  await page.addInitScript(({ role, remember, language, user }) => {
    localStorage.setItem("i18nextLng", language);
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem("auth", JSON.stringify({ token: "e30.eyJleHAiOjQxMDI0NDQ4MDB9.test", user: { ...user, role } }));
  }, { role, remember, language, user });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/user/me") return route.fulfill({ json: user });
    if (path === "/api/public/espaces" || path === "/api/admin/espaces") return route.fulfill({ json: [room] });
    if (path === "/api/public/events") return route.fulfill({ json: [event] });
    if (path === "/api/admin/stats") return route.fulfill({ json: { totalUsers: 1, totalEvents: 1 } });
    if (path === "/api/admin/users") return route.fulfill({ json: [user] });
    if (path === "/api/admin/audit") return route.fulfill({ json: { content: [], totalPages: 0, totalElements: 0 } });
    return route.fulfill({ json: [] });
  });
  await page.route("**/*", async (route) => {
    const host = new URL(route.request().url()).hostname;
    if (!["localhost", "127.0.0.1"].includes(host)) return route.abort();
    return route.fallback();
  });
}

test("F01/F02 départ futur, temps réel et réponse inconnue avec réessai", async ({ page }) => {
  await prepare(page);
  let bad = false;
  await page.route("**/api/public/reservations/espace/1/calendar?**", route => route.fulfill({ json: bad ? { message: "INTERNAL_ERROR" } : [] }));
  await page.goto(`${BASE}/espace`);
  const reserve = page.locator('a[href*="/reservations/new/1?date="]');
  await expect(reserve).toHaveAttribute("href", /start=11%3A00/);
  await page.clock.fastForward(31 * 60 * 1000);
  await expect(reserve).toHaveAttribute("href", /start=12%3A00/);
  bad = true;
  await page.locator('input[type="date"]').fill("2026-11-10");
  await expect(page.getByText("Availability is unavailable. Please try again.")).toBeVisible();
  await expect(reserve).toHaveCount(0);
  bad = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(reserve).toHaveAttribute("href", /date=2026-11-10.*start=07%3A00/);
});

test("F02 une réponse tardive du mois précédent ne remplace pas le mois sélectionné", async ({ page }) => {
  await prepare(page);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/public/reservations/espace/1/calendar?**", async route => {
    if (new URL(route.request().url()).searchParams.get("month") === "10") {
      await gate;
      return route.fulfill({ json: [{ startDateTime: "2026-10-03T07:00", endDateTime: "2026-11-30T22:00" }] });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto(`${BASE}/espace`);
  await page.locator('input[type="date"]').fill("2026-11-10");
  const reserve = page.locator('a[href*="/reservations/new/1?date="]');
  await expect(reserve).toHaveAttribute("href", /date=2026-11-10/);
  release();
  await expect(reserve).toHaveAttribute("href", /date=2026-11-10.*start=07%3A00/);
});

test("F03 tous les jours admin restent sélectionnables, F04 annulation ne bloque pas", async ({ page }) => {
  await prepare(page);
  const events = Array.from({ length: 9 }, (_, index) => ({ ...event, id: index + 1, availablePlaces: 100, startDateTime: `2026-11-${String(index + 1).padStart(2, "0")}T10:00`, endDateTime: `2026-11-${String(index + 1).padStart(2, "0")}T12:00` }));
  events.push({ ...events[8], id: 99, status: "CANCELLED", title: "Annulé" });
  await page.route("**/api/admin/events", route => route.fulfill({ json: events }));
  await page.goto(`${BASE}/admin/events`);
  await page.getByLabel("Choose a date", { exact: true }).fill("2026-11-09");
  const schedule = page.locator('a[href="/admin/events/9/edit"]').first();
  await expect(schedule).toBeVisible();
  await expect(schedule).not.toContainText("Time conflict");
  await expect(page.getByText("No conflict", { exact: true }).first()).toBeVisible();
});

test("F05 profil conserve rememberSession et tous les champs ont un label", async ({ page }) => {
  await prepare(page, "MEMBER", true);
  await page.route("**/api/user/me", route => route.fulfill({ json: { ...user, firstName: route.request().method() === "PUT" ? "Modified" : user.firstName } }));
  await page.goto(`${BASE}/profile`);
  await page.getByLabel("First name", { exact: true }).fill("Modified");
  await page.getByLabel("Last name", { exact: true }).fill("Test");
  for (const id of ["profile-email", "profile-current-password", "profile-new-password", "profile-confirm-password", "profile-new-email", "profile-email-password"]) {
    await expect(page.locator(`label[for="${id}"]`)).toHaveCount(1);
  }
  await page.locator("form").first().getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("auth") || "null")?.user?.firstName)).toBe("Modified");
  await expect.poll(() => page.evaluate(() => ({ local: Boolean(localStorage.getItem("auth")), session: Boolean(sessionStorage.getItem("auth")) }))).toEqual({ local: true, session: false });
});

test("F06 événement publié sans lien édition et URL directe sans formulaire", async ({ page }) => {
  await prepare(page, "ORGANIZER");
  await page.route("**/api/organizer/events/my", route => route.fulfill({ json: [event] }));
  await page.route("**/api/organizer/events/my/17", route => route.fulfill({ json: event }));
  await page.goto(`${BASE}/organizer/events`);
  await expect(page.getByText("Audit événement", { exact: true }).first()).toBeVisible();
  await expect(page.locator('a[href="/organizer/events/edit/17"]')).toHaveCount(0);
  await page.goto(`${BASE}/organizer/events/edit/17`);
  await expect(page.getByRole("alert")).toContainText("can no longer be edited");
  await expect(page.locator("form")).toHaveCount(0);
});

test("F08/F10 erreurs partielles explicites, sans codes techniques ni faux zéro", async ({ page }) => {
  await prepare(page);
  for (const path of ["/api/admin/events/pending", "/api/admin/parking/sessions"]) {
    await page.route(`**${path}`, route => route.fulfill({ status: 500, json: { message: "INTERNAL_ERROR" } }));
  }
  await page.goto(`${BASE}/admin`);
  await expect(page.getByRole("alert")).toContainText("Pending events");
  await expect(page.getByRole("alert")).toContainText("Parking");
  await expect(page.getByText("INTERNAL_ERROR", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Data unavailable", { exact: true }).first()).toBeVisible();
});

test("F09/F11 chargement bloqué borné, réessai ne conserve pas l’erreur", async ({ page }) => {
  await prepare(page);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let calls = 0;
  let blocked = true;
  await page.route("**/api/admin/audit?**", async route => {
    calls += 1;
    if (blocked) await gate;
    return route.fulfill({ json: { content: [], totalPages: 0, totalElements: 0 } }).catch(() => {});
  });
  await page.goto(`${BASE}/admin?tab=audit`);
  await expect.poll(() => calls).toBeGreaterThanOrEqual(1);
  await page.clock.fastForward(16000);
  await expect(page.getByRole("alert")).toContainText("Loading took too long");
  const initialCalls = calls;
  blocked = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect.poll(() => calls).toBeGreaterThan(initialCalls);
  release();
});

test("F12 réservation annulée : historique conservé sans QR ni code copiable", async ({ page }) => {
  await prepare(page, "MEMBER");
  await page.route("**/api/public/events/registrations/me", route => route.fulfill({ json: [{ id: 12, eventId: 17, eventTitle: event.title, eventStartDateTime: event.startDateTime, eventEndDateTime: event.endDateTime, numberOfParticipants: 1, status: "CANCELLED", ticketToken: "must-not-render", totalPrice: 10 }] }));
  await page.goto(`${BASE}/receipts/event/12`);
  await expect(page.getByText("This booking is cancelled. No admission ticket is valid.")).toBeVisible();
  await expect(page.getByText("must-not-render", { exact: true })).toHaveCount(0);
  await expect(page.locator('img[src^="data:image"]')).toHaveCount(0);
});

test("F14 événement complet : entrée waitlist dans liste et fiche", async ({ page }) => {
  await prepare(page, "MEMBER");
  await page.goto(`${BASE}/events`);
  const cta = page.getByRole("link", { name: "Waitlist", exact: true });
  await expect(cta).toHaveAttribute("href", "/events/register/17");
  await page.goto(`${BASE}/events/17`);
  await expect(page.getByRole("link", { name: "Waitlist", exact: true })).toHaveAttribute("href", "/events/register/17");
  await page.getByRole("link", { name: "Waitlist", exact: true }).click();
  await expect(page.getByRole("button", { name: "Join the waiting list", exact: true })).toBeVisible();
});

test("F15 échec changement période : aucun ancien chiffre sous la nouvelle période, retry actif", async ({ page }) => {
  await prepare(page);
  let failed = false;
  await page.route("**/api/admin/finance/summary?**", route => failed ? route.fulfill({ status: 500, json: { message: "INTERNAL_ERROR" } }) : route.fulfill({ json: { meetSpaceEstimatedRevenue: 12345, netCashFlow: 0, events: [] } }));
  await page.route("**/api/admin/finance/trend?**", route => route.fulfill({ json: { points: [], from: "2026-07-06", to: "2026-10-03", granularity: "DAY" } }));
  await page.goto(`${BASE}/admin/finances`);
  await expect(page.getByTestId("admin-finance")).toBeVisible();
  failed = true;
  await page.getByRole("button", { name: "30 days", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("admin-finance")).toHaveCount(0);
  await expect(page.getByText("INTERNAL_ERROR", { exact: true })).toHaveCount(0);
  failed = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByTestId("admin-finance")).toBeVisible();
  await expect(page.getByRole("button", { name: "30 days", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("F16 événement inexistant ne montre aucun formulaire modifiable", async ({ page }) => {
  await prepare(page);
  await page.route("**/api/admin/events/404", route => route.fulfill({ status: 404, json: { message: "EVENT_NOT_FOUND" } }));
  await page.goto(`${BASE}/admin/events/404/edit`);
  await expect(page.getByRole("alert")).toContainText("Event not found");
  await expect(page.locator("form")).toHaveCount(0);
});

test("suppression compte conserve le succès après logout, route nécessite encore une session", async ({ page }) => {
  await prepare(page, "MEMBER");
  await page.goto(`${BASE}/confirm-account-deletion?token=synthetic`);
  await page.locator("button").filter({ hasText: /delete|deletion/i }).click();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("auth"))).toBe(null);
  await expect(page).toHaveURL(/confirm-account-deletion/);
  await expect(page.getByRole("status").filter({ hasText: /deleted/i })).toBeVisible();
  await page.clock.fastForward(3000);
  await expect(page).toHaveURL(/confirm-account-deletion/);
});

test("suppression compte anonyme retourne au login avec destination conservée", async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ json: [] }));
  await page.goto(`${BASE}/confirm-account-deletion?token=synthetic`);
  await expect(page).toHaveURL(/\/login$/);
});

for (const type of ["events", "parking"]) {
  test(`fiche ${type} : titre API long sans débordement mobile clair/sombre`, async ({ page }, testInfo) => {
    await prepare(page, "MEMBER", false, "fr");
    const title = `User Event 1791047510986 ${"Identifiant".repeat(12)}`;
    if (type === "events") await page.route("**/api/public/events", route => route.fulfill({ json: [{ ...event, title }] }));
    else await page.route("**/api/public/parking/sessions", route => route.fulfill({ json: [{ id: 4, title, slotDate: "2026-11-10", startTime: "10:00", endTime: "12:00", parkingCapacity: 150, availableSpaces: 100, parkingRate: 5 }] }));
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.goto(`${BASE}/${type}/${type === "events" ? 17 : 4}`);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    for (const theme of ["light", "dark"]) {
      await page.evaluate(theme => document.documentElement.setAttribute("data-theme", theme), theme);
      const measurements = await page.evaluate(() => ({
        viewport: innerWidth, width: document.documentElement.scrollWidth,
        offenders: [...document.querySelectorAll("main *")].filter(el => el.getBoundingClientRect().right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 1)
          .map(el => ({ tag: el.tagName, className: el.className, right: el.getBoundingClientRect().right, width: el.clientWidth, scrollWidth: el.scrollWidth, text: el.textContent?.slice(0, 90) })),
      }));
      await testInfo.attach(`overflow-${theme}.json`, { body: JSON.stringify(measurements, null, 2), contentType: "application/json" });
      await page.screenshot({ path: testInfo.outputPath(`long-title-390-${theme}.png`) });
      expect(measurements.width, JSON.stringify(measurements.offenders)).toBeLessThanOrEqual(measurements.viewport);
      const heading = page.getByRole("heading", { name: title, exact: true });
      expect(await heading.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      await expect(heading).toHaveCSS("overflow", "visible");
    }
  });
}
