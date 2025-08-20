// services/saveRecommendationService.ts
import prisma from "../config/prisma"; 

export async function saveRecommendation(outputParsed: any, userId: number) {
  const { recommendedAreas, propertySuggestion } = outputParsed;

  const recommendation = await prisma.recommendation.create({
    data: { userId },
  });

  if (propertySuggestion) {
    await prisma.propertySuggestion.create({
      data: {
        type: propertySuggestion.type,
        idealFor: propertySuggestion.idealFor,
        priceRange: propertySuggestion.priceRange,
        fullDescription: propertySuggestion.fullDescription ?? null,
        recommendationId: recommendation.id,
      },
    });
  }

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
    } = area;

    const { raceEthnicity, incomeLevels, crimeData } = demographics;

    await prisma.$transaction(async (tx) => {
     
      const savedArea = await tx.recommendedArea.create({
        data: {
          name,
          state,
          reason,
          fullDescription: fullDescription ?? null,
          recommendationId: recommendation.id,
          placesOfInterest,
          lifestyleTags,
        },
      });

      const areaId = savedArea.id;

      
      await Promise.all([
        tx.raceEthnicity.create({
          data: {
            white: raceEthnicity.white,
            hispanic: raceEthnicity.hispanic,
            asian: raceEthnicity.asian,
            black: raceEthnicity.black,
            other: raceEthnicity.other,
            areaId,
          },
        }),
        tx.incomeLevels.create({
          data: {
            perCapitaIncome: incomeLevels.perCapitaIncome,
            medianHouseholdIncome: incomeLevels.medianHouseholdIncome,
            areaId,
          },
        }),
        tx.crimeData.create({
          data: {
            violentCrimes: crimeData.numberOfCrimes.violent,
            propertyCrimes: crimeData.numberOfCrimes.property,
            totalCrimes: crimeData.numberOfCrimes.total,
            violentRate: crimeData.crimeRatePer1000.violent,
            propertyRate: crimeData.crimeRatePer1000.property,
            totalRate: crimeData.crimeRatePer1000.total,
            areaId,
          },
        }),
      ]);

      
      if (schools.length) {
        await tx.school.createMany({
          data: schools.map((s: any) => ({
            name: s.name,
            description: s.description,
            fullDescription: s.fullDescription ?? null,
            imageUrl: s.imageUrl ?? "",
            website: s.website,
            areaId,
          })),
        });
      }
      if (socialLife.length) {
        await tx.socialLife.createMany({
          data: socialLife.map((x: any) => ({
            name: x.name,
            description: x.description,
            fullDescription: x.fullDescription ?? null,
            imageUrl: x.imageUrl ?? "",
            website: x.website,
            areaId,
          })),
        });
      }
      if (shopping.length) {
        await tx.shopping.createMany({
          data: shopping.map((x: any) => ({
            name: x.name,
            description: x.description,
            fullDescription: x.fullDescription ?? null,
            imageUrl: x.imageUrl ?? "",
            website: x.website,
            areaId,
          })),
        });
      }
      if (greenSpaces.length) {
        await tx.greenSpace.createMany({
          data: greenSpaces.map((x: any) => ({
            name: x.name,
            description: x.description,
            fullDescription: x.fullDescription ?? null,
            imageUrl: x.imageUrl ?? "",
            website: x.website,
            areaId,
          })),
        });
      }
      if (sports.length) {
        await tx.sport.createMany({
          data: sports.map((x: any) => ({
            name: x.name,
            description: x.description,
            fullDescription: x.fullDescription ?? null,
            imageUrl: x.imageUrl ?? "",
            website: x.website,
            areaId,
          })),
        });
      }
      if (properties.length) {
        await tx.property.createMany({
          data: properties.map((p: any) => ({
            address: p.address,
            price: p.price,
            description: p.description,
            fullDescription: p.fullDescription ?? null,
            imageUrl: p.imageUrl ?? "",
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
    });
  }

  return recommendation;
}
