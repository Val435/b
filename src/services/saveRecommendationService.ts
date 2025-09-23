// src/services/saveRecommendationService.ts
import prisma from "../config/prisma";

const DEFAULT_PLACEHOLDER = "https://placehold.co/600x400?text=No+Image";

const ensureGallery = (item: any): string[] => {
  const gallery = Array.isArray(item?.imageGallery)
    ? item.imageGallery.filter((url: any) => typeof url === "string" && url.trim())
    : [];
  if (!gallery.length && typeof item?.imageUrl === "string" && item.imageUrl.trim()) {
    gallery.push(item.imageUrl.trim());
  }
  const fallback =
    typeof item?.imageUrl === "string" && item.imageUrl.trim()
      ? item.imageUrl.trim()
      : DEFAULT_PLACEHOLDER;
  while (gallery.length < 3) {
    gallery.push(fallback);
  }
  return gallery.slice(0, 3);
};

const ensureDirection = (
  raw: any,
  name: string,
  areaName: string,
  areaState: string
): string => {
  const candidate = typeof raw === "string" ? raw.trim() : "";
  if (candidate) {
    return candidate;
  }
  const fallback = [name, areaName, areaState].filter(Boolean).join(", ");
  return fallback;
};

const mapAmenity = (
  item: any,
  areaId: number,
  areaName: string,
  areaState: string
) => ({
  name: item.name,
  description: item.description,
  fullDescription: item.fullDescription ?? "",
  imageUrl: item.imageUrl ?? null,
  imageGallery: ensureGallery(item),
  website: item.website ?? null,
  direction: ensureDirection(item.direction, item.name, areaName, areaState),
  areaId,
});

export async function saveRecommendation(
  outputParsed: any,
  userId: number,
  journeyId: number
) {
  if (!Number.isFinite(journeyId)) {
    throw new Error("journeyId is required to save a recommendation");
  }

  const { recommendedAreas = [], propertySuggestion = null } = outputParsed ?? {};

  // 1) Transacción principal: Recommendation + Areas + datos demográficos
  const { recommendation, areasMeta } = await prisma.$transaction(async (tx) => {
    const recommendation = await tx.recommendation.create({
      data: { userId, journeyId },
      select: { id: true, createdAt: true, userId: true, journeyId: true },
    });

    if (propertySuggestion) {
      await tx.propertySuggestion.create({
        data: {
          type: propertySuggestion.type,
          idealFor: propertySuggestion.idealFor,
          priceRange: propertySuggestion.priceRange,
          fullDescription: propertySuggestion.fullDescription ?? null,
          recommendationId: recommendation.id,
        },
      });
    }

    const areasMeta: {
      areaId: number;
      areaName: string;
      areaState: string;
      schools: any[];
      socialLife: any[];
      shopping: any[];
      greenSpaces: any[];
      sports: any[];
      transportation: any[];
      family: any[];
      restaurants: any[];
      pets: any[];
      hobbies: any[];
      properties: any[];
    }[] = [];

    for (const area of recommendedAreas) {
      const {
        name,
        state,
        reason,
        fullDescription,
        demographics,
        schools = [],
        socialLife = [],
        shopping = [],
        greenSpaces = [],
        sports = [],
        transportation = [],
        family = [],
        restaurants = [],
        pets = [],
        hobbies = [],
        schoolsSummary,
        socialLifeSummary,
        shoppingSummary,
        greenSpacesSummary,
        sportsSummary,
        transportationSummary,
        familySummary,
        restaurantsSummary,
        petsSummary,
        hobbiesSummary,
        properties = [],
        imageUrl = null,
        lifestyleTags = [],
        placesOfInterest = [],
      } = area;

      const { raceEthnicity, incomeLevels, crimeData } = demographics;
      const schoolsItems = Array.isArray(schools)
        ? schools
        : (schools as any)?.items ?? [];

      const savedArea = await tx.recommendedArea.create({
        data: {
          name,
          state,
          reason,
          fullDescription: fullDescription ?? null,
          imageUrl: imageUrl ?? null,
          recommendationId: recommendation.id,
          lifestyleTags,
          placesOfInterest,
          schoolsSummary: Array.isArray(schoolsSummary) ? schoolsSummary : [],
          socialLifeSummary: Array.isArray(socialLifeSummary) ? socialLifeSummary : [],
          shoppingSummary: Array.isArray(shoppingSummary) ? shoppingSummary : [],
          greenSpacesSummary: Array.isArray(greenSpacesSummary) ? greenSpacesSummary : [],
          sportsSummary: Array.isArray(sportsSummary) ? sportsSummary : [],
          transportationSummary: Array.isArray(transportationSummary) ? transportationSummary : [],
          familySummary: Array.isArray(familySummary) ? familySummary : [],
          restaurantsSummary: Array.isArray(restaurantsSummary) ? restaurantsSummary : [],
          petsSummary: Array.isArray(petsSummary) ? petsSummary : [],
          hobbiesSummary: Array.isArray(hobbiesSummary) ? hobbiesSummary : [],
        },
      });

      const areaId = savedArea.id;

      // Demográficos
      await tx.raceEthnicity.create({ data: { ...raceEthnicity, areaId } });
      await tx.incomeLevels.create({ data: { ...incomeLevels, areaId } });
      await tx.crimeData.create({
        data: {
          violentCrimes: crimeData.numberOfCrimes.violent,
          propertyCrimes: crimeData.numberOfCrimes.property,
          totalCrimes: crimeData.numberOfCrimes.total,
          violentRate: crimeData.crimeRatePer1000.violent,
          propertyRate: crimeData.crimeRatePer1000.property,
          totalRate: crimeData.crimeRatePer1000.total,
          areaId,
        },
      });

      // Guardamos metadata para batch de amenities y properties
      areasMeta.push({
        areaId,
        areaName: name,
        areaState: state,
        schools: schoolsItems,
        socialLife,
        shopping,
        greenSpaces,
        sports,
        transportation,
        family,
        restaurants,
        pets,
        hobbies,
        properties,
      });
    }

    return { recommendation, areasMeta };
  });

  // 2) Amenities (fuera de la transacción, en paralelo)
  await Promise.all(
    areasMeta.map(
      async ({
        areaId,
        areaName,
        areaState,
        schools,
        socialLife,
        shopping,
        greenSpaces,
        sports,
        transportation,
        family,
        restaurants,
        pets,
        hobbies,
      }) => {
        const tasks: Promise<any>[] = [];

        if (schools.length) {
          tasks.push(
            prisma.school.createMany({
              data: schools.map((x) => mapAmenity(x, areaId, areaName, areaState)),
            })
          );
        }
        if (socialLife.length) {
          tasks.push(
            prisma.socialLife.createMany({
              data: socialLife.map((x) => mapAmenity(x, areaId, areaName, areaState)),
            })
          );
        }
        if (shopping.length) {
          tasks.push(
            prisma.shopping.createMany({
              data: shopping.map((x) => mapAmenity(x, areaId, areaName, areaState)),
            })
          );
        }
        if (greenSpaces.length) {
          tasks.push(
            prisma.greenSpace.createMany({
              data: greenSpaces.map((x) => mapAmenity(x, areaId, areaName, areaState)),
            })
          );
        }
        if (sports.length) {
          tasks.push(
            prisma.sport.createMany({
              data: sports.map((x) => mapAmenity(x, areaId, areaName, areaState)),
            })
          );
        }
        if (transportation.length) {
          tasks.push(
            prisma.transportation.createMany({
              data: transportation.map((x) => mapAmenity(x, areaId, areaName, areaState)),
            })
          );
        }
        if (family.length) {
          tasks.push(
            prisma.family.createMany({
              data: family.map((x) => mapAmenity(x, areaId, areaName, areaState)),
            })
          );
        }
        if (restaurants.length) {
          tasks.push(
            prisma.restaurant.createMany({
              data: restaurants.map((x) => mapAmenity(x, areaId, areaName, areaState)),
            })
          );
        }
        if (pets.length) {
          tasks.push(
            prisma.pet.createMany({
              data: pets.map((x) => mapAmenity(x, areaId, areaName, areaState)),
            })
          );
        }
        if (hobbies.length) {
          tasks.push(
            prisma.hobby.createMany({
              data: hobbies.map((x) => mapAmenity(x, areaId, areaName, areaState)),
            })
          );
        }

        if (tasks.length) {
          await Promise.all(tasks);
        }
      }
    )
  );

  // 3) Properties (batch único)
  const allProperties = areasMeta.flatMap((meta) =>
    meta.properties.map((p) => ({
      address: p.address,
      price: p.price,
      description: p.description,
      fullDescription: p.fullDescription ?? null,
      imageUrls: (p.imageUrls ?? []).slice(0, 5),
      type: p.details.type,
      builtYear: p.details.builtYear,
      lotSizeSqFt: p.details.lotSizeSqFt,
      parkingSpaces: p.details.parkingSpaces,
      inUnitLaundry: p.details.inUnitLaundry,
      district: p.details.district,
      areaId: meta.areaId,
    }))
  );

  if (allProperties.length) {
    await prisma.property.createMany({ data: allProperties });
  }

  return recommendation;
}
