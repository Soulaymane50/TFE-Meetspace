export const PARKING_IMAGE = "/images/parking-conference-center-v6.webp";

export function getSpaceImage(space) {
  const capacity = Number(space?.capacity) || 0;
  const name = `${space?.name || ""}`.toLowerCase();

  if (name.includes("conseil")) {
    return "/images/room-conseil-executive-20-v5.webp";
  }

  if (name.includes("orion")) {
    return "/images/room-premium-orion-500-v5.webp";
  }

  if (name.includes("executive") && capacity >= 250) {
    return "/images/room-premium-executive-300-v5.webp";
  }

  if (name.includes("auditorium") || name.includes("europe")) {
    return "/images/room-auditorium-europe-220-v6.webp";
  }

  if (name.includes("atlas")) {
    return "/images/room-atlas-100-v5.webp";
  }

  if (name.includes("atelier") || name.includes("canal")) {
    return "/images/room-atelier-canal-60-v5.webp";
  }

  if (name.includes("horizon")) {
    return "/images/room-horizon-50-v5.webp";
  }

  if (name.includes("studio") || name.includes("sablon")) {
    return "/images/room-studio-sablon-30-v5.webp";
  }

  if (capacity >= 500) return "/images/room-premium-orion-500-v5.webp";
  if (capacity >= 280) return "/images/room-premium-executive-300-v5.webp";
  if (capacity >= 180) return "/images/room-auditorium-europe-220-v6.webp";
  if (capacity >= 80) return "/images/room-atlas-100-v5.webp";
  if (capacity >= 55) return "/images/room-atelier-canal-60-v5.webp";
  if (capacity >= 40) return "/images/room-horizon-50-v5.webp";
  if (capacity >= 25) return "/images/room-studio-sablon-30-v5.webp";
  return "/images/room-conseil-executive-20-v5.webp";
}

export function getEventImage(event) {
  const text = `${event?.title || ""} ${event?.description || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const location = `${event?.location || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (location.includes("orion")) return "/images/room-premium-orion-500-v5.webp";
  if (location.includes("executive")) return "/images/room-premium-executive-300-v5.webp";
  if (location.includes("auditorium") || location.includes("europe")) return "/images/room-auditorium-europe-220-v6.webp";
  if (location.includes("atlas")) return "/images/room-atlas-100-v5.webp";
  if (location.includes("atelier") || location.includes("canal")) return "/images/room-atelier-canal-60-v5.webp";
  if (location.includes("horizon")) return "/images/room-horizon-50-v5.webp";
  if (location.includes("studio") || location.includes("sablon")) return "/images/room-studio-sablon-30-v5.webp";
  if (location.includes("conseil") || location.includes("alpha")) return "/images/room-conseil-executive-20-v5.webp";

  if (["workshop", "atelier", "masterclass", "marketing", "cloud"].some((word) => text.includes(word))) {
    return "/images/room-horizon-50-v5.webp";
  }

  if (["finance", "investissement", "meetup", "networking", "innovation"].some((word) => text.includes(word))) {
    return "/images/room-horizon-50-v5.webp";
  }

  return "/images/room-atlas-100-v5.webp";
}
