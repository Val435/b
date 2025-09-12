// src/services/saveRecommendationService.ts
import prisma from "../config/prisma";

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
          schoolsSummary: schoolsSummary ?? null,
          socialLifeSummary: socialLifeSummary ?? null,
          shoppingSummary: shoppingSummary ?? null,
          greenSpacesSummary: greenSpacesSummary ?? null,
          sportsSummary: sportsSummary ?? null,
          transportationSummary: transportationSummary ?? null,
          familySummary: familySummary ?? null,
          restaurantsSummary: restaurantsSummary ?? null,
          petsSummary: petsSummary ?? null,
          hobbiesSummary: hobbiesSummary ?? null,
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
          tasks.push(prisma.school.createMany({ data: schools.map((s) => ({ ...s, areaId })) }));
        }
        if (socialLife.length) {
          tasks.push(prisma.socialLife.createMany({ data: socialLife.map((x) => ({ ...x, areaId })) }));
        }
        if (shopping.length) {
          tasks.push(prisma.shopping.createMany({ data: shopping.map((x) => ({ ...x, areaId })) }));
        }
        if (greenSpaces.length) {
          tasks.push(prisma.greenSpace.createMany({ data: greenSpaces.map((x) => ({ ...x, areaId })) }));
        }
        if (sports.length) {
          tasks.push(prisma.sport.createMany({ data: sports.map((x) => ({ ...x, areaId })) }));
        }
        if (transportation.length) {
          tasks.push(
            prisma.transportation.createMany({ data: transportation.map((x) => ({ ...x, areaId })) })
          );
        }
        if (family.length) {
          tasks.push(prisma.family.createMany({ data: family.map((x) => ({ ...x, areaId })) }));
        }
        if (restaurants.length) {
          tasks.push(
            prisma.restaurant.createMany({ data: restaurants.map((x) => ({ ...x, areaId })) })
          );
        }
        if (pets.length) {
          tasks.push(prisma.pet.createMany({ data: pets.map((x) => ({ ...x, areaId })) }));
        }
        if (hobbies.length) {
          tasks.push(prisma.hobby.createMany({ data: hobbies.map((x) => ({ ...x, areaId })) }));
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