// Input order is kept; callers sort upcoming items and recent history before this step.
export function recentHistory(records, { getEnd, limit = 10, now = Date.now(), keep = () => false }) {
  const maximum = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 10;
  let past = 0;
  const visible = records.filter((record) => {
    const value = getEnd(record);
    const end = value == null || value === "" ? NaN : new Date(value).getTime();
    if (!Number.isFinite(end) || end > now || keep(record)) return true;
    return past++ < maximum;
  });
  return { visible, hiddenCount: records.length - visible.length };
}
