const APPROVAL_WINDOW_MS = 48 * 60 * 60 * 1000;

export function getApprovalPaymentDeadline(reservation) {
  const start = new Date(reservation.startDateTime).getTime();
  const explicit = reservation.paymentDueAt ? new Date(reservation.paymentDueAt).getTime() : NaN;
  const approval = reservation.approvedAt ? new Date(reservation.approvedAt).getTime() : NaN;
  const deadline = Number.isFinite(explicit) ? explicit : approval + APPROVAL_WINDOW_MS;
  const dates = [start, deadline].filter(Number.isFinite);
  return dates.length ? Math.min(...dates) : NaN;
}

export function normalizeReservationPayment(reservation, now = Date.now()) {
  if (reservation.status !== "APPROVED") return reservation;
  const deadline = getApprovalPaymentDeadline(reservation);
  if (reservation.paymentExpired || (Number.isFinite(deadline) && deadline <= now)) {
    return { ...reservation, status: "CANCELLED", paymentExpired: true };
  }
  return { ...reservation, paymentDueAt:
    (Number.isFinite(deadline) ? new Date(deadline).toISOString() : null) };
}
