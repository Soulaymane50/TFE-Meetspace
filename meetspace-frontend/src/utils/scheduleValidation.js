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
