import assert from "node:assert/strict";
import { test } from "node:test";
import { recentHistory } from "../src/utils/recentHistory.js";

const now = Date.parse("2026-10-06T10:00:00Z");
const getEnd = (r) => r.end;
const history = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, end: new Date(now - (i + 1) * 86400000).toISOString() }));

test("recent history keeps every upcoming and ongoing record and only ten completed records", () => {
  const upcoming = { id: 101, end: "2026-11-12T12:00:00Z" };
  const ongoing = { id: 102, start: "2026-10-06T09:00:00Z", end: "2026-10-06T11:00:00Z" };
  const records = [upcoming, ...history, ongoing];
  const result = recentHistory(records, { getEnd, now });
  assert.deepEqual(result.visible.map(r => r.id), [101, ...history.slice(0, 10).map(r => r.id), 102]);
  assert.equal(result.hiddenCount, 90);
  assert.equal(records.length, 102);
});

test("revealing older records adds ten in the same order without duplicating or losing upcoming items", () => {
  const result = recentHistory(history, { getEnd, now, limit: 20 });
  assert.deepEqual(result.visible, history.slice(0, 20));
  assert.equal(result.hiddenCount, 80);
  const all = recentHistory(history, { getEnd, now, limit: 110 });
  assert.deepEqual(all.visible, history); assert.equal(all.hiddenCount, 0);
});

test("past records with an outstanding action stay visible outside the history quota", () => {
  const actionable = { id: 111, end: "2025-01-01T10:00:00Z", pending: true };
  const result = recentHistory([...history, actionable], { getEnd, now, keep: r => r.pending });
  assert.equal(result.visible.length, 11); assert.ok(result.visible.includes(actionable));
  assert.equal(result.hiddenCount, 90);
});

test("missing dates remain accessible and the exact end boundary belongs to history", () => {
  const records = [{ id: 1, end: null }, { id: 2, end: "invalid" }, { id: 3, end: new Date(now).toISOString() }, { id: 4, end: new Date(now + 1).toISOString() }];
  const result = recentHistory(records, { getEnd, now, limit: 0 });
  assert.deepEqual(result.visible.map(r => r.id), [1, 2, 4]);
  assert.equal(result.hiddenCount, 1);
});
