import { COMMERCIAL_HINTS, FALLBACKS } from "../constants";
import { isResidentialType } from "../schemas";

export function enforceResidential(area: any) {
  if (!Array.isArray(area?.properties)) return;
  const before = area.properties.length;

  area.properties = area.properties.filter((p: any) => {
    const t = String(p?.details?.type ?? "");
    const blob = [p?.address, p?.description, p?.fullDescription].join(" ");
    return isResidentialType(t) && !COMMERCIAL_HINTS.test(blob);
  });

  const removed = before - area.properties.length;
  if (removed > 0) console.log(`[filter] ${area.name}: removed ${removed} commercial-looking properties`);

  while (area.properties.length < 3) {
    area.properties.push({
      address: `${area.name}, ${area.state}`,
      price: "$0",
      description: "Residential placeholder entry.",
      fullDescription: "Placeholder residential card to meet minimum count. Replace on refresh.",
      imageUrls: [FALLBACKS.property, FALLBACKS.property, FALLBACKS.property],
      details: {
        type: "single_family",
        builtYear: 2000,
        lotSizeSqFt: 0,
        parkingSpaces: 0,
        inUnitLaundry: true,
        district: `${area.name}`,
      },
    });
  }
}
