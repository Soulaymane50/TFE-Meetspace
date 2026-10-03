export function isIgnoredCalendarBlock(block, id, type = "EVENT") {
  return id != null && block.blockType === type && String(block.id) === String(id);
}

export function isCalendarRangeAvailable({ startDateTime, endDateTime, year, month, blocks, ignoreBlockId, ignoreBlockType = "EVENT", earliestStart = Date.now() }) {
  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return false;
  if (start <= new Date(earliestStart) || end <= start) return false;
  if (start.getFullYear() !== year || start.getMonth() + 1 !== month) return false;
  if (start.toDateString() !== end.toDateString()) return false;
  if (start.getHours() < 7 || end.getHours() > 22 || (end.getHours() === 22 && (end.getMinutes() || end.getSeconds()))) return false;
  return !blocks.some((block) => {
    if (isIgnoredCalendarBlock(block, ignoreBlockId, ignoreBlockType)) return false;
    return new Date(block.startDateTime) < end && new Date(block.endDateTime) > start;
  });
}

export function localTimeAtHour(dateKey, hour) {
  const minutes = Math.round(hour * 60);
  return `${dateKey}T${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// Occupation physique de la journée, indépendante de la durée demandée.
export function getDayOccupancy(blocks, dateKey) {
  const opening = new Date(dateKey + "T07:00:00").getTime();
  const closing = new Date(dateKey + "T22:00:00").getTime();
  if (!Number.isFinite(opening)) return [];
  const occupied = blocks.map(block => ({
    start: Math.max(opening, new Date(block.start).getTime()),
    end: Math.min(closing, new Date(block.end).getTime()),
  })).filter(block => block.start < block.end).sort((a, b) => a.start - b.start);
  const merged = [];
  for (const block of occupied) {
    const last = merged.at(-1);
    if (last && block.start <= last.end) last.end = Math.max(last.end, block.end);
    else merged.push({ ...block });
  }
  const segments = [];
  let cursor = opening;
  for (const block of merged) {
    if (cursor < block.start) segments.push({ start: cursor, end: block.start, occupied: false });
    segments.push({ ...block, occupied: true });
    cursor = block.end;
  }
  if (cursor < closing) segments.push({ start: cursor, end: closing, occupied: false });
  return segments;
}
