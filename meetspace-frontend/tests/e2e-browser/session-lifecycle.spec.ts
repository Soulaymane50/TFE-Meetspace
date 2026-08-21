import { expect, test } from "@playwright/test";

const BASE_URL = process.env.FRONT_URL || "http://localhost:5173";

function createToken(expirationSeconds: number) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ exp: expirationSeconds })}.signature`;
}

const storedUser = {
  id: 9001,
  firstName: "Session",
  lastName: "Test",
  email: "session.test@meetspace-demo.test",
  role: "MEMBER",
};

test("an expired stored session is cleared before opening a private workspace", async ({ page }) => {
  const token = createToken(Math.floor(Date.now() / 1000) - 60);
  await page.addInitScript(({ user, expiredToken }) => {
    localStorage.setItem("auth", JSON.stringify({ user, token: expiredToken }));
  }, { user: storedUser, expiredToken: token });

  await page.goto(`${BASE_URL}/my-reservations`);

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("status")).toContainText(/session.*(expir|verlop)/i);
  await expect.poll(() => page.evaluate(() => ({
    local: localStorage.getItem("auth"),
    session: sessionStorage.getItem("auth"),
  }))).toEqual({ local: null, session: null });
});

test("a 401 response expires the active session and preserves the requested destination", async ({ page }) => {
  const token = createToken(Math.floor(Date.now() / 1000) + 3600);
  await page.addInitScript(({ user, activeToken }) => {
    sessionStorage.setItem("auth", JSON.stringify({ user, token: activeToken }));
  }, { user: storedUser, activeToken: token });
  await page.route("**/api/**", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "SESSION_EXPIRED" }),
    });
  });

  await page.goto(`${BASE_URL}/my-reservations?tab=events`);

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("status")).toContainText(/session.*(expir|verlop)/i);
  const destination = await page.evaluate(() => history.state?.usr?.from);
  expect(destination).toBe("/my-reservations?tab=events");
  await expect.poll(() => page.evaluate(() => ({
    local: localStorage.getItem("auth"),
    session: sessionStorage.getItem("auth"),
  }))).toEqual({ local: null, session: null });
});
