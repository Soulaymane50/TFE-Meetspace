import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReservationPayment, getApprovalPaymentDeadline } from '../src/utils/reservationPayment.js';
import { formatDate, buildUserActivityItems } from '../src/utils/userActivity.js';

const now = new Date('2026-10-05T18:00:00').getTime();
const approved = { id: 5000, status: 'APPROVED', startDateTime: '2026-11-05T09:00:00', endDateTime: '2026-11-05T11:00:00', totalPrice: 640, espace: { name: 'Orion' } };

test('old unpaid approval leaves the payment queue without deleting history', () => {
  const old = { ...approved, startDateTime: '2025-08-04T09:00:00', approvedAt: '2025-07-15T11:00:00' };
  const normalized = normalizeReservationPayment(old, now);
  assert.equal(normalized.status, 'CANCELLED'); assert.equal(normalized.paymentExpired, true);
  assert.equal(normalized.id, old.id); assert.equal(normalized.totalPrice, 640); assert.equal(old.status, 'APPROVED');
  assert.equal(buildUserActivityItems({ spaces: [old] }).length, 0);
});

test('missing deadline falls back to 48 hours after approval, including the boundary', () => {
  const legacy = { ...approved, approvedAt: '2026-10-03T18:00:00' };
  assert.equal(getApprovalPaymentDeadline(legacy), now);
  assert.equal(normalizeReservationPayment(legacy, now - 1).status, 'APPROVED');
  assert.equal(normalizeReservationPayment(legacy, now).status, 'CANCELLED');
});

test('future deadline cannot authorize paying after the room slot starts', () => {
  const started = { ...approved, startDateTime: '2026-10-05T18:00:00', paymentDueAt: '2026-10-06T18:00:00' };
  assert.equal(getApprovalPaymentDeadline(started), now);
  assert.equal(normalizeReservationPayment(started, now).status, 'CANCELLED');
});

test('future approvals remain payable and an explicit deadline takes priority over legacy fallback', () => {
  const future = { ...approved, approvedAt: '2026-08-18T10:00:00', paymentDueAt: '2026-11-01T10:00:00' };
  assert.equal(normalizeReservationPayment(future, now).status, 'APPROVED');
  assert.equal(normalizeReservationPayment({ ...approved, approvedAt: '2026-10-05T10:00:00' }, now).status, 'APPROVED');
});

test('paid and rejected historical bookings keep their original statuses', () => {
  for (const status of ['CONFIRMED', 'REJECTED', 'CANCELLED', 'PENDING_APPROVAL']) {
    const booking = { ...approved, status, startDateTime: '2025-08-04T09:00:00' };
    assert.equal(normalizeReservationPayment(booking, now), booking);
  }
});

test('server expiration flag disables payment even with a client clock behind', () => {
  assert.equal(normalizeReservationPayment({ ...approved, paymentExpired: true }, now).status, 'CANCELLED');
});

test('payment deadline formatting supports dateStyle and timeStyle in all three languages', () => {
  for (const locale of ['fr-BE','en-GB','nl-BE']) {
    const text = formatDate(new Date('2026-10-06T18:00:00'), locale, {dateStyle:'medium',timeStyle:'short'});
    assert.ok(text.includes('2026')); assert.ok(text.includes('18:00'));
  }
});
