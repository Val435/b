import { enforceResidential } from "./enforceResidential";

export function mergeAreas(core: any, detailsList: any[]) {
  return core.recommendedAreas.map((a: any) => {
    const d = detailsList.find((x) => x.name === a.name) || {};

    const categories = [
      "schools",
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

    const area: any = { ...a };

    for (const cat of categories) {
      const detail = (d as any)[cat] || {};
      area[cat] = detail.items ?? [];
      area[`${cat}Summary`] = detail.summary ?? "";
    }

    enforceResidential(area);
    return area;
  });
}
