import { enforceResidential } from "./enforceResidential";

function normalizeAreaName(value: string | undefined | null) {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(neighborhood|district|area|region|city|township)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mergeAreas(core: any, detailsList: any[]) {
  const detailEntries = detailsList.map((detail, idx) => ({
    idx,
    normalized: normalizeAreaName(detail?.name),
    detail,
  }));
  const usedIndexes = new Set<number>();

  const pickDetailForArea = (areaName: string, fallbackIdx: number) => {
    const normalized = normalizeAreaName(areaName);
    if (normalized) {
      const match = detailEntries.find((entry) =>
        entry.normalized === normalized && !usedIndexes.has(entry.idx)
      );
      if (match) {
        usedIndexes.add(match.idx);
        return match.detail;
      }
    }

    const byIndex = detailEntries.find((entry) => entry.idx === fallbackIdx && !usedIndexes.has(entry.idx));
    if (byIndex) {
      usedIndexes.add(byIndex.idx);
      return byIndex.detail;
    }

    const firstUnused = detailEntries.find((entry) => !usedIndexes.has(entry.idx));
    if (firstUnused) {
      usedIndexes.add(firstUnused.idx);
      return firstUnused.detail;
    }

    return {};
  };

  return core.recommendedAreas.map((a: any, index: number) => {
    const detailForArea: any = pickDetailForArea(a?.name ?? "", index) || {};

    const area: any = { ...a };

    area.placesOfInterest = Array.isArray(area.placesOfInterest) ? area.placesOfInterest : [];
    area.lifestyleTags = Array.isArray(area.lifestyleTags) ? area.lifestyleTags : [];

    // Schools se maneja de forma explicita
    const schoolDetail = (detailForArea as any).schools || {};
    area.schools = schoolDetail.items ?? [];
    area.schoolsSummary = schoolDetail.summary ?? [];

    const categories = [
      "socialLife",
      "shopping",
      "greenSpaces",
      "sports",
      "transportation",
      "family",
      "restaurants",
      "pets",
      "hobbies",
      "properties",
    ];

    for (const cat of categories) {
      const detail = (detailForArea as any)[cat] || {};
      area[cat] = detail.items ?? [];
      area[`${cat}Summary`] = detail.summary ?? [];
    }

    enforceResidential(area);
    return area;
  });
}
