import { fetchVerifiedImage } from "../services/imageLookupService";


export const FALLBACKS = {
  school:   "https://cdn.pixabay.com/photo/2016/11/21/16/36/school-1844439_1280.jpg",
  social:   "https://cdn.pixabay.com/photo/2016/11/29/12/35/club-1867421_1280.jpg",
  shopping: "https://cdn.pixabay.com/photo/2016/10/30/05/26/mall-1786475_1280.jpg",
  greens:   "https://cdn.pixabay.com/photo/2016/07/27/05/19/park-1544552_1280.jpg",
  sports:   "https://cdn.pixabay.com/photo/2016/11/29/09/08/sport-1867161_1280.jpg",
  property: "https://cdn.pixabay.com/photo/2016/08/26/15/06/house-1622401_1280.jpg",
  area:     "https://cdn.pixabay.com/photo/2016/11/29/04/28/architecture-1868667_1280.jpg",
};

export type ImageKind = keyof typeof FALLBACKS;

const ensurePreferred = (url: string | undefined, type: ImageKind): string => {
  if (!url) return FALLBACKS[type];
  const u = url.trim();
  const isDirectFile = /^https:\/\/\S\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(u);
  const isUnsplashRaw = /^https:\/\/images\.unsplash\.com\/.*[?&]fm=(jpg|jpeg|png|webp)\b/i.test(u);
  const isGooglePhotos = /^https:\/\/lh3\.googleusercontent\.com\/./i.test(u);
  if (isDirectFile || isUnsplashRaw || isGooglePhotos) return u;
  return FALLBACKS[type];
};

export const ensureAreaImage = async (area: any) => {
  const ensured = ensurePreferred(area.imageUrl, "area");
  let looked: string | null = null;
  try {
    looked = await fetchVerifiedImage(`${area.name} ${area.state}`, {
      locationHint: [area.name, area.state].filter(Boolean).join(", "),
    });

    if (!looked) {
      looked = await fetchVerifiedImage(area.name, {
        locationHint: area.state,
      });
    }
  } catch {
    looked = null;
  }
  area.imageUrl = looked || ensured;
  console.log(
    "🖼 area ·",
    area.name,
    "->",
    looked ? "GOOGLE OK" : "FALLBACK",
    area.imageUrl
  );
};

const TYPE_HINTS: Record<ImageKind, string | undefined> = {
  school: "school",
  social: "bar",
  shopping: "shopping_mall",
  greens: "park",
  sports: "stadium",
  property: undefined,
  area: undefined,
};

export const processUrl = async (
  orig: string | undefined,
  type: ImageKind,
  getName: () => string,
  locationHint: string,
  includedType: string | undefined,
  used: Set<string>,
  photoIndex = 0
) => {
  const ensured = ensurePreferred(orig, type);
  let looked: string | null = null;
  try {
    looked = await fetchVerifiedImage(getName(), {
      locationHint,
      includedType,
      photoIndex,
    });
    if (!looked) {
      looked = await fetchVerifiedImage(getName(), { locationHint, photoIndex });
    }
  } catch {
    looked = null;
  }
  let finalUrl = looked || ensured;
  if (used.has(finalUrl)) {
    const alt = ensured !== finalUrl ? ensured : FALLBACKS[type];
    finalUrl = used.has(alt) ? FALLBACKS[type] : alt;
  }
  used.add(finalUrl);
  return { finalUrl, lookedOk: !!looked };
};

export const handleList = async (
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
  await Promise.all(
    items.map(async (it) => {
      if (Array.isArray(it.imageUrls)) {
        const targetLen = Math.min(Math.max(it.imageUrls.length, 3), 5);
        const originals = it.imageUrls.slice(0, targetLen);
        const sanitized: string[] = [];
        for (let i = 0; i < originals.length; i) {
          const { finalUrl, lookedOk } = await processUrl(
            originals[i],
            type,
            () => getName(it),
            locationHint,
            includedType,
            used,
            i
          );
          sanitized.push(finalUrl);
          console.log(
            "🖼",
            type,
            `[${i}] ·`,
            getName(it),
            "->",
            lookedOk ? "GOOGLE OK" : "FALLBACK",
            finalUrl
          );
        }
        while (sanitized.length < targetLen) {
          const idx = sanitized.length;
          const { finalUrl, lookedOk } = await processUrl(
            undefined,
            type,
            () => getName(it),
            locationHint,
            includedType,
            used,
            idx
          );
          sanitized.push(finalUrl);
          console.log(
            "🖼",
            type,
            `[${idx}] ·`,
            getName(it),
            "->",
            lookedOk ? "GOOGLE OK" : "FALLBACK",
            finalUrl
          );
        }
        it.imageUrls = sanitized;
      } else {
        const { finalUrl, lookedOk } = await processUrl(
          it.imageUrl,
          type,
          () => getName(it),
          locationHint,
          includedType,
          used
        );
        it.imageUrl = finalUrl;
        console.log(
          "🖼",
          type,
          "·",
          getName(it),
          "->",
          lookedOk ? "GOOGLE OK" : "FALLBACK",
          finalUrl
        );
      }
    })
  );
};

export const sanitizeImages = async (parsed: any) => {
  const usedAreaImages = new Set<string>();
  await Promise.all(
    (parsed?.recommendedAreas ?? []).map(async (area: any) => {
      const aName = area?.name ?? "";
      const aState = area?.state ?? "";

      await ensureAreaImage(area);

      if (usedAreaImages.has(area.imageUrl)) {
        const alt = FALLBACKS.area;
        area.imageUrl = usedAreaImages.has(alt)
          ? ensurePreferred(area.imageUrl, "area")
          : alt;
      }
      usedAreaImages.add(area.imageUrl);

      await handleList(area?.schools, "school", (s) => s.name, aName, aState);
      await handleList(area?.socialLife, "social", (s) => s.name, aName, aState);
      await handleList(area?.shopping, "shopping", (s) => s.name, aName, aState);
      await handleList(area?.greenSpaces, "greens", (s) => s.name, aName, aState);
      await handleList(area?.sports, "sports", (s) => s.name, aName, aState);
      await handleList(area?.properties, "property", (p) => p.address, aName, aState);
    })
  );
  return parsed;
};

 
