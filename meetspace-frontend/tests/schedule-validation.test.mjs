import assert from "node:assert/strict";
import { test } from "node:test";
import { isCalendarRangeAvailable, localTimeAtHour } from "../src/utils/scheduleValidation.js";

const range = { startDateTime: "2026-11-10T10:00", endDateTime: "2026-11-10T11:30", year: 2026, month: 11, earliestStart: "2026-11-01T08:00", blocks: [] };
test("ignore seulement le bon type de bloc et le bon identifiant", () => {
  const self = { id: 17, blockType: "RESERVATION", ...range };
  assert.equal(isCalendarRangeAvailable({ ...range, blocks: [self], ignoreBlockId: 17, ignoreBlockType: "RESERVATION" }), true);
  assert.equal(isCalendarRangeAvailable({ ...range, blocks: [{ ...self, blockType: "EVENT" }], ignoreBlockId: 17, ignoreBlockType: "RESERVATION" }), false);
  assert.equal(isCalendarRangeAvailable({ ...range, blocks: [{ ...self, blockType: "PAYMENT_HOLD" }], ignoreBlockId: 17, ignoreBlockType: "RESERVATION" }), false);
});
test("refuse créneau commencé même si la fin est future", () => {
  assert.equal(isCalendarRangeAvailable({ ...range, earliestStart: "2026-11-10T10:15" }), false);
});
test("respecte les minutes et les intervalles demi-ouverts", () => {
  const block = { id: 9, blockType: "EVENT", startDateTime: "2026-11-10T11:30", endDateTime: "2026-11-10T12:30" };
  assert.equal(isCalendarRangeAvailable({ ...range, blocks: [block] }), true);
  assert.equal(isCalendarRangeAvailable({ ...range, endDateTime: "2026-11-10T11:31", blocks: [block] }), false);
});
test("refuse données d'un autre mois et changement de jour", () => {
  assert.equal(isCalendarRangeAvailable({ ...range, month: 12 }), false);
  assert.equal(isCalendarRangeAvailable({ ...range, endDateTime: "2026-11-11T11:30" }), false);
});
test("respecte fermeture, date invalide et délai minimal", () => {
  assert.equal(isCalendarRangeAvailable({ ...range, endDateTime: "2026-11-10T22:01" }), false);
  assert.equal(isCalendarRangeAvailable({ ...range, startDateTime: "bad" }), false);
  assert.equal(isCalendarRangeAvailable({ ...range, earliestStart: "2026-11-11T08:00" }), false);
});
test("préserve les demi-heures au lieu de fabriquer une heure invalide", () => {
  assert.equal(localTimeAtHour("2026-11-10", 10.5), "2026-11-10T10:30");
});

test("la frise fusionne les occupations et les limite aux heures d'ouverture", async () => {
  const { getDayOccupancy } = await import("../src/utils/scheduleValidation.js");
  const segments = getDayOccupancy([
    {start:"2026-11-10T06:00",end:"2026-11-10T08:30"},
    {start:"2026-11-10T08:00",end:"2026-11-10T09:00"},
    {start:"2026-11-10T12:00",end:"2026-11-10T14:00"},
    {start:"2026-11-11T12:00",end:"2026-11-11T14:00"},
  ], "2026-11-10");
  const hours = (time) => new Date(time).getHours();
  assert.deepEqual(segments.map(s => [hours(s.start), hours(s.end), s.occupied]),
    [[7,9,true],[9,12,false],[12,14,true],[14,22,false]]);
  assert.deepEqual(getDayOccupancy([], "bad"), []);
});
