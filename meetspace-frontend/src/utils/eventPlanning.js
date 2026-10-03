export const isBlockingEvent = (event) => !["CANCELLED", "REJECTED"].includes(event.status);
export const canEditOrganizerEvent = (event) => ["PENDING_APPROVAL", "REJECTED"].includes(event?.status);
export const getResourceKey = (event) => String(event.spaceId || event.espaceId || event.location || event.externalAddress || "unknown").toLowerCase();

export function eventsConflict(event, other) {
  return event.id !== other.id && isBlockingEvent(event) && isBlockingEvent(other) &&
    getResourceKey(event) === getResourceKey(other) &&
    new Date(event.startDateTime) < new Date(other.endDateTime) &&
    new Date(other.startDateTime) < new Date(event.endDateTime);
}

export function eventDays(event) {
  const start = new Date(event.startDateTime);
  const end = new Date(event.endDateTime);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return [];
  const days = [];
  const day = new Date(start);
  day.setHours(0, 0, 0, 0);
  while (day < end) {
    days.push(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`);
    day.setDate(day.getDate() + 1);
  }
  return days;
}
