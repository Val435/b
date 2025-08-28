// src/services/saveRecommendationService.ts
import prisma from "../config/prisma";

export async function saveRecommendation(
  outputParsed: any,
  userId: number,
  journeyId: number // ← AHORA REQUERIDO
) {
  if (!Number.isFinite(journeyId)) {
    throw new Error("journeyId is required to save a recommendation");
  }

  const { recommendedAreas = [], propertySuggestion = null } = outputParsed ?? {};

  return await prisma.$transaction(async (tx) => {
    // 1) Encabezado Recommendation con journeyId SIEMPRE
    const recommendation = await tx.recommendation.create({
      data: { userId, journeyId },
      select: { id: true, createdAt: true, userId: true, journeyId: true },
    });

    // 2) PropertySuggestion (opcional)
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

    // 3) Áreas y relacionados
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
        placesOfInterest = [],
        lifestyleTags = [],
        properties = [],
        imageUrl = null,
      } = area;

      const { raceEthnicity, incomeLevels, crimeData } = demographics;

      // Área
      const savedArea = await tx.recommendedArea.create({
        data: {
          name,
          state,
          reason,
          fullDescription: fullDescription ?? null,
          imageUrl: imageUrl ?? null,
          recommendationId: recommendation.id,
          placesOfInterest,
          lifestyleTags,
        },
      });

      const areaId = savedArea.id;

      // Demográficos
      await tx.raceEthnicity.create({
        data: {
          white: raceEthnicity.white,
          hispanic: raceEthnicity.hispanic,
          asian: raceEthnicity.asian,
          black: raceEthnicity.black,
          other: raceEthnicity.other,
          areaId,
        },
      });

      await tx.incomeLevels.create({
        data: {
          perCapitaIncome: incomeLevels.perCapitaIncome,
          medianHouseholdIncome: incomeLevels.medianHouseholdIncome,
          areaId,
        },
      });

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

      // Schools
      if (schools.length) {
        await tx.school.createMany({
          data: schools.map((s: any) => ({
            name: s.name,
            description: s.description,
            fullDescription: s.fullDescription ?? null,
            imageUrl: s.imageUrl ?? null,
            website: s.website ?? null, // ← ahora nullable en Prisma
            areaId,
          })),
        });
      }

      // Social life
      if (socialLife.length) {
        await tx.socialLife.createMany({
          data: socialLife.map((x: any) => ({
            name: x.name,
            description: x.description,
            fullDescription: x.fullDescription ?? null,
            imageUrl: x.imageUrl ?? null,
            website: x.website ?? null,
            areaId,
          })),
        });
      }

      // Shopping
      if (shopping.length) {
        await tx.shopping.createMany({
          data: shopping.map((x: any) => ({
            name: x.name,
            description: x.description,
            fullDescription: x.fullDescription ?? null,
            imageUrl: x.imageUrl ?? null,
            website: x.website ?? null,
            areaId,
          })),
        });
      }

      // Green spaces
      if (greenSpaces.length) {
        await tx.greenSpace.createMany({
          data: greenSpaces.map((x: any) => ({
            name: x.name,
            description: x.description,
            fullDescription: x.fullDescription ?? null,
            imageUrl: x.imageUrl ?? null,
            website: x.website ?? null,
            areaId,
          })),
        });
      }

      // Sports
      if (sports.length) {
        await tx.sport.createMany({
          data: sports.map((x: any) => ({
            name: x.name,
            description: x.description,
            fullDescription: x.fullDescription ?? null,
            imageUrl: x.imageUrl ?? null,
            website: x.website ?? null,
            areaId,
          })),
        });
      }

      // Properties
      if (properties.length) {
        await tx.property.createMany({
          data: properties.map((p: any) => ({
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
            areaId,
          })),
        });
      }
    }

    // 4) Resultado de la transacción
    return recommendation;
  });
}
