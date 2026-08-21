import { Page, expect } from "@playwright/test";

const BASE_URL = process.env.FRONT_URL || "http://localhost:5173";
const API_URL = process.env.API_URL || "http://localhost:8080";
const preparedMembers = new Set<string>();

export async function ensureMember(page: Page, email: string, password: string) {
  if (preparedMembers.has(email)) return;

  const response = await page.request.post(`${API_URL}/api/auth/register`, {
    data: {
      firstName: "E2E",
      lastName: "Member",
      email,
      password,
      confirmPassword: password,
    },
  });

  if (![200, 201, 409].includes(response.status())) {
    throw new Error(`Unable to prepare E2E member (${response.status()}): ${await response.text()}`);
  }

  preparedMembers.add(email);
}

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
