const pad = (value) => String(value).padStart(2, "0");

// API dates without an offset describe the venue's clock, not the visitor's time zone.
export function parseVenueDate(value) {
  if (value instanceof Date || typeof value !== "string" || /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return new Date(value);
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
  if (!match) return new Date(NaN);
  const parts = match.slice(1).map(Number);
  const wall = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5] || 0);
  const valid = new Date(wall);
  if (valid.getUTCFullYear() !== parts[0] || valid.getUTCMonth() + 1 !== parts[1]
    || valid.getUTCDate() !== parts[2] || valid.getUTCHours() !== parts[3]
    || valid.getUTCMinutes() !== parts[4] || valid.getUTCSeconds() !== (parts[5] || 0)) return new Date(NaN);
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const clock = (timestamp) => {
    const p = Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(({ type, value }) => [type, value]));
    return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  };
  let instant = wall;
  for (let i = 0; i < 3; i++) instant += wall - clock(instant);
  const candidates = [instant - 3600000, instant, instant + 3600000].filter((candidate) => clock(candidate) === wall);
  // Reject missing spring hours; use the first occurrence of a repeated autumn hour.
  return new Date(candidates.length ? Math.min(...candidates) : NaN);
}

function toIcsDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "T",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
    "Z",
  ].join("");
}

function escapeIcs(value = "") {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function safeFilename(value = "meetspace") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "meetspace";
}

export function downloadCalendarEvent({ title, description, location, start, end, filename }) {
  const startDate = parseVenueDate(start);
  const endDate = parseVenueDate(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) return false;

  const uid = `meetspace-${startDate.getTime()}-${Math.random().toString(36).slice(2)}@meetspace.be`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MeetSpace//Reservation//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(startDate)}`,
    `DTEND:${toIcsDate(endDate)}`,
    `SUMMARY:${escapeIcs(title)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFilename(filename || title)}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}
