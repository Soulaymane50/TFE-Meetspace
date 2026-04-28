import { test, expect } from "@playwright/test";
import {
  adminCreateEspace,
  adminCreateEvent,
  adminDeleteEspace,
  adminDeleteEvent,
  adminEnsureRole,
  isoDateTime,
  loginToken,
  userRegisterEvent,
} from "./utils/api";

const ADMIN_EMAIL = "TestAdmin@TestAdmin.TestAdmin";
const ADMIN_PASSWORD = "123456@789";
const USER_EMAIL = "TestUser@TestUser.TestUser";
const USER_PASSWORD = "123456@789";

test.describe("API User flows", () => {
  let adminToken: string;
  let userToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await loginToken(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    await adminEnsureRole(request, adminToken, ADMIN_EMAIL, "ADMIN");
    await adminEnsureRole(request, adminToken, USER_EMAIL, "MEMBER");
    userToken = await loginToken(request, USER_EMAIL, USER_PASSWORD);
  });

  test("User registers to a free event", async ({ request }) => {
    const suffix = Date.now();
    const start = isoDateTime(24);
    const end = isoDateTime(26);

    const espace = await adminCreateEspace(request, adminToken, `API User Space ${suffix}`);
    const event = await adminCreateEvent(request, adminToken, `API User Event ${suffix}`, start, end, espace.id);

    const registration = await userRegisterEvent(request, userToken, {
      eventId: event.id,
      numberOfParticipants: 1,
      paymentIntentId: null,
    });
    expect(registration.id).toBeTruthy();

    await adminDeleteEvent(request, adminToken, event.id);
    await adminDeleteEspace(request, adminToken, espace.id);
  });
});
