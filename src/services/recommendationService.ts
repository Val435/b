import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getAllRecommendedAreas = (userId: number, journeyId?: number) =>
  prisma.recommendedArea.findMany({
    where: { recommendation: { userId, journeyId } },
  });

export const getPropertiesByUser = (userId: number, journeyId?: number) =>
  prisma.property.findMany({
    where: {
      area: { recommendation: { userId, journeyId } },
    },
  });

export const getSchoolsByUser = (userId: number, journeyId?: number) =>
  prisma.school.findMany({
    where: {
      area: { recommendation: { userId, journeyId } },
    },
  });

export const getRaceEthnicityByUser = (userId: number, journeyId?: number) =>
  prisma.raceEthnicity.findMany({
    where: {
      area: { recommendation: { userId, journeyId } },
    },
  });

export const getIncomeLevelsByUser = (userId: number, journeyId?: number) =>
  prisma.incomeLevels.findMany({
    where: {
      area: { recommendation: { userId, journeyId } },
    },
  });

export const getCrimeDataByUser = (userId: number, journeyId?: number) =>
  prisma.crimeData.findMany({
    where: {
      area: { recommendation: { userId, journeyId } },
    },
  });

export const getPropertySuggestionByUser = (userId: number, journeyId?: number) =>
  prisma.recommendation.findFirst({
    where: { userId, journeyId },
    include: { propertySuggestion: true },
  });




export const getFullRecommendationByEmail = (
  email: string,
  journeyId?: number
) =>
  prisma.recommendation.findFirst({
    where: {
      user: { email },
      journeyId,
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
        },
      },
    },
  });
