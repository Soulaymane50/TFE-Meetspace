import { test, expect } from "@playwright/test";
import {
  adminCreateEspace,
  adminCreateEvent,
  adminCreateParkingSlot,
  adminDeleteEspace,
  adminDeleteEvent,
  adminDeleteParkingSlot,
  adminEnsureRole,
  isoDate,
  isoDateTime,
  loginToken,
} from "./utils/api";

const ADMIN_EMAIL = "TestAdmin@TestAdmin.TestAdmin";
const ADMIN_PASSWORD = "123456@789";

test.describe("API Admin flows", () => {
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await loginToken(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    await adminEnsureRole(request, adminToken, ADMIN_EMAIL, "ADMIN");
  });

  test("Admin creates and deletes a space", async ({ request }) => {
    const suffix = Date.now();

    const espace = await adminCreateEspace(request, adminToken, `API Admin Space ${suffix}`);
    expect(espace.id).toBeTruthy();
    expect(espace.name).toBe(`API Admin Space ${suffix}`);

    await adminDeleteEspace(request, adminToken, espace.id);
  });

  test("Admin creates and deletes an event", async ({ request }) => {
    const suffix = Date.now();
    const start = isoDateTime(48);
    const end = isoDateTime(50);

    const espace = await adminCreateEspace(request, adminToken, `API Event Space ${suffix}`);
    const event = await adminCreateEvent(request, adminToken, `API Admin Event ${suffix}`, start, end, espace.id);
    expect(event.id).toBeTruthy();
    expect(event.title).toBe(`API Admin Event ${suffix}`);

    await adminDeleteEvent(request, adminToken, event.id);
    await adminDeleteEspace(request, adminToken, espace.id);
  });

  test("Admin creates and deletes a parking slot", async ({ request }) => {
    const suffix = Date.now();
    const sessionDate = isoDate(3);

    const parkingSlot = await adminCreateParkingSlot(request, adminToken, `API Parking ${suffix}`, sessionDate);
    expect(parkingSlot.id).toBeTruthy();
    expect(parkingSlot.title).toBe(`API Parking ${suffix}`);

    await adminDeleteParkingSlot(request, adminToken, parkingSlot.id);
  });
});
