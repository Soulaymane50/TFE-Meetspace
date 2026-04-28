export const PARKING_IMAGE = "/images/parking-conference-center.webp";

export function getSpaceImage(space) {
  const capacity = Number(space?.capacity) || 0;
  const name = `${space?.name || ""}`.toLowerCase();

  if (name.includes("conseil")) {
    return "/images/room-conseil-executive-20.webp";
  }

  if (name.includes("orion")) {
    return "/images/room-premium-orion-500.webp";
  }

  if (name.includes("executive") && capacity >= 250) {
    return "/images/room-premium-executive-300.webp";
  }

  if (capacity >= 500) return "/images/room-premium-orion-500.webp";
  if (capacity >= 250) return "/images/room-premium-executive-300.webp";
  if (capacity >= 80) return "/images/room-atlas-100.webp";
  if (capacity >= 40) return "/images/room-horizon-50.webp";
  return "/images/room-conseil-executive-20.webp";
}

export function getEventImage(event) {
  const text = `${event?.title || ""} ${event?.description || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const location = `${event?.location || ""}`.toLowerCase();

  if (location.includes("orion")) return "/images/room-premium-orion-500.webp";
  if (location.includes("executive")) return "/images/room-premium-executive-300.webp";
  if (location.includes("atlas")) return "/images/room-atlas-100.webp";
  if (location.includes("horizon")) return "/images/room-horizon-50.webp";
  if (location.includes("conseil") || location.includes("alpha")) return "/images/room-conseil-executive-20.webp";

  if (["workshop", "atelier", "masterclass", "marketing", "cloud"].some((word) => text.includes(word))) {
    return "/images/room-horizon-50.webp";
  }

  if (["finance", "investissement", "meetup", "networking", "innovation"].some((word) => text.includes(word))) {
    return "/images/room-horizon-50.webp";
  }

  return "/images/room-atlas-100.webp";
}
