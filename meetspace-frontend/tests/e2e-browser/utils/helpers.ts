import { Page, expect } from "@playwright/test";

const BASE_URL = process.env.FRONT_URL || "http://localhost:5173";

export async function ensureLoggedOut(page: Page) {
  await page.goto(BASE_URL);

  const logoutButton = page.locator('button, a').filter({ hasText: /logout|déconnexion|se déconnecter/i }).first();

  if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutButton.click();
    await page.waitForTimeout(500);
  }
}

export async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`);

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
}

export async function logout(page: Page) {
  const logoutButton = page.locator('button, a').filter({ hasText: /logout|déconnexion|se déconnecter/i }).first();

  if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutButton.click();
    await page.waitForTimeout(500);
  }
}

export async function navigateViaNavbar(page: Page, linkText: RegExp) {
  const navLink = page.locator('nav').getByRole('link', { name: linkText }).first();
  await navLink.click();
}
