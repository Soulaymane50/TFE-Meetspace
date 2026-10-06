export function parseDateTime(dateValue, timeValue) {
  if (!dateValue) return null;
  const value = timeValue ? `${dateValue}T${String(timeValue).slice(0, 5)}` : dateValue;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

import { normalizeReservationPayment } from "./reservationPayment.js";

export function getDateKey(date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDate(date, locale = "fr-BE", options = {}) {
  if (!date) return "";
  const resolvedOptions = options.dateStyle || options.timeStyle ? options : {
    weekday: "long",
    day: "2-digit",
    month: "long",
    ...options,
  };
  return new Intl.DateTimeFormat(locale, resolvedOptions).format(date);
}

export function formatTime(date) {
  if (!date) return "--:--";
  return new Intl.DateTimeFormat("fr-BE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getStatusTone(status) {
  const normalized = String(status || "").toUpperCase();
  if (["CONFIRMED", "PAID", "PUBLISHED"].includes(normalized)) return "success";
  if (["APPROVED", "PENDING_APPROVAL", "PENDING_PAYMENT"].includes(normalized)) return "warning";
  if (["CANCELLED", "REJECTED"].includes(normalized)) return "danger";
  return "neutral";
}

function isWithinDays(date, days) {
  if (!date) return false;
  const now = new Date();
  const limit = new Date(now);
  limit.setDate(limit.getDate() + days);
  return date >= now && date <= limit;
}

function isWithinHours(date, hours) {
  if (!date) return false;
  const now = new Date();
  const limit = new Date(now.getTime() + hours * 60 * 60 * 1000);
  return date >= now && date <= limit;
}

function activityText(t, key, defaultValue, values = {}) {
  return t ? t(`activity.${key}`, { defaultValue, ...values }) : defaultValue;
}

export function buildUserActivityItems({ spaces = [], events = [], parking = [] }, t) {
  const spaceItems = spaces.map((reservation) => normalizeReservationPayment(reservation))
    .map((reservation) => {
      const start = parseDateTime(reservation.startDateTime);
      const end = parseDateTime(reservation.endDateTime);
      return {
        id: `space-${reservation.id}`,
        sourceId: reservation.id,
        type: "space",
        title: reservation.espace?.name || reservation.espaceName || activityText(t, "roomTitle", "Salle réservée"),
        description: reservation.justification || activityText(t, "roomDescription", "Réservation de salle MeetSpace"),
        status: reservation.status,
        start,
        end,
        dateKey: getDateKey(start),
        amount: reservation.totalPrice,
        to: "/my-reservations?tab=spaces",
      };
    });

  const eventItems = events
    .map((registration) => {
      const start = parseDateTime(registration.eventStartDateTime || registration.eventDate);
      return {
        id: `event-${registration.id}`,
        sourceId: registration.id,
        type: "event",
        title: registration.eventTitle || activityText(t, "eventTitle", "Événement professionnel"),
        description: activityText(t, "participants", `${registration.numberOfParticipants || 1} participant(s)`, { count: registration.numberOfParticipants || 1 }),
        status: registration.status,
        start,
        end: null,
        dateKey: getDateKey(start),
        amount: registration.totalPrice,
        to: "/my-reservations?tab=events",
      };
    });

  const parkingItems = parking
    .map((reservation) => {
      const start = parseDateTime(reservation.slotDate, reservation.startTime);
      const end = parseDateTime(reservation.slotDate, reservation.endTime);
      return {
        id: `parking-${reservation.id}`,
        sourceId: reservation.id,
        type: "parking",
        title: reservation.parkingSlotTitle || activityText(t, "parkingReservedTitle", "Parking réservé"),
        description: activityText(t, "spaces", `${reservation.reservedSpaces || 1} place(s)`, { count: reservation.reservedSpaces || 1 }),
        status: reservation.status,
        start,
        end,
        dateKey: getDateKey(start),
        amount: reservation.totalPrice,
        to: "/my-reservations?tab=parking",
      };
    });

  return [...spaceItems, ...eventItems, ...parkingItems]
    .filter((item) => item.start && item.dateKey && !["CANCELLED", "REJECTED"].includes(String(item.status).toUpperCase()))
    .sort((a, b) => a.start - b.start);
}

export function buildUserNotifications(items, t) {
  const now = new Date();
  const todayKey = getDateKey(now);
  const upcoming = items.filter((item) => item.start >= now || item.dateKey === todayKey);

  const paymentPending = upcoming
    .filter((item) => item.type === "space" && String(item.status).toUpperCase() === "APPROVED" && Number(item.amount || 0) > 0)
    .map((item) => ({
      id: `payment-${item.id}`,
      tone: "warning",
      badge: true,
      title: activityText(t, "paymentPendingTitle", "Paiement en attente"),
      message: activityText(t, "paymentPendingText", `${item.title} attend une confirmation de paiement.`, { title: item.title }),
      date: item.start,
      to: item.to,
    }));

  const validatedSpaces = upcoming
    .filter((item) => item.type === "space" && ["CONFIRMED", "PAID"].includes(String(item.status).toUpperCase()) && isWithinDays(item.start, 7))
    .map((item) => ({
      id: `space-valid-${item.id}`,
      tone: "success",
      badge: isWithinHours(item.start, 48),
      title: activityText(t, "spaceConfirmedTitle", "Réservation validée"),
      message: activityText(t, "spaceConfirmedText", `${item.title} est confirmée.`, { title: item.title }),
      date: item.start,
      to: item.to,
    }));

  const upcomingEvents = upcoming
    .filter((item) => item.type === "event" && isWithinDays(item.start, 7))
    .map((item) => ({
      id: `event-soon-${item.id}`,
      tone: "info",
      badge: isWithinHours(item.start, 48),
      title: activityText(t, "eventUpcomingTitle", "Événement à venir"),
      message: item.title,
      date: item.start,
      to: item.to,
    }));

  const reservedParking = upcoming
    .filter((item) => item.type === "parking" && isWithinDays(item.start, 7))
    .map((item) => ({
      id: `parking-reserved-${item.id}`,
      tone: "success",
      badge: isWithinHours(item.start, 48),
      title: activityText(t, "parkingReservedTitle", "Parking réservé"),
      message: `${item.title} - ${item.description}`,
      date: item.start,
      to: item.to,
    }));

  return [...paymentPending, ...validatedSpaces, ...upcomingEvents, ...reservedParking]
    .sort((a, b) => a.date - b.date)
    .slice(0, 8);
}
