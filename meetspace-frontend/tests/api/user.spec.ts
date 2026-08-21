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
  registerMember,
  userRegisterEvent,
} from "./utils/api";

const API_URL = process.env.API_URL || "http://localhost:8080";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";
const USER_EMAIL = `e2e.api.user.${Date.now()}@example.invalid`;
const USER_PASSWORD = "MeetSpace!E2E26";

test.describe("API User flows", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run user API flows.");
  let adminToken: string;
  let userToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await loginToken(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    await adminEnsureRole(request, adminToken, ADMIN_EMAIL, "ADMIN");
    await registerMember(request, USER_EMAIL, USER_PASSWORD);
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

  test("User reserves a free parking slot without a payment intent", async ({ request }) => {
    const suffix = Date.now();
    const parkingSlot = await adminCreateParkingSlot(
      request,
      adminToken,
      `API Free Parking ${suffix}`,
      isoDate(2),
      { parkingRate: 0 },
    );

    try {
      const response = await request.post(`${API_URL}/api/public/parking/reservations`, {
        headers: { Authorization: `Bearer ${userToken}` },
        data: {
          parkingSlotId: parkingSlot.id,
          reservedSpaces: 1,
        },
      });

      expect(response.ok(), await response.text()).toBeTruthy();
      const reservation = await response.json();
      expect(reservation.id).toBeTruthy();
      expect(reservation.totalPrice).toBe(0);
    } finally {
      await adminDeleteParkingSlot(request, adminToken, parkingSlot.id);
    }
  });

  test("Started same-day parking slots are neither listed nor reservable", async ({ request }) => {
    const nowParts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Brussels",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date()).map((part) => [part.type, part.value]),
    );
    const minutesSinceMidnight = Number(nowParts.hour) * 60 + Number(nowParts.minute);
    test.skip(minutesSinceMidnight < 2, "The deterministic 00:00 test slot has not ended yet in Brussels.");

    const todayInBrussels = `${nowParts.year}-${nowParts.month}-${nowParts.day}`;
    const parkingSlot = await adminCreateParkingSlot(
      request,
      adminToken,
      `API Started Parking ${Date.now()}`,
      todayInBrussels,
      { parkingRate: 0, startTime: "00:00:00", endTime: "00:01:00" },
    );

    try {
      const listResponse = await request.get(`${API_URL}/api/public/parking/sessions`);
      expect(listResponse.ok(), await listResponse.text()).toBeTruthy();
      const sessions = await listResponse.json();
      expect(sessions.some((session: { id: number }) => session.id === parkingSlot.id)).toBeFalsy();

      const reservationResponse = await request.post(`${API_URL}/api/public/parking/reservations`, {
        headers: { Authorization: `Bearer ${userToken}` },
        data: { parkingSlotId: parkingSlot.id, reservedSpaces: 1 },
      });
      expect(reservationResponse.status()).toBe(400);
    } finally {
      await adminDeleteParkingSlot(request, adminToken, parkingSlot.id);
    }
  });
});
