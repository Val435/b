import { fetchVerifiedImage } from "../../../imageLookupService";
import { ensurePreferred, FALLBACKS } from "../../constants";

/**
 * 🔴 FASE 1: SOLO imageUrl de las áreas (3 búsquedas)
 * - Busca la imagen principal de cada RecommendedArea
 * - TODO lo demás usa fallbacks sin imageGallery
 * - Total: ~10-20s para 3 áreas
 */
export async function sanitizeCriticalImages(parsed: any) {
  console.log('🔴 Phase 1: Only area main images (3 searches total)');
  
  if (!parsed?.recommendedAreas) return parsed;

  const usedAreaImages = new Set<string>();

  // 🔥 SOLO buscar imageUrl de las 3 áreas
  await Promise.allSettled(
    parsed.recommendedAreas.map(async (area: any, index: number) => {
      const areaName = area?.name ?? "";
      const areaState = area?.state ?? "";
      const locationHint = [areaName, areaState].filter(Boolean).join(", ");

      // 1️⃣ SOLO IMAGEN DEL ÁREA (imageUrl, sin gallery)
      try {
        console.log(`  [${index + 1}/3] 🔍 ${areaName}...`);
        const areaImage = await fetchVerifiedImage(
          `${areaName}, ${areaState}`,
          { locationHint, mode: "area", photoIndex: 0 }
        );
        
        area.imageUrl = areaImage || FALLBACKS.area;
        console.log(`  ${areaImage ? '✅' : '⚠️'} ${areaName}`);

        if (area?.imageUrl && usedAreaImages.has(area.imageUrl)) {
          area.imageUrl = FALLBACKS.area;
        }
        usedAreaImages.add(area.imageUrl);
      } catch (err) {
        console.error(`  ❌ ${areaName} failed`);
        area.imageUrl = FALLBACKS.area;
      }

      // 2️⃣ TODAS las categorías: SOLO FALLBACK (sin imageGallery aún)
      const categories = [
        { key: 'schools', fallback: 'school' },
        { key: 'socialLife', fallback: 'social' },
        { key: 'shopping', fallback: 'shopping' },
        { key: 'greenSpaces', fallback: 'greens' },
        { key: 'sports', fallback: 'sports' },
        { key: 'transportation', fallback: 'transport' },
        { key: 'family', fallback: 'family' },
        { key: 'restaurants', fallback: 'restaurant' },
        { key: 'pets', fallback: 'pet' },
        { key: 'hobbies', fallback: 'hobby' },
      ];

      for (const cat of categories) {
        const items = area[cat.key];
        if (!Array.isArray(items)) continue;

        for (const item of items) {
          const fallbackUrl = FALLBACKS[cat.fallback as keyof typeof FALLBACKS];
          item.imageUrl = fallbackUrl;
          // ❌ NO crear imageGallery aquí - se llenará en background
          item.imageGallery = [];
        }
      }

      // 3️⃣ TODAS las propiedades: SOLO FALLBACKS (sin múltiples URLs aún)
      if (Array.isArray(area.properties)) {
        for (const prop of area.properties) {
          // Solo 1 fallback por ahora
          prop.imageUrls = [FALLBACKS.property];
        }
      }
    })
  );

  console.log('✅ Phase 1 complete: 3 area images searched, rest using fallbacks');
  return parsed;
}