export const MEETSPACE_COMMISSION_RATE = 0.1;
export const MEETSPACE_TOTAL_PARKING_SPACES = 150;

export function calculateRoomPrice(basePrice, durationHours) {
  const rate = Number(basePrice) || 0;
  const hours = Number(durationHours) || 0;
  const discount = hours >= 8 ? 0.85 : hours >= 4 ? 0.92 : 1;
  return Math.round(rate * hours * discount * 100) / 100;
}

export function getRoomPackageLabel(durationHours) {
  const hours = Number(durationHours) || 0;
  if (hours >= 8) return "day";
  if (hours >= 4) return "halfDay";
  return "hourly";
}

export function getRoomParkingQuotaLimit(roomCapacity) {
  const capacity = Number(roomCapacity) || 0;
  if (capacity <= 0) return MEETSPACE_TOTAL_PARKING_SPACES;
  if (capacity <= 20) return Math.min(12, capacity);
  if (capacity <= 50) return 25;
  if (capacity <= 100) return 45;
  if (capacity <= 300) return 100;
  return MEETSPACE_TOTAL_PARKING_SPACES;
}

export function getParkingQuotaLimit(eventCapacity, roomCapacity) {
  const eventLimit = Number(eventCapacity) > 0 ? Number(eventCapacity) : Number.MAX_SAFE_INTEGER;
  return Math.min(eventLimit, getRoomParkingQuotaLimit(roomCapacity), MEETSPACE_TOTAL_PARKING_SPACES);
}

export function getRecommendedParkingQuota(eventCapacity, roomCapacity) {
  const capacity = Number(eventCapacity) || Number(roomCapacity) || 0;
  const quotaLimit = getParkingQuotaLimit(capacity, roomCapacity);
  if (!capacity || !Number.isFinite(quotaLimit)) return 0;
  return Math.min(quotaLimit, Math.max(6, Math.round(capacity * 0.3)));
}

export function getRecommendedParkingRate(durationHours, roomCapacity) {
  const duration = Number(durationHours) || 0;
  const capacity = Number(roomCapacity) || 0;
  if (duration >= 7 && capacity >= 300) return 15;
  if (duration >= 4 || capacity >= 300) return 12;
  return 8;
}

export function getRecommendedTicketPrice(roomCapacity) {
  const capacity = Number(roomCapacity) || 0;
  if (capacity >= 300) return 120;
  if (capacity >= 100) return 80;
  if (capacity >= 50) return 45;
  return 35;
}
