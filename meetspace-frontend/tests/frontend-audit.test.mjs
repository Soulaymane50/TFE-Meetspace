import test from "node:test";
import assert from "node:assert/strict";
import { getAvailability } from "../src/utils/availability.js";
import { eventDays, eventsConflict, canEditOrganizerEvent } from "../src/utils/eventPlanning.js";
import { privateRead } from "../src/services/privateRead.js";
import { apiErrorMessage } from "../src/utils/apiErrors.js";
import translations from "../src/locales/frontendAudit.js";

test("F01 aucun départ passé, même si la fin du créneau est future", () => {
  const result = getAvailability("2026-10-03", 2, [], new Date("2026-10-03T10:30:00"));
  assert.equal(result.firstSlot, "11:00");
  assert.equal(result.availableHours, 11);
  assert.equal(getAvailability("2026-10-03", 2, [], new Date("2026-10-03T20:01:00")).firstSlot, null);
});
test("F01 passage du temps recalcule le départ sans nouvelle réponse API", () => {
  assert.equal(getAvailability("2026-10-03", 2, [], new Date("2026-10-03T10:00:00")).firstSlot, "10:00");
  assert.equal(getAvailability("2026-10-03", 2, [], new Date("2026-10-03T10:00:01")).firstSlot, "11:00");
});
test("F02 réponse calendrier malformée ou date invalide ne vaut jamais salle libre", () => {
  for (const blocks of [{ message: "INTERNAL_ERROR" }, null, [{ startDateTime: "bad", endDateTime: "bad" }]]) {
    assert.throws(() => getAvailability("2026-11-03", 2, blocks), /INVALID_CALENDAR/);
  }
  assert.throws(() => getAvailability("2026-02-30", 2, []), /INVALID_DATE/);
});
test("F02 un bloc commencé le mois précédent bloque le jour recherché", () => {
  const result = getAvailability("2026-11-01", 2, [{ startDateTime: "2026-10-31T21:00", endDateTime: "2026-11-01T12:00" }], new Date("2026-10-03"));
  assert.equal(result.firstSlot, "12:00");
});
const overnight = { id: 1, spaceId: 1, status: "PUBLISHED", startDateTime: "2026-10-31T21:00", endDateTime: "2026-11-01T12:00" };
test("F04 conflit multijour réel, annulé/refusé ignoré, adjacence acceptée", () => {
  const next = { ...overnight, id: 2, startDateTime: "2026-11-01T10:00", endDateTime: "2026-11-01T14:00" };
  assert.equal(eventsConflict(overnight, next), true);
  for (const status of ["CANCELLED", "REJECTED"]) assert.equal(eventsConflict(overnight, { ...next, status }), false);
  assert.equal(eventsConflict(overnight, { ...next, spaceId: 2 }), false);
  assert.equal(eventsConflict(overnight, { ...next, startDateTime: overnight.endDateTime }), false);
});
test("F04 jours occupés incluent lendemain et excluent la fin à minuit", () => {
  assert.deepEqual(eventDays(overnight), ["2026-10-31", "2026-11-01"]);
  assert.deepEqual(eventDays({ ...overnight, endDateTime: "2026-11-01T00:00" }), ["2026-10-31"]);
});
test("F06 seules transitions modifiables côté backend exposent l’édition", () => {
  for (const status of ["PENDING_APPROVAL", "REJECTED"]) assert.equal(canEditOrganizerEvent({ status }), true);
  for (const status of ["PUBLISHED", "AWAITING_DEPOSIT", "CANCELLED", "DRAFT"]) assert.equal(canEditOrganizerEvent({ status }), false);
});
test("F07 erreurs et validations traduites dans les trois langues", () => {
  for (const language of ["fr", "en", "nl"]) {
    for (const key of ["titleRequired", "startDateRequired", "endDateRequired", "capacityRequired", "descriptionRequired"]) {
      assert.ok(translations[language].validation[key]);
    }
    assert.ok(translations[language].system.requestTimeout);
  }
});
test("F08 codes techniques/HTML/serveur masqués, validation métier préservée", () => {
  const t = (key) => key;
  for (const message of ["INTERNAL_ERROR", "java.lang.Exception", "<html>502</html>", "Failed to fetch"]) {
    assert.equal(apiErrorMessage(message, 400, t), "system.requestFailed");
  }
  assert.equal(apiErrorMessage("message technique", 500, t), "system.requestFailed");
  assert.equal(apiErrorMessage("Créneau déjà réservé", 409, t), "Créneau déjà réservé");
  assert.equal(apiErrorMessage("REQUEST_TIMEOUT", undefined, t), "system.requestTimeout");
});
test("F09 deadline couvre un fetch qui ne termine jamais et annule le transport", async () => {
  let signal;
  await assert.rejects(privateRead("/api/user/me", {}, 20, (_, options) => { signal = options.signal; return new Promise(() => {}); }), { code: "REQUEST_TIMEOUT" });
  assert.equal(signal.aborted, true);
});
test("F09 deadline couvre le corps après réception immédiate des headers", async () => {
  const res = await privateRead("/api/admin/stats", {}, 20, async () => ({ ok: true, status: 200, headers: new Headers(), json: () => new Promise(() => {}) }));
  await assert.rejects(res.json(), { code: "REQUEST_TIMEOUT" });
});
test("F09 retry indépendant et absence de partage entre deux comptes", async () => {
  const calls = [];
  const fetcher = async (_, options) => { calls.push(options.headers.Authorization); return new Response(JSON.stringify({ token: options.headers.Authorization }), { headers: { "Content-Type": "application/json" } }); };
  const [a, b] = await Promise.all([privateRead("/api/user/me", { headers: { Authorization: "A" } }, 1000, fetcher), privateRead("/api/user/me", { headers: { Authorization: "B" } }, 1000, fetcher)]);
  assert.deepEqual(await a.json(), { token: "A" });
  assert.deepEqual(await b.json(), { token: "B" });
  assert.deepEqual(calls, ["A", "B"]);
});
