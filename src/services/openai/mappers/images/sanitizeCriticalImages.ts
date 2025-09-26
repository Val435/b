import { fetchVerifiedImage } from "../../../imageLookupService";
import { ensurePreferred, FALLBACKS } from "../../constants";

type ImageKind = keyof typeof FALLBACKS;

const TYPE_HINTS: Record<ImageKind, string | undefined> = {
  school: "school",
  social: "bar",
  shopping: "shopping_mall",
  greens: "park",
  sports: "stadium",
  property: "premise",
  area: undefined,
  transport: "transit_station",
  family: undefined,
  restaurant: "restaurant",
  pet: "pet_store",
  hobby: undefined,
};

/**
 * 🔴 FASE 1: Solo obtiene las imágenes que el usuario ve PRIMERO
 * - imageUrl de cada RecommendedArea (3 áreas)
 * - Primera imagen de cada categoría principal
 */
export async function sanitizeCriticalImages(parsed: any) {
  console.log('🔴 Phase 1: Critical images only (fast)');
  
  if (!parsed?.recommendedAreas) return parsed;

  const usedAreaImages = new Set<string>();

  // Procesar áreas en paralelo (pero solo imágenes críticas)
  await Promise.allSettled(
    parsed.recommendedAreas.map(async (area: any) => {
      const areaName = area?.name ?? "";
      const areaState = area?.state ?? "";
      const locationHint = [areaName, areaState].filter(Boolean).join(", ");

      // 1️⃣ IMAGEN DEL ÁREA (la más importante)
      try {
        const ensured = ensurePreferred(area?.imageUrl, "area");
        
        if (!ensured || ensured === FALLBACKS.area) {
          console.log(`  🔍 Area: ${areaName}`);
          const areaImage = await fetchVerifiedImage(
            `${areaName}, ${areaState}`,
            { locationHint, mode: "area" }
          );
          
          area.imageUrl = areaImage || ensured || FALLBACKS.area;
          console.log(`  ${areaImage ? '✅' : '⚠️'} ${areaName}`);
        } else {
          area.imageUrl = ensured;
        }

        if (area?.imageUrl) {
          if (usedAreaImages.has(area.imageUrl)) {
            area.imageUrl = FALLBACKS.area;
          }
          usedAreaImages.add(area.imageUrl);
        }
      } catch (err) {
        console.error(`  ❌ Area image failed: ${areaName}`);
        area.imageUrl = FALLBACKS.area;
      }

      // 2️⃣ PRIMERA IMAGEN de cada categoría (solo imageUrl, no gallery)
      const categories = [
        { key: 'schools', fallback: 'school', type: 'school' },
        { key: 'socialLife', fallback: 'social', type: 'bar' },
        { key: 'shopping', fallback: 'shopping', type: 'shopping_mall' },
        { key: 'greenSpaces', fallback: 'greens', type: 'park' },
        { key: 'sports', fallback: 'sports', type: 'stadium' },
        { key: 'transportation', fallback: 'transport', type: 'transit_station' },
        { key: 'family', fallback: 'family', type: undefined },
        { key: 'restaurants', fallback: 'restaurant', type: 'restaurant' },
        { key: 'pets', fallback: 'pet', type: 'pet_store' },
        { key: 'hobbies', fallback: 'hobby', type: undefined },
      ];

      for (const cat of categories) {
        const items = area[cat.key];
        if (!Array.isArray(items) || items.length === 0) continue;

        // Solo procesar el PRIMER item de cada categoría
        const firstItem = items[0];
        try {
          const ensured = ensurePreferred(
            firstItem?.imageUrl, 
            cat.fallback as keyof typeof FALLBACKS
          );
          
          if (!ensured || ensured === FALLBACKS[cat.fallback as keyof typeof FALLBACKS]) {
            const image = await fetchVerifiedImage(
              firstItem.name,
              {
                locationHint,
                includedType: cat.type,
                photoIndex: 0,
                mode: "poi"
              }
            );
            
            firstItem.imageUrl = image || ensured || FALLBACKS[cat.fallback as keyof typeof FALLBACKS];
            firstItem.imageGallery = [firstItem.imageUrl];
          } else {
            firstItem.imageUrl = ensured;
            firstItem.imageGallery = [ensured];
          }
        } catch (err) {
          firstItem.imageUrl = FALLBACKS[cat.fallback as keyof typeof FALLBACKS];
          firstItem.imageGallery = [firstItem.imageUrl];
        }

        // El resto de items: solo fallbacks por ahora
        for (let i = 1; i < items.length; i++) {
          items[i].imageUrl = FALLBACKS[cat.fallback as keyof typeof FALLBACKS];
          items[i].imageGallery = [items[i].imageUrl];
        }
      }

      // 3️⃣ PROPIEDADES: solo primera imagen de las primeras 3
      if (Array.isArray(area.properties)) {
        for (let i = 0; i < Math.min(3, area.properties.length); i++) {
          const prop = area.properties[i];
          try {
            const image = await fetchVerifiedImage(
              prop.address || areaName,
              {
                locationHint,
                photoIndex: 0,
                mode: "property"
              }
            );
            
            prop.imageUrls = image 
              ? [image, FALLBACKS.property, FALLBACKS.property]
              : [FALLBACKS.property, FALLBACKS.property, FALLBACKS.property];
          } catch (err) {
            prop.imageUrls = [FALLBACKS.property, FALLBACKS.property, FALLBACKS.property];
          }
        }

        // Resto de propiedades: solo fallbacks
        for (let i = 3; i < area.properties.length; i++) {
          area.properties[i].imageUrls = [FALLBACKS.property, FALLBACKS.property, FALLBACKS.property];
        }
      }
    })
  );

  console.log('✅ Critical images fetched');
  return parsed;
}