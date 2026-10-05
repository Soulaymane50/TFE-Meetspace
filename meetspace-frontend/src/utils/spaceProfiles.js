export function getSpaceProfileKey(space) {
  const name = `${space?.name || ""}`.toLowerCase();
  const capacity = Number(space?.capacity) || 0;

  if (name.includes("orion")) return "orion";
  if (name.includes("executive") && capacity >= 250) return "executive";
  if (name.includes("auditorium") || name.includes("europe")) return "auditorium";
  if (name.includes("atlas")) return "atlas";
  if (name.includes("atelier") || name.includes("canal")) return "atelier";
  if (name.includes("horizon")) return "horizon";
  if (name.includes("studio") || name.includes("sablon")) return "studio";
  if (name.includes("conseil")) return "boardroom";
  return capacity >= 280 ? "executive" : capacity >= 180 ? "auditorium" : capacity >= 80 ? "atlas" : capacity >= 55 ? "atelier" : capacity >= 40 ? "horizon" : capacity >= 25 ? "studio" : "boardroom";
}
