const pad = (value) => String(value).padStart(2, "0");
const overlaps = (start, end, block) => start < new Date(block.endDateTime) && new Date(block.startDateTime) < end;

export function validateCalendar(items) {
  if (!Array.isArray(items) || items.some((item) => !item ||
    !Number.isFinite(Date.parse(item.startDateTime)) || !Number.isFinite(Date.parse(item.endDateTime)) ||
    new Date(item.endDateTime) <= new Date(item.startDateTime))) {
    throw new Error("INVALID_CALENDAR");
  }
  return items;
}

export function getAvailability(dateKey, duration, items, now = new Date()) {
  const reservations = validateCalendar(items);
  const date = new Date(`${dateKey}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !Number.isFinite(date.getTime()) ||
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` !== dateKey ||
    !Number.isFinite(duration) || duration <= 0) throw new Error("INVALID_DATE");
  const free = (hour, length) => {
    const start = new Date(`${dateKey}T${pad(hour)}:00:00`);
    const end = new Date(start.getTime() + length * 3600000);
    return start >= now && !reservations.some((block) => overlaps(start, end, block));
  };
  let firstSlot = null;
  let availableHours = 0;
  for (let hour = 7; hour < 22; hour += 1) {
    if (free(hour, 1)) availableHours += 1;
    if (!firstSlot && hour + duration <= 22 && free(hour, duration)) firstSlot = `${pad(hour)}:00`;
  }
  const start = new Date(`${dateKey}T07:00:00`);
  const end = new Date(`${dateKey}T22:00:00`);
  return { firstSlot, available: Boolean(firstSlot), availableHours,
    dayBlocks: reservations.filter((block) => overlaps(start, end, block)).length };
}
