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
  transport: "transit_station",
  family: undefined,
  restaurant: "restaurant",
  pet: "pet_store",
  hobby: undefined,
};

export async function sanitizeImages(parsed: any) {
  const ensureAreaImage = async (area: any) => {
    const ensured = ensurePreferred(area?.imageUrl, "area");
    let looked: string | null = null;

    try {
      const q1 = [area?.name, area?.state].filter(Boolean).join(" ");
      looked = await fetchVerifiedImage(q1, {
        locationHint: [area?.name, area?.state].filter(Boolean).join(", "),
      });

      if (!looked && area?.name) {
        looked = await fetchVerifiedImage(area.name, { locationHint: area?.state });
      }
    } catch {
      looked = null;
    }

    area.imageUrl = looked || ensured;
  };

  const usedAreaImages = new Set<string>();

  const handleList = async (
    category: any[] | { items?: any[] } | undefined,
    type: ImageKind,
    getName: (x: any) => string,
    areaName: string,
    areaState: string
  ) => {
    const items = Array.isArray(category) ? category : category?.items;
    if (!Array.isArray(items) || !items.length) return;

    const locationHint = [areaName, areaState].filter(Boolean).join(", ");
    const includedType = TYPE_HINTS[type];
    const used = new Set<string>(); // dedupe dentro de la lista

    await Promise.all(
      items.map(async (it) => {
        const processUrl = async (orig?: string, photoIndex = 0) => {
          const ensured = ensurePreferred(orig, type);
          let looked: string | null = null;

          try {
            // 1er intento con includedType (si aplica)
            looked = await fetchVerifiedImage(getName(it), {
              locationHint,
              includedType,
              photoIndex,
            });

            // 2do intento sin includedType
            if (!looked) {
              looked = await fetchVerifiedImage(getName(it), {
                locationHint,
                photoIndex,
              });
            }
          } catch {
            looked = null;
          }

          // Evitar “pinta comercial” para propiedades (heurístico)
          if (type === "property" && looked && COMMERCIAL_HINTS.test(looked)) {
            looked = null;
          }

          let finalUrl = looked || ensured || FALLBACKS[type];

          // Dedupe dentro de la lista
          if (used.has(finalUrl)) {
            const alt = ensured && ensured !== finalUrl ? ensured : FALLBACKS[type];
            finalUrl = used.has(alt) ? FALLBACKS[type] : alt;
          }
          used.add(finalUrl);

          return { finalUrl, lookedOk: !!looked };
        };

        // Para propiedades: array de imageUrls → asegurar [3..5]
        if (type === "property") {
          const current = Array.isArray(it.imageUrls) ? it.imageUrls.filter(Boolean) : [];
          const targetLen = Math.min(Math.max(current.length || 0, 3), 5);

          const originals = current.slice(0, targetLen);
          const sanitized: string[] = [];

          // Normaliza las que ya venían
          for (let i = 0; i < originals.length; i++) {
            const { finalUrl } = await processUrl(originals[i], i);
            sanitized.push(finalUrl);
          }

          // Rellena hasta targetLen
          while (sanitized.length < targetLen) {
            const { finalUrl } = await processUrl(undefined, sanitized.length);
            sanitized.push(finalUrl);
          }

          it.imageUrls = sanitized;
        } else {
          // Para las demás entidades (school/social/shopping/greens/sports):
          // usar imageUrl simple
          const { finalUrl } = await processUrl(it?.imageUrl);
          it.imageUrl = finalUrl;
        }
      })
    );
  };

  // Procesa áreas
  await Promise.all(
    (parsed?.recommendedAreas ?? []).map(async (area: any) => {
      const aName = area?.name ?? "";
      const aState = area?.state ?? "";

      await ensureAreaImage(area);

      // Dedupe entre áreas
      if (area?.imageUrl) {
        if (usedAreaImages.has(area.imageUrl)) {
          const alt = FALLBACKS.area;
          area.imageUrl = usedAreaImages.has(alt) ? ensurePreferred(area.imageUrl, "area") : alt;
        }
        usedAreaImages.add(area.imageUrl);
      }

      // Listas por tipo
      await handleList(area?.schools?.items, "school", (s) => s?.name ?? "", aName, aState);
      await handleList(area?.socialLife?.items, "social", (s) => s?.name ?? "", aName, aState);
      await handleList(area?.shopping?.items, "shopping", (s) => s?.name ?? "", aName, aState);
      await handleList(area?.greenSpaces?.items, "greens", (s) => s?.name ?? "", aName, aState);
      await handleList(area?.sports?.items, "sports", (s) => s?.name ?? "", aName, aState);
      await handleList(area?.transportation?.items, "transport", (t) => t?.name ?? "", aName, aState);
      await handleList(area?.family?.items, "family", (f) => f?.name ?? "", aName, aState);
      await handleList(area?.restaurants?.items, "restaurant", (r) => r?.name ?? "", aName, aState);
      await handleList(area?.pets?.items, "pet", (p) => p?.name ?? "", aName, aState);
      await handleList(area?.hobbies?.items, "hobby", (h) => h?.name ?? "", aName, aState);

      // Propiedades: asegurar 3..5 imágenes
      await handleList(area?.properties?.items, "property", (p) => p?.address ?? aName, aName, aState);
    })
  );

  return parsed;
}

export { FALLBACKS };
