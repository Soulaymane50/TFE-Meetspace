import { test, expect } from "@playwright/test";
import {
  isoDateTime,
  loginToken,
  organizerCreateEvent,
  adminCreateEspace,
  adminDeleteEspace,
  adminDeleteEvent,
  adminEnsureRole,
  adminApproveEvent,
} from "./utils/api";

const ADMIN_EMAIL = "TestAdmin@TestAdmin.TestAdmin";
const ADMIN_PASSWORD = "123456@789";
const ORGA_EMAIL = "TestOrga@TestOrga.TestOrga";
const ORGA_PASSWORD = "123456@789";

test.describe("API Organizer flows", () => {
  let orgaToken: string;
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await loginToken(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    await adminEnsureRole(request, adminToken, ADMIN_EMAIL, "ADMIN");
    await adminEnsureRole(request, adminToken, ORGA_EMAIL, "ORGANIZER");
    orgaToken = await loginToken(request, ORGA_EMAIL, ORGA_PASSWORD);
  });

  test("Organizer creates event and admin approves it", async ({ request }) => {
    const suffix = Date.now();
    const start = isoDateTime(20);
    const end = isoDateTime(22);

    const espace = await adminCreateEspace(request, adminToken, `API Orga Space ${suffix}`);

    const orgaEvent = await organizerCreateEvent(request, orgaToken, `API Orga Event ${suffix}`, start, end, espace.id);
    expect(orgaEvent.id).toBeTruthy();
    expect(orgaEvent.status).toBe("PENDING_APPROVAL");

    const approved = await adminApproveEvent(request, adminToken, orgaEvent.id);
    expect(approved.status).toBe("PUBLISHED");

    await adminDeleteEvent(request, adminToken, orgaEvent.id);
    await adminDeleteEspace(request, adminToken, espace.id);
  });
});
