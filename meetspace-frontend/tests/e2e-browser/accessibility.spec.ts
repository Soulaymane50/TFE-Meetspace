import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicPages = [
  { path: "/", name: "accueil" },
  { path: "/espace", name: "catalogue des salles" },
  { path: "/events", name: "catalogue des événements" },
  { path: "/login", name: "connexion" },
];

for (const theme of ["light", "dark"]) {
  for (const entry of publicPages) {
    test(`${entry.name} ne présente aucune violation critique en mode ${theme}`, async ({ page }) => {
      await page.addInitScript((selectedTheme) => {
        localStorage.setItem("theme", selectedTheme);
      }, theme);
      await page.goto(entry.path);
      await page.waitForLoadState("domcontentloaded");

      const results = await new AxeBuilder({ page }).analyze();
      const blockingViolations = results.violations.filter(
        (violation) => violation.impact === "critical" || violation.impact === "serious",
      );

      expect(blockingViolations, JSON.stringify(blockingViolations, null, 2)).toEqual([]);
    });
  }
}

test("la navigation principale reste utilisable au clavier", async ({ page }) => {
  await page.goto("/");
  const skipLink = page.getByRole("link", { name: /contenu principal|main content|hoofdinhoud/i });
  for (let step = 0; step < 3 && !(await skipLink.evaluate((element) => element === document.activeElement)); step += 1) {
    await page.keyboard.press("Tab");
  }
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});
