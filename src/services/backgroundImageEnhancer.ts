// src/services/backgroundImageEnhancer.ts
import prisma from "../config/prisma";
import { fetchVerifiedImage } from "./imageLookupService";
import { FALLBACKS } from "./openai/constants";

const MAX_IMAGES_PER_ITEM = 4;
const DELAY_BETWEEN_REQUESTS = 300;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function enhanceImagesInBackground(
  recommendationId: number,
  userId: number
) {
  const startTime = Date.now();
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🚀 [BACKGROUND] Starting image enhancement`);
  console.log(`   Recommendation ID: ${recommendationId}`);
  console.log(`   User ID: ${userId}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  try {
    const recommendation = await prisma.recommendation.findUnique({
      where: { id: recommendationId },
      include: {
        areas: {
          include: {
            schools: true,
            socialLife: true,
            shopping: true,
            greenSpaces: true,
            sports: true,
            transportation: true,
            family: true,
            restaurants: true,
            pets: true,
            hobbies: true,
            properties: true
          }
        }
      }
    });

    if (!recommendation) {
      console.error('❌ [BACKGROUND] Recommendation not found');
      return;
    }

    console.log(`📦 [BACKGROUND] Found ${recommendation.areas.length} areas to enhance\n`);

    // 🟡 FASE 2: Primeros items
    const phase2Start = Date.now();
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🟡 [PHASE 2] Enhancing first items of each category...`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    await enhanceVisibleGalleries(recommendation);
    
    const phase2Duration = ((Date.now() - phase2Start) / 1000).toFixed(1);
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ [PHASE 2] COMPLETED in ${phase2Duration}s`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // 🟢 FASE 3: Items restantes
    const phase3Start = Date.now();
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🟢 [PHASE 3] Enhancing remaining items...`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    await enhanceRemainingImages(recommendation);
    
    const phase3Duration = ((Date.now() - phase3Start) / 1000).toFixed(1);
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ [PHASE 3] COMPLETED in ${phase3Duration}s`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const totalDuration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🎉 [BACKGROUND] ALL PHASES COMPLETED!`);
    console.log(`   ⏱️  Total time: ${totalDuration} minutes`);
    console.log(`   ✓ Phase 2: ${phase2Duration}s`);
    console.log(`   ✓ Phase 3: ${phase3Duration}s`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
  } catch (err) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ [BACKGROUND] Enhancement failed:', err);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }
}

// 🟡 FASE 2: Solo primeros items
async function enhanceVisibleGalleries(recommendation: any) {
  let totalUpdated = 0;
  let totalFailed = 0;

  for (const area of recommendation.areas) {
    console.log(`🌆 [PHASE 2] Processing: ${area.name}`);
    
    const categories = [
      { items: area.schools, model: prisma.school, type: "school", name: "schools" },
      { items: area.socialLife, model: prisma.socialLife, type: "bar", name: "socialLife" },
      { items: area.shopping, model: prisma.shopping, type: "shopping_mall", name: "shopping" },
      { items: area.greenSpaces, model: prisma.greenSpace, type: "park", name: "greenSpaces" },
      { items: area.sports, model: prisma.sport, type: "stadium", name: "sports" },
      { items: area.transportation, model: prisma.transportation, type: "transit_station", name: "transportation" },
      { items: area.family, model: prisma.family, type: undefined, name: "family" },
      { items: area.restaurants, model: prisma.restaurant, type: "restaurant", name: "restaurants" },
      { items: area.pets, model: prisma.pet, type: "pet_store", name: "pets" },
      { items: area.hobbies, model: prisma.hobby, type: undefined, name: "hobbies" }
    ];

    // Solo PRIMER item de cada categoría
    for (const cat of categories) {
      if (cat.items.length === 0) continue;

      const firstItem = cat.items[0];
      const result = await completeItemGallery(
        cat.model,
        firstItem,
        area.name,
        area.state,
        cat.type,
        cat.name
      );
      
      if (result.success) {
        totalUpdated++;
        console.log(`   ✅ ${cat.name}: ${firstItem.name} (${result.imagesCount} images)`);
      } else {
        totalFailed++;
        console.log(`   ⚠️ ${cat.name}: ${firstItem.name} - Failed`);
      }
    }

    // Solo PRIMERAS 3 propiedades
    console.log(`   🏠 Processing first 3 properties...`);
    for (let i = 0; i < Math.min(3, area.properties.length); i++) {
      const result = await completePropertyGallery(area.properties[i], area.name, area.state, i + 1);
      if (result.success) {
        totalUpdated++;
        console.log(`   ✅ Property ${i + 1}: ${result.imagesCount} images`);
      } else {
        totalFailed++;
        console.log(`   ⚠️ Property ${i + 1}: Failed`);
      }
    }
    
    console.log('');
  }

  console.log(`📊 [PHASE 2] Summary: ${totalUpdated} updated, ${totalFailed} failed`);
}

// 🟢 FASE 3: Items restantes (2+)
async function enhanceRemainingImages(recommendation: any) {
  let totalUpdated = 0;
  let totalFailed = 0;

  for (const area of recommendation.areas) {
    console.log(`🌆 [PHASE 3] Processing: ${area.name}`);
    
    const categories = [
      { items: area.schools, model: prisma.school, type: "school", name: "schools" },
      { items: area.socialLife, model: prisma.socialLife, type: "bar", name: "socialLife" },
      { items: area.shopping, model: prisma.shopping, type: "shopping_mall", name: "shopping" },
      { items: area.greenSpaces, model: prisma.greenSpace, type: "park", name: "greenSpaces" },
      { items: area.sports, model: prisma.sport, type: "stadium", name: "sports" },
      { items: area.transportation, model: prisma.transportation, type: "transit_station", name: "transportation" },
      { items: area.family, model: prisma.family, type: undefined, name: "family" },
      { items: area.restaurants, model: prisma.restaurant, type: "restaurant", name: "restaurants" },
      { items: area.pets, model: prisma.pet, type: "pet_store", name: "pets" },
      { items: area.hobbies, model: prisma.hobby, type: undefined, name: "hobbies" }
    ];

    // Items 2, 3, 4... (omitir el primero)
    for (const cat of categories) {
      if (cat.items.length <= 1) continue;
      
      console.log(`   📸 ${cat.name}: Processing items 2-${cat.items.length}...`);
      for (let i = 1; i < cat.items.length; i++) {
        const result = await completeItemGallery(
          cat.model,
          cat.items[i],
          area.name,
          area.state,
          cat.type,
          cat.name
        );
        
        if (result.success) {
          totalUpdated++;
          console.log(`      ✅ Item ${i + 1}: ${cat.items[i].name} (${result.imagesCount} images)`);
        } else {
          totalFailed++;
        }
      }
    }

    // Propiedades 4, 5, 6...
    if (area.properties.length > 3) {
      console.log(`   🏠 Processing properties 4-${area.properties.length}...`);
      for (let i = 3; i < area.properties.length; i++) {
        const result = await completePropertyGallery(area.properties[i], area.name, area.state, i + 1);
        if (result.success) {
          totalUpdated++;
          console.log(`      ✅ Property ${i + 1}: ${result.imagesCount} images`);
        } else {
          totalFailed++;
        }
      }
    }
    
    console.log('');
  }

  console.log(`📊 [PHASE 3] Summary: ${totalUpdated} updated, ${totalFailed} failed`);
}

async function completeItemGallery(
  model: any,
  item: any,
  areaName: string,
  areaState: string,
  includedType?: string,
  categoryName?: string
): Promise<{ success: boolean; imagesCount: number }> {
  try {
    const locationHint = [areaName, areaState].filter(Boolean).join(", ");
    
    // ✅ Obtener gallery actual (puede estar vacío desde Fase 1)
    const currentGallery = Array.isArray(item.imageGallery) && item.imageGallery.length > 0
      ? item.imageGallery
      : [item.imageUrl]; // Si está vacío, empezar con imageUrl
    
    const gallery: string[] = [...currentGallery].filter(Boolean);

    // Completar hasta MAX_IMAGES_PER_ITEM
    for (let photoIndex = gallery.length; photoIndex < MAX_IMAGES_PER_ITEM; photoIndex++) {
      try {
        const imageUrl = await fetchVerifiedImage(item.name, {
          locationHint,
          includedType,
          photoIndex,
          mode: "poi"
        });

        if (imageUrl && !gallery.includes(imageUrl)) {
          gallery.push(imageUrl);
        }

        await delay(DELAY_BETWEEN_REQUESTS);
      } catch (err) {
        // Continue
      }
    }

    // Solo actualizar si conseguimos nuevas imágenes
    if (gallery.length > currentGallery.length) {
      await model.update({
        where: { id: item.id },
        data: {
          imageUrl: gallery[0],
          imageGallery: gallery.slice(0, MAX_IMAGES_PER_ITEM)
        }
      });
      
      return { success: true, imagesCount: gallery.length };
    }
    
    return { success: false, imagesCount: currentGallery.length };
  } catch (err) {
    console.error(`      ⚠️ Error completing gallery for ${item.name}:`, err);
    return { success: false, imagesCount: 0 };
  }
}

async function completePropertyGallery(
  property: any,
  areaName: string,
  areaState: string,
  propertyNumber: number
): Promise<{ success: boolean; imagesCount: number }> {
  try {
    const locationHint = [areaName, areaState].filter(Boolean).join(", ");
    
    // ✅ Obtener URLs actuales (puede ser solo 1 fallback desde Fase 1)
    const currentUrls = Array.isArray(property.imageUrls) ? property.imageUrls : [];
    const imageUrls: string[] = [...currentUrls];

    // Completar hasta 5 imágenes
    for (let photoIndex = imageUrls.length; photoIndex < 5; photoIndex++) {
      try {
        const imageUrl = await fetchVerifiedImage(property.address || areaName, {
          locationHint,
          photoIndex,
          mode: "property"
        });

        if (imageUrl && !imageUrls.includes(imageUrl)) {
          imageUrls.push(imageUrl);
        }

        await delay(DELAY_BETWEEN_REQUESTS);
      } catch (err) {
        // Continue
      }
    }

    // Solo actualizar si conseguimos nuevas imágenes
    if (imageUrls.length > currentUrls.length) {
      await prisma.property.update({
        where: { id: property.id },
        data: { imageUrls: imageUrls.slice(0, 5) }
      });
      
      return { success: true, imagesCount: imageUrls.length };
    }
    
    return { success: false, imagesCount: currentUrls.length };
  } catch (err) {
    console.error(`      ⚠️ Error completing property gallery:`, err);
    return { success: false, imagesCount: 0 };
  }
}