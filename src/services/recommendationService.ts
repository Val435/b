import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getAllRecommendedAreas = (userId: number) =>
  prisma.recommendedArea.findMany({
    where: { recommendation: { userId } },
  });

export const getPropertiesByUser = (userId: number) =>
  prisma.property.findMany({
    where: {
      area: { recommendation: { userId } },
    },
  });

export const getSchoolsByUser = (userId: number) =>
  prisma.school.findMany({
    where: {
      area: { recommendation: { userId } },
    },
  });

export const getRaceEthnicityByUser = (userId: number) =>
  prisma.raceEthnicity.findMany({
    where: {
      area: { recommendation: { userId } },
    },
  });

export const getIncomeLevelsByUser = (userId: number) =>
  prisma.incomeLevels.findMany({
    where: {
      area: { recommendation: { userId } },
    },
  });

export const getCrimeDataByUser = (userId: number) =>
  prisma.crimeData.findMany({
    where: {
      area: { recommendation: { userId } },
    },
  });

export const getPropertySuggestionByUser = (userId: number) =>
  prisma.recommendation.findFirst({
    where: { userId },
    include: { propertySuggestion: true },
  });




export const getFullRecommendationByEmail = (email: string) =>
  prisma.recommendation.findFirst({
    where: {
      user: { email },
    },
    include: {
      propertySuggestion: true,
      areas: {
        include: {
          raceEthnicity: true,
          incomeLevels: true,
          crimeData: true,
          schools: true,
          properties: true,
          socialLife: true,
          shopping: true,
          greenSpaces: true,
          sports: true,
          transportation: true,
          family: true,
          restaurants: true,
          pets: true,
          hobbies: true,
        } as any,
      },
    },
  });
