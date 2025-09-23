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



const LOOKUP_LIMITS: Record<ImageKind, number> = {

  school: 3,

  social: 3,

  shopping: 3,

  greens: 3,

  sports: 3,

  property: 12,

  area: 0,

  transport: 3,

  family: 3,

  restaurant: 3,

  pet: 2,

  hobby: 2,

};



// 👇 Nuevo: flag para desactivar verificación de imágenes (útil en dev)

const SKIP_IMAGE_VERIFY = (process.env.SKIP_IMAGE_VERIFY || "").toLowerCase() === "true";



export async function sanitizeImages(parsed: any) {

  const ensureAreaImage = async (area: any) => {

    const ensured = ensurePreferred(area?.imageUrl, "area");



    // 👇 si está el flag, evita red y usa ensured o fallback

    if (SKIP_IMAGE_VERIFY) {

      area.imageUrl = ensured || FALLBACKS.area;

      return;

    }



    if (ensured && ensured !== FALLBACKS.area) {

      area.imageUrl = ensured;

      return;

    }



    let looked: string | null = null;



    try {

      const q1 = [area?.name, area?.state].filter(Boolean).join(" ");

      if (q1) {

        looked = await fetchVerifiedImage(q1, {

          locationHint: [area?.name, area?.state].filter(Boolean).join(", "),

          mode: "area",

        });

      }



      if (!looked && area?.name) {

        looked = await fetchVerifiedImage(area.name, { locationHint: area?.state, mode: "area" });

      }

    } catch {

      looked = null;

    }



    area.imageUrl = looked || ensured || FALLBACKS.area;

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

    const used = new Set<string>();

    let lookupsRemaining = LOOKUP_LIMITS[type] ?? 0;



    const processUrl = async (item: any, orig?: string, photoIndex = 0) => {

      const ensured = ensurePreferred(orig, type);



      // 👇 si está el flag, no buscamos en red

      if (SKIP_IMAGE_VERIFY) {

        const finalUrl = ensured || FALLBACKS[type];

        return { finalUrl, lookedOk: false };

      }



      const name = getName(item) || "";

      const query = name.trim();

      const needsLookup =

        lookupsRemaining > 0 &&

        (!ensured || ensured === FALLBACKS[type]) &&

        !!query;



      let looked: string | null = null;



      if (needsLookup) {



        lookupsRemaining--;



        try {



          looked = await fetchVerifiedImage(query, {



            locationHint,



            includedType,



            photoIndex,



            mode: type === "property" ? "property" : "poi", // dY`^



          });



          if (!looked) {



            looked = await fetchVerifiedImage(query, {



              locationHint,



              photoIndex,



              mode: type === "property" ? "property" : "poi", // dY`^



            });



          }



        } catch {



          looked = null;



        }



        if (!looked && type === "property") {



          try {



            // fallback: drop strict property filters when Places cannot return a residential photo



            looked = await fetchVerifiedImage(query, {



              locationHint,



              photoIndex,



              mode: "poi",



            });



          } catch {



            looked = null;



          }



        }



      }



      if (type === "property" && looked && COMMERCIAL_HINTS.test(looked)) {

        looked = null;

      }



      let finalUrl = looked || ensured || FALLBACKS[type];



      if (used.has(finalUrl)) {

        const alt = ensured && ensured !== finalUrl ? ensured : FALLBACKS[type];

        finalUrl = used.has(alt) ? FALLBACKS[type] : alt;

      }

      used.add(finalUrl);



      return { finalUrl, lookedOk: !!looked };

    };



    // 👇 Cambiado: allSettled para que un fallo no rompa toda la lista

    const tasks = items.map(async (it) => {

      if (type === "property") {

        const current = Array.isArray(it.imageUrls) ? it.imageUrls.filter(Boolean) : [];

        const targetLen = Math.min(Math.max(current.length || 0, 3), 5);



        const originals = current.slice(0, targetLen);

        const sanitized: string[] = [];



        for (let i = 0; i < originals.length; i++) {

          const { finalUrl } = await processUrl(it, originals[i], i);

          sanitized.push(finalUrl);

        }



        while (sanitized.length < targetLen) {

          const { finalUrl } = await processUrl(it, undefined, sanitized.length);

          sanitized.push(finalUrl);

        }



        it.imageUrls = sanitized;

      } else {

        const seeds = Array.isArray(it.imageGallery)
          ? it.imageGallery.filter((url: any) => typeof url === "string" && url.trim())
          : [];
        const gallery: string[] = [];
        const seen = new Set<string>();

        const pushIfNew = (url?: string | null) => {
          if (!url) return;
          const trimmed = url.trim();
          if (!trimmed) return;
          if (seen.has(trimmed)) return;
          seen.add(trimmed);
          gallery.push(trimmed);
        };

        const initialSources = seeds.length
          ? seeds
          : (typeof it?.imageUrl === "string" && it.imageUrl.trim() ? [it.imageUrl] : []);

        for (let i = 0; i < initialSources.length && i < 3; i++) {
          const { finalUrl } = await processUrl(it, initialSources[i], i);
          pushIfNew(finalUrl);
        }

        let extraIndex = initialSources.length;
        while (gallery.length < 3 && extraIndex < initialSources.length + 3) {
          const { finalUrl } = await processUrl(it, undefined, extraIndex);
          pushIfNew(finalUrl);
          extraIndex += 1;
        }

        while (gallery.length < 3) {
          const fallback = FALLBACKS[type];
          gallery.push(fallback);
        }

        it.imageGallery = gallery.slice(0, 3);
        it.imageUrl = it.imageGallery[0] ?? FALLBACKS[type];

      }

    });



    await Promise.allSettled(tasks);

  };



  // 👇 Cambiado: allSettled para que un área fallida no detenga el resto

  const areaTasks = (parsed?.recommendedAreas ?? []).map(async (area: any) => {

    const aName = area?.name ?? "";

    const aState = area?.state ?? "";



    await ensureAreaImage(area);



    if (area?.imageUrl) {

      if (usedAreaImages.has(area.imageUrl)) {

        const alt = FALLBACKS.area;

        area.imageUrl = usedAreaImages.has(alt)

          ? ensurePreferred(area.imageUrl, "area")

          : alt;

      }

      usedAreaImages.add(area.imageUrl);

    }



    await handleList(area?.schools, "school", (s) => s?.name ?? "", aName, aState);

    await handleList(area?.socialLife, "social", (s) => s?.name ?? "", aName, aState);

    await handleList(area?.shopping, "shopping", (s) => s?.name ?? "", aName, aState);

    await handleList(area?.greenSpaces, "greens", (s) => s?.name ?? "", aName, aState);

    await handleList(area?.sports, "sports", (s) => s?.name ?? "", aName, aState);

    await handleList(area?.transportation, "transport", (t) => t?.name ?? "", aName, aState);

    await handleList(area?.family, "family", (f) => f?.name ?? "", aName, aState);

    await handleList(area?.restaurants, "restaurant", (r) => r?.name ?? "", aName, aState);

    await handleList(area?.pets, "pet", (p) => p?.name ?? "", aName, aState);

    await handleList(area?.hobbies, "hobby", (h) => h?.name ?? "", aName, aState);



    await handleList(area?.properties, "property", (p) => p?.address ?? aName, aName, aState);

  });



  await Promise.allSettled(areaTasks);



  return parsed;

}



export { FALLBACKS };

