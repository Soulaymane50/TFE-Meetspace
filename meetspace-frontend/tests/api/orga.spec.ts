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
  registerMember,
} from "./utils/api";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";
const ORGA_EMAIL = `e2e.api.orga.${Date.now()}@example.invalid`;
const ORGA_PASSWORD = "MeetSpace!E2E26";

test.describe("API Organizer flows", () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run organizer API flows.");
  let orgaToken: string;
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await loginToken(request, ADMIN_EMAIL, ADMIN_PASSWORD);
    await adminEnsureRole(request, adminToken, ADMIN_EMAIL, "ADMIN");
    await registerMember(request, ORGA_EMAIL, ORGA_PASSWORD);
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
