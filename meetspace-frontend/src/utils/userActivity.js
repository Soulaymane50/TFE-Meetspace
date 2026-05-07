export function parseDateTime(dateValue, timeValue) {
  if (!dateValue) return null;
  const value = timeValue ? `${dateValue}T${String(timeValue).slice(0, 5)}` : dateValue;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getDateKey(date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDate(date, locale = "fr-BE", options = {}) {
  if (!date) return "";
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    ...options,
  }).format(date);
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

export function buildUserActivityItems({ spaces = [], events = [], parking = [] }) {
  const spaceItems = spaces
    .map((reservation) => {
      const start = parseDateTime(reservation.startDateTime);
      const end = parseDateTime(reservation.endDateTime);
      return {
        id: `space-${reservation.id}`,
        sourceId: reservation.id,
        type: "space",
        title: reservation.espace?.name || reservation.espaceName || "Salle réservée",
        description: reservation.justification || "Réservation de salle MeetSpace",
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
        title: registration.eventTitle || "Événement professionnel",
        description: `${registration.numberOfParticipants || 1} participant(s)`,
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
        title: reservation.parkingSlotTitle || "Parking réservé",
        description: `${reservation.reservedSpaces || 1} place(s)`,
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

export function buildUserNotifications(items) {
  const now = new Date();
  const todayKey = getDateKey(now);
  const upcoming = items.filter((item) => item.start >= now || item.dateKey === todayKey);

  const paymentPending = upcoming
    .filter((item) => item.type === "space" && String(item.status).toUpperCase() === "APPROVED" && Number(item.amount || 0) > 0)
    .map((item) => ({
      id: `payment-${item.id}`,
      tone: "warning",
      badge: true,
      title: "Paiement en attente",
      message: `${item.title} attend une confirmation de paiement.`,
      date: item.start,
      to: item.to,
    }));

  const validatedSpaces = upcoming
    .filter((item) => item.type === "space" && ["CONFIRMED", "PAID"].includes(String(item.status).toUpperCase()) && isWithinDays(item.start, 7))
    .map((item) => ({
      id: `space-valid-${item.id}`,
      tone: "success",
      badge: isWithinHours(item.start, 48),
      title: "Réservation validée",
      message: `${item.title} est confirmée.`,
      date: item.start,
      to: item.to,
    }));

  const upcomingEvents = upcoming
    .filter((item) => item.type === "event" && isWithinDays(item.start, 7))
    .map((item) => ({
      id: `event-soon-${item.id}`,
      tone: "info",
      badge: isWithinHours(item.start, 48),
      title: "Événement à venir",
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
      title: "Parking réservé",
      message: `${item.title} - ${item.description}`,
      date: item.start,
      to: item.to,
    }));

  return [...paymentPending, ...validatedSpaces, ...upcomingEvents, ...reservedParking]
    .sort((a, b) => a.date - b.date)
    .slice(0, 8);
}
