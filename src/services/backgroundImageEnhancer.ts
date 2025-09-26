import prisma from "../config/prisma";
import { fetchVerifiedImage } from "./imageLookupService";
import { FALLBACKS } from "./openai/constants";

const MAX_IMAGES_PER_ITEM = 4;
const DELAY_BETWEEN_REQUESTS = 300;

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 🚀 Proceso completo de mejora de imágenes en 2 fases background
 */
export async function enhanceImagesInBackground(
  recommendationId: number,
  userId: number
) {
  const startTime = Date.now();
  console.log(`\n🚀 Starting background image enhancement (2 phases)`);
  
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
      console.error('❌ Recommendation not found');
      return;
    }

    console.log(`📦 Found ${recommendation.areas.length} areas to enhance`);

    // 🟡 FASE 2: Completar galerías de items visibles (5-10 min)
    console.log('\n🟡 Phase 2: Completing visible galleries...');
    await enhanceVisibleGalleries(recommendation);

    // 🟢 FASE 3: Resto de imágenes (15-30 min)
    console.log('\n🟢 Phase 3: Enhancing remaining images...');
    await enhanceRemainingImages(recommendation);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Background enhancement completed in ${duration}s`);
    
  } catch (err) {
    console.error('❌ Background enhancement failed:', err);
  }
}

// 🟡 Fase 2: Completar galerías del primer item de cada categoría
async function enhanceVisibleGalleries(recommendation: any) {
  for (const area of recommendation.areas) {
    console.log(`\n🌆 Phase 2: ${area.name}`);
    
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

    for (const cat of categories) {
      if (cat.items.length === 0) continue;

      // Solo completar galería del PRIMER item
      console.log(`  📸 ${cat.name} [first item only]`);
      const firstItem = cat.items[0];
      await completeItemGallery(
        cat.model,
        firstItem,
        area.name,
        area.state,
        cat.type
      );
    }

    // Completar imágenes de las primeras 3 propiedades
    console.log(`  🏠 properties [first 3 only]`);
    for (let i = 0; i < Math.min(3, area.properties.length); i++) {
      await completePropertyGallery(area.properties[i], area.name, area.state);
    }
  }
}

// 🟢 Fase 3: Todo lo demás
async function enhanceRemainingImages(recommendation: any) {
  for (const area of recommendation.areas) {
    console.log(`\n🌆 Phase 3: ${area.name}`);
    
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

    for (const cat of categories) {
      if (cat.items.length <= 1) continue;
      
      // Procesar items 2 en adelante
      console.log(`  📸 ${cat.name} [items 2-${cat.items.length}]`);
      for (let i = 1; i < cat.items.length; i++) {
        await completeItemGallery(
          cat.model,
          cat.items[i],
          area.name,
          area.state,
          cat.type
        );
      }
    }

    // Completar propiedades restantes
    if (area.properties.length > 3) {
      console.log(`  🏠 properties [items 4-${area.properties.length}]`);
      for (let i = 3; i < area.properties.length; i++) {
        await completePropertyGallery(area.properties[i], area.name, area.state);
      }
    }
  }
}

// Helper: Completar galería de un item (buscar imágenes 1, 2, 3)
async function completeItemGallery(
  model: any,
  item: any,
  areaName: string,
  areaState: string,
  includedType?: string
) {
  try {
    const locationHint = [areaName, areaState].filter(Boolean).join(", ");
    const currentGallery = Array.isArray(item.imageGallery) ? item.imageGallery : [];
    const gallery: string[] = [...currentGallery];

    // Buscar imágenes adicionales (índices 1, 2, 3)
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
        console.error(`    ❌ Image ${photoIndex} failed for ${item.name}`);
      }
    }

    // Actualizar si obtuvimos nuevas imágenes
    if (gallery.length > currentGallery.length) {
      await model.update({
        where: { id: item.id },
        data: {
          imageUrl: gallery[0],
          imageGallery: gallery.slice(0, MAX_IMAGES_PER_ITEM)
        }
      });
      console.log(`    ✅ ${item.name}: ${gallery.length} images`);
    }
  } catch (err) {
    console.error(`    ❌ Failed to complete gallery for ${item.name}`);
  }
}

// Helper: Completar galería de propiedad (5 imágenes)
async function completePropertyGallery(
  property: any,
  areaName: string,
  areaState: string
) {
  try {
    const locationHint = [areaName, areaState].filter(Boolean).join(", ");
    const currentUrls = Array.isArray(property.imageUrls) ? property.imageUrls : [];
    const imageUrls: string[] = [...currentUrls];

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
        console.error(`    ❌ Property image ${photoIndex} failed`);
      }
    }

    if (imageUrls.length > currentUrls.length) {
      await prisma.property.update({
        where: { id: property.id },
        data: { imageUrls: imageUrls.slice(0, 5) }
      });
      console.log(`    ✅ Property: ${imageUrls.length} images`);
    }
  } catch (err) {
    console.error(`    ❌ Failed to complete property gallery`);
  }
}