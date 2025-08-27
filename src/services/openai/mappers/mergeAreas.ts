import { enforceResidential } from "./enforceResidential";

export function mergeAreas(core: any, detailsList: any[]) {
  return core.recommendedAreas.map((a: any) => {
    const d = detailsList.find((x) => x.name === a.name);
    const area = {
      ...a,
      ...(d ?? {
        name: a.name,
        schools: [],
        socialLife: [],
        shopping: [],
        greenSpaces: [],
        sports: [],
        properties: [],
      }),
    };
    enforceResidential(area);
    return area;
  });
}
