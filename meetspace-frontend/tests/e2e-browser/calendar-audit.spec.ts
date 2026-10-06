import { expect, Page, test } from "@playwright/test";

const BASE_URL = process.env.FRONT_URL || "http://localhost:5173";
test.beforeEach(() => {
  if (!["localhost", "127.0.0.1"].includes(new URL(BASE_URL).hostname)) throw new Error("Audit réservé au frontend local");
});

async function prepare(page: Page, language = "fr", role = "MEMBER") {
  await page.clock.setFixedTime(new Date("2026-11-01T08:00:00"));
  await page.addInitScript(({ language, role }) => {
    localStorage.setItem("i18nextLng", language);
    sessionStorage.setItem("auth", JSON.stringify({ token: "e30.eyJleHAiOjQxMDI0NDQ4MDB9.test", user: {id: 12, role, firstName: "Test"} }));
  }, {language, role});
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/public/espaces") return route.fulfill({ json: [{id:1,name:"Salle Atlas",capacity:100,basePrice:130,type:"MEETING_ROOM"}] });
    if (path === "/api/public/reservations/17") return route.fulfill({ json: {id:17,status:"CONFIRMED",startDateTime:"2026-11-10T10:00:00",endDateTime:"2026-11-10T11:30:00",totalPrice:195,espace:{id:1,name:"Salle Atlas"}} });
    return route.fulfill({ json: [] });
  });
}

test("déplacement ignore sa réservation mais pas un événement de même id, conserve 1h30", async ({page}) => {
  await prepare(page);
  await page.route("**/api/public/reservations/espace/1/calendar?**", route => route.fulfill({json:[
    {id:17,blockType:"RESERVATION",startDateTime:"2026-11-10T10:00",endDateTime:"2026-11-10T11:30"},
    {id:17,blockType:"EVENT",startDateTime:"2026-11-10T12:00",endDateTime:"2026-11-10T14:00"},
  ]}));
  await page.goto(`${BASE_URL}/reservations/17/edit`);
  await expect(page.getByRole("button",{name:"Confirmer le nouveau créneau"})).toBeEnabled();
  await expect(page.getByRole("button",{name:"13:00",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"09:00",exact:true}).click();
  await expect(page.getByText("mardi 10 novembre · 09:00 – 10:30",{exact:true})).toBeVisible();
});

test("navigation mensuelle invalide le créneau jusqu'au retour du bon calendrier", async ({page}) => {
  await prepare(page);
  await page.goto(`${BASE_URL}/reservations/17/edit`);
  const submit=page.getByRole("button",{name:"Confirmer le nouveau créneau"});
  await expect(submit).toBeEnabled();
  await page.getByRole("button",{name:"Mois suivant"}).click();
  await expect(submit).toBeDisabled();
  await expect(page.getByRole("button",{name:"10:00",exact:true})).toBeDisabled();
  await page.getByRole("button",{name:"Mois précédent"}).click();
  await expect(submit).toBeEnabled();
});

test("un préremplissage déjà commencé ne permet pas de continuer", async ({page}) => {
  await prepare(page);
  await page.goto(`${BASE_URL}/reservations/new/1?date=2026-11-01&start=07:00&duration=2`);
  await expect(page.getByRole("button",{name:"Continuer vers le récapitulatif"})).toBeDisabled();
});

for (const [language, retry, nextMonth] of [["fr","Réessayer","Mois suivant"],["en","Try again","Next month"],["nl","Opnieuw proberen","Volgende maand"]]) {
  test(`calendrier invalide reste fermé et réessai traduit ${language}`, async ({page}) => {
    await prepare(page, language);
    let calls=0;
    await page.route("**/api/public/reservations/espace/1/calendar?**", route => route.fulfill({json: ++calls === 1 ? {message:"INTERNAL_ERROR"} : []}));
    await page.goto(`${BASE_URL}/reservations/17/edit`);
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByText("INTERNAL_ERROR",{exact:true})).toHaveCount(0);
    await expect(page.getByRole("button",{name:"10:00",exact:true})).toBeDisabled();
    await page.getByRole("button",{name:retry,exact:true}).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("button",{name:nextMonth,exact:true})).toBeVisible();
    await expect(page.getByRole("button",{name:"10:00",exact:true})).toBeEnabled();
  });
}

for (const path of ["/admin/finances","/organizer/events/new"]) {
  test(`un membre ne peut pas ouvrir ${path}`, async ({page}) => {
    await prepare(page);
    await page.goto(`${BASE_URL}${path}`);
    await expect(page).toHaveURL(`${BASE_URL}/`);
  });
}

test("frise lisible sur mobile et desktop, jours complets consultables sans réservation", async ({page}, testInfo) => {
  await prepare(page);
  await page.route("**/api/public/reservations/espace/1/calendar?**", route => route.fulfill({json:[
    {id:44,blockType:"EVENT",startDateTime:"2026-11-10T12:00",endDateTime:"2026-11-10T14:00",title:"Titre privé à ne jamais afficher"},
    {id:45,blockType:"EVENT",startDateTime:"2026-11-11T07:00",endDateTime:"2026-11-11T22:00"},
  ]}));
  await page.goto(`${BASE_URL}/reservations/17/edit`);
  const periods = page.getByRole("list", {name:"La journée en un coup d’œil"});
  await expect(periods).toContainText("12:00 – 14:00");
  await expect(periods).toContainText("Occupé");
  await expect(page.getByText("Titre privé à ne jamais afficher")).toHaveCount(0);
  for (const width of [1440,390]) {
    await page.setViewportSize({width,height:1000});
    await periods.scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`calendar-modern-${width}.png`)});
  }
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page.screenshot({path:testInfo.outputPath("calendar-modern-dark.png")});
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await page.getByRole("button",{name:/mercredi 11 novembre/}).click();
  await expect(periods).toContainText("07:00 – 22:00");
  await expect(page.getByText(/Aucun départ possible/)).toBeVisible();
  await expect(page.getByRole("button",{name:"Confirmer le nouveau créneau"})).toBeDisabled();
  await page.getByRole("button",{name:"Mois suivant"}).click();
  await expect(periods).toHaveCount(0);
  await page.goto(`${BASE_URL}/reservations/new/1?date=2026-11-10&start=09:00&duration=2`);
  const next = page.getByRole("button", {name:"Continuer vers le récapitulatif"});
  await expect(next).toBeEnabled();
  await next.scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath("booking-mobile-summary.png")});
  await next.click();
  await expect(page.getByRole("button", {name:"Modifier le créneau"})).toBeVisible();
});
