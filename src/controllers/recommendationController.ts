import { Request, Response, NextFunction } from "express";
import {
  getAllRecommendedAreas,
  getPropertiesByUser,
  getSchoolsByUser,
  getRaceEthnicityByUser,
  getIncomeLevelsByUser,
  getCrimeDataByUser,
  getPropertySuggestionByUser,
 
  getFullRecommendationByEmail,
} from "../services/recommendationService";
import prisma from "../config/prisma";
import { safeUrl } from "../utils/url";

export const fetchRecommendedAreas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.params.userId);
    const areas = await getAllRecommendedAreas(userId);
    res.json(areas);
  } catch (error) {
    next(error);
  }
};

export const fetchProperties = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.params.userId);
    const properties = await getPropertiesByUser(userId);
    res.json(properties);
  } catch (error) {
    next(error);
  }
};

export const fetchSchools = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.params.userId);
    const schools = await getSchoolsByUser(userId);
    res.json(schools);
  } catch (error) {
    next(error);
  }
};

export const fetchRaceEthnicity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.params.userId);
    const races = await getRaceEthnicityByUser(userId);
    res.json(races);
  } catch (error) {
    next(error);
  }
};

export const fetchIncomeLevels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.params.userId);
    const income = await getIncomeLevelsByUser(userId);
    res.json(income);
  } catch (error) {
    next(error);
  }
};

export const fetchCrimeData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.params.userId);
    const crime = await getCrimeDataByUser(userId);
    res.json(crime);
  } catch (error) {
    next(error);
  }
};

export const fetchPropertySuggestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.params.userId);
    const suggestion = await getPropertySuggestionByUser(userId);
    res.json(suggestion?.propertySuggestion || null);
  } catch (error) {
    next(error);
  }
};

export const fetchFullRecommendation = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const email = req.params.email;

    // 1️⃣ Buscar el usuario por email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 2️⃣ Usar el userId para obtener la recomendación
    const recommendation = await prisma.recommendation.findFirst({
      where: { userId: user.id },
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
          },
        },
      },
    });

    if (!recommendation) {
      return res.status(404).json({ success: false, message: "No recommendation found" });
    }

    // 3️⃣ Estructurar la respuesta
    const response = {
  recommendedAreas: recommendation.areas.map((area) => ({
    name: area.name,
    state: area.state,
    reason: area.reason,
    fullDescription: area.fullDescription ?? "",        

    demographics: {
      raceEthnicity: {
        white: area.raceEthnicity?.white ?? 0,
        hispanic: area.raceEthnicity?.hispanic ?? 0,
        asian: area.raceEthnicity?.asian ?? 0,
        black: area.raceEthnicity?.black ?? 0,
        other: area.raceEthnicity?.other ?? 0,
      },
      incomeLevels: {
        perCapitaIncome: area.incomeLevels?.perCapitaIncome ?? 0,
        medianHouseholdIncome: area.incomeLevels?.medianHouseholdIncome ?? 0,
      },
      crimeData: {
        numberOfCrimes: {
          violent: area.crimeData?.violentCrimes ?? 0,
          property: area.crimeData?.propertyCrimes ?? 0,
          total: area.crimeData?.totalCrimes ?? 0,
        },
        crimeRatePer1000: {
          violent: area.crimeData?.violentRate ?? 0,
          property: area.crimeData?.propertyRate ?? 0,
          total: area.crimeData?.totalRate ?? 0,
        },
      },
    },

    schools: area.schools.map((school) => ({
      name: school.name,
      description: school.description,
      fullDescription: school.fullDescription ?? "",
      imageUrl: safeUrl(school.imageUrl),
      website: school.website,
    })),

    socialLife: area.socialLife.map((x) => ({
      name: x.name,
      description: x.description,
      fullDescription: x.fullDescription ?? "",
      imageUrl: safeUrl(x.imageUrl),
      website: x.website,
    })),
    shopping: area.shopping.map((x) => ({
      name: x.name,
      description: x.description,
      fullDescription: x.fullDescription ?? "",
      imageUrl: safeUrl(x.imageUrl),
      website: x.website,
    })),
    greenSpaces: area.greenSpaces.map((x) => ({
      name: x.name,
      description: x.description,
      fullDescription: x.fullDescription ?? "",
      imageUrl: safeUrl(x.imageUrl),
      website: x.website,
    })),
    sports: area.sports.map((x) => ({
      name: x.name,
      description: x.description,
      fullDescription: x.fullDescription ?? "",
      imageUrl: safeUrl(x.imageUrl),
      website: x.website,
    })),

    placesOfInterest: area.placesOfInterest ?? [],
    lifestyleTags: area.lifestyleTags ?? [],

    properties: area.properties.map((property) => ({
      address: property.address,
      price: property.price,
      description: property.description,
      fullDescription: property.fullDescription ?? "",
      imageUrl: safeUrl(property.imageUrl),
      details: {
        type: property.type,
        builtYear: property.builtYear,
        lotSizeSqFt: property.lotSizeSqFt,
        parkingSpaces: property.parkingSpaces,
        inUnitLaundry: property.inUnitLaundry,
        district: property.district,
      },
    })),
  })),

  propertySuggestion: recommendation.propertySuggestion
    ? {
        type: recommendation.propertySuggestion.type,
        idealFor: recommendation.propertySuggestion.idealFor,
        priceRange: recommendation.propertySuggestion.priceRange,
        fullDescription: recommendation.propertySuggestion.fullDescription ?? "", 
      }
    : null,
};

    return res.status(200).json({ success: true, data: response });
  } catch (error) {
    next(error);
  }
};

