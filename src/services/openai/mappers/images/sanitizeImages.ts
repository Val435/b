import { fetchVerifiedImage } from "../../../imageLookupService";
import { COMMERCIAL_HINTS, ensurePreferred, FALLBACKS } from "../../constants";

type ImageKind = keyof typeof FALLBACKS;

const TYPE_HINTS: Record<ImageKind, string | undefined> = {
  school: "school",
  social: "bar",
  shopping: "shopping_mall",
  greens: "park",
  sports: "stadium",
  property: "premise", // sesgo a vivienda
  area: undefined,
};

export async function sanitizeImages(parsed: any) {
  const ensureAreaImage = async (area: any) => {
    const ensured = ensurePreferred(area.imageUrl, "area");
    let looked: string | null = null;
    try {
      looked = await fetchVerifiedImage(`${area.name} ${area.state}`, {
        locationHint: [area.name, area.state].filter(Boolean).join(", "),
      });
      if (!looked) {
        looked = await fetchVerifiedImage(area.name, { locationHint: area.state });
      }
    } catch { looked = null; }
    area.imageUrl = looked || ensured;
  };

  const usedAreaImages = new Set<string>();

  const handleList = async (
    items: any[] | undefined,
    type: ImageKind,
    getName: (x: any) => string,
    areaName: string,
    areaState: string
  ) => {
    if (!items) return;
    const locationHint = [areaName, areaState].filter(Boolean).join(", ");
    const includedType = TYPE_HINTS[type];
    const used = new Set<string>();

    await Promise.all(items.map(async (it) => {
      const processUrl = async (orig?: string, photoIndex = 0) => {
        const ensured = ensurePreferred(orig, type);
        let looked: string | null = null;
        try {
          looked = await fetchVerifiedImage(getName(it), { locationHint, includedType, photoIndex });
          if (!looked) looked = await fetchVerifiedImage(getName(it), { locationHint, photoIndex });
        } catch { looked = null; }

        // no fotos con pinta comercial para propiedades
        if (type === "property" && looked && COMMERCIAL_HINTS.test(looked)) looked = null;

        let finalUrl = looked || ensured;
        if (used.has(finalUrl)) {
          const alt = ensured !== finalUrl ? ensured : FALLBACKS[type];
          finalUrl = used.has(alt) ? FALLBACKS[type] : alt;
        }
        used.add(finalUrl);
        return { finalUrl, lookedOk: !!looked };
      };

      if (Array.isArray(it.imageUrls)) {
        const targetLen = Math.min(Math.max(it.imageUrls.length, 3), 5);
        const originals = it.imageUrls.slice(0, targetLen);
        const sanitized: string[] = [];
        for (let i = 0; i < originals.length; i++) {
          const { finalUrl } = await processUrl(originals[i], i);
          sanitized.push(finalUrl);
        }
        while (sanitized.length < targetLen) {
          const { finalUrl } = await processUrl(undefined, sanitized.length);
          sanitized.push(finalUrl);
        }
        it.imageUrls = sanitized;
      } else {
        const { finalUrl } = await processUrl(it.imageUrl);
        it.imageUrl = finalUrl;
      }
    }));
  };

  await Promise.all((parsed?.recommendedAreas ?? []).map(async (area: any) => {
    const aName = area?.name ?? "";
    const aState = area?.state ?? "";

    await ensureAreaImage(area);
    if (usedAreaImages.has(area.imageUrl)) {
      const alt = FALLBACKS.area;
      area.imageUrl = usedAreaImages.has(alt) ? ensurePreferred(area.imageUrl, "area") : alt;
    }
    usedAreaImages.add(area.imageUrl);

    await handleList(area?.schools,     "school",   (s) => s.name,    aName, aState);
    await handleList(area?.socialLife,  "social",   (s) => s.name,    aName, aState);
    await handleList(area?.shopping,    "shopping", (s) => s.name,    aName, aState);
    await handleList(area?.greenSpaces, "greens",   (s) => s.name,    aName, aState);
    await handleList(area?.sports,      "sports",   (s) => s.name,    aName, aState);
    await handleList(area?.properties,  "property", (p) => p.address, aName, aState);
  }));

  return parsed;
}

export { FALLBACKS }; // útil para prompts
