import { Request, Response, NextFunction, RequestHandler } from "express";
import {
  getAllRecommendedAreas,
  getPropertiesByUser,
  getSchoolsByUser,
  getRaceEthnicityByUser,
  getIncomeLevelsByUser,
  getCrimeDataByUser,
  getPropertySuggestionByUser,
} from "../services/recommendationService";
import prisma from "../config/prisma";
import { safeUrl } from "../utils/url";

// ---------- helpers ----------
function mapRecommendationToResponse(reco: any) {
  const mapAmenityResponse = (list: any[] | undefined, area: any) =>
    (Array.isArray(list) ? list : []).map((item: any) => {
      const direction =
        typeof item.direction === 'string' && item.direction.trim()
          ? item.direction.trim()
          : [item.name, area?.name, area?.state].filter(Boolean).join(', ');

      return {
        name: item.name,
        description: item.description,
        fullDescription: item.fullDescription ?? '',
        imageUrl: safeUrl(item.imageUrl),
        imageGallery: (Array.isArray(item.imageGallery) ? item.imageGallery : []).map((url: string) => safeUrl(url)),
        website: item.website,
        direction,
         latitude: Number.isFinite(item.latitude) ? item.latitude : null,
        longitude: Number.isFinite(item.longitude) ? item.longitude : null,
      };
    });

  return {
    recommendedAreas: reco.areas.map((area: any) => ({
      name: area.name,
      state: area.state,
      reason: area.reason,
      fullDescription: area.fullDescription ?? "",
      imageUrl: safeUrl(area.imageUrl),

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

      schools: mapAmenityResponse(area.schools, area),
      schoolsSummary: area.schoolsSummary ?? [],

      socialLife: mapAmenityResponse(area.socialLife, area),
      socialLifeSummary: area.socialLifeSummary ?? [],
      shopping: mapAmenityResponse(area.shopping, area),
      shoppingSummary: area.shoppingSummary ?? [],
      greenSpaces: mapAmenityResponse(area.greenSpaces, area),
      greenSpacesSummary: area.greenSpacesSummary ?? [],
      sports: mapAmenityResponse(area.sports, area),
      sportsSummary: area.sportsSummary ?? [],
      transportation: mapAmenityResponse(area.transportation, area),
      transportationSummary: area.transportationSummary ?? [],
      family: mapAmenityResponse(area.family, area),
      familySummary: area.familySummary ?? [],
      restaurants: mapAmenityResponse(area.restaurants, area),
      restaurantsSummary: area.restaurantsSummary ?? [],
      pets: mapAmenityResponse(area.pets, area),
      petsSummary: area.petsSummary ?? [],
      hobbies: mapAmenityResponse(area.hobbies, area),
      hobbiesSummary: area.hobbiesSummary ?? [],

      placesOfInterest: area.placesOfInterest ?? [],
      lifestyleTags: area.lifestyleTags ?? [],

      properties: (area.properties ?? []).map((property: any) => ({
        address: property.address,
        price: property.price,
        description: property.description,
        fullDescription: property.fullDescription ?? "",
        imageUrls: (property.imageUrls ?? []).slice(0, 5).map((url: string) => safeUrl(url)),
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
    propertySuggestion: reco.propertySuggestion
      ? {
          type: reco.propertySuggestion.type,
          idealFor: reco.propertySuggestion.idealFor,
          priceRange: reco.propertySuggestion.priceRange,
          fullDescription: reco.propertySuggestion.fullDescription ?? "",
        }
      : null,
  };
}

// ---------- legacy fetchers ----------
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

// ---------- full por email (+ opcional journeyId) ----------
export const fetchFullRecommendation: RequestHandler = async (req, res, next) => {
  try {
    const email = req.params.email;
    const journeyId = req.params.journeyId ? Number(req.params.journeyId) : undefined;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const recommendation = await prisma.recommendation.findFirst({
      where: { userId: user.id, ...(journeyId ? { journeyId } : {}) },
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

    if (!recommendation) {
      res.status(404).json({ success: false, message: "No recommendation found" });
      return;
    }

    const response = mapRecommendationToResponse(recommendation);
    res.status(200).json({ success: true, data: response });
  } catch (error) {
    next(error);
  }
};

// ---------- ✅ NUEVO: full por journeyId ----------
export const fetchByJourney: RequestHandler = async (req, res, next) => {
  try {
    const journeyId = Number(req.params.journeyId);
    if (!Number.isFinite(journeyId)) {
      res.status(400).json({ success: false, message: "Invalid journeyId" });
      return;
    }

    const recommendation = await prisma.recommendation.findFirst({
      where: { journeyId },
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

    if (!recommendation) {
      res.status(404).json({ success: false, message: "No recommendation found for this journey" });
      return;
    }

    const response = mapRecommendationToResponse(recommendation);
    res.status(200).json({ success: true, data: response });
  } catch (error) {
    next(error);
  }
};
