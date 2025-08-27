import { z } from "zod";

export const nonEmptyText = z.string().min(20);
export const urlString = z.string().regex(/^https?:\/\/\S+$/i);
export const imageUrlString = z.string().regex(
  /^https:\/\/\S+\.(jpg|jpeg|png|webp)(\?.*)?$|^https:\/\/images\.unsplash\.com\/.*[?&]fm=(jpg|jpeg|png|webp)\b|^https:\/\/lh3\.googleusercontent\.com\/.+/i
);

// residential helpers
export const RESIDENTIAL_TYPES = [
  "single_family","condo","condominium","townhouse",
  "apartment","duplex","triplex","loft",
  "bungalow","cottage","multi_family",
  "manufactured","mobile_home","rowhouse"
] as const;

export const isResidentialType = (t: string) =>
  (RESIDENTIAL_TYPES as readonly string[])
    .includes(t.toLowerCase().replace(/\s+/g, "_"));

const placeSchema = z.object({
  name: z.string(),
  description: z.string(),
  fullDescription: nonEmptyText,
  website: urlString,
  imageUrl: imageUrlString,
});

export const propertySchema = z.object({
  address: z.string(),
  price: z.string(),
  description: z.string(),
  fullDescription: nonEmptyText,
  imageUrls: z.array(imageUrlString).min(3).max(5),
  details: z.object({
    type: z.string()
      .transform(s => s.toLowerCase().replace(/\s+/g, "_"))
      .refine(isResidentialType, "Property type must be residential"),
    builtYear: z.number().int(),
    lotSizeSqFt: z.number().int(),
    parkingSpaces: z.number().int(),
    inUnitLaundry: z.boolean(),
    district: z.string(),
  }),
});

export const coreSchema = z.object({
  recommendedAreas: z.array(z.object({
    name: z.string(),
    state: z.string(),
    reason: z.string(),
    fullDescription: nonEmptyText,
    imageUrl: imageUrlString.optional(),
    demographics: z.object({
      raceEthnicity: z.object({
        white: z.number().int(),
        hispanic: z.number().int(),
        asian: z.number().int(),
        black: z.number().int(),
        other: z.number().int(),
      }),
      incomeLevels: z.object({
        perCapitaIncome: z.number().int(),
        medianHouseholdIncome: z.number().int(),
      }),
      crimeData: z.object({
        numberOfCrimes: z.object({
          violent: z.number().int(),
          property: z.number().int(),
          total: z.number().int(),
        }),
        crimeRatePer1000: z.object({
          violent: z.number().int(),
          property: z.number().int(),
          total: z.number().int(),
        }),
      }),
    }),
    placesOfInterest: z.array(z.string()).min(2).max(5).optional(),
    lifestyleTags: z.array(z.string()).min(2).max(6).optional(),
  })).length(3),
  propertySuggestion: z.object({
    fullDescription: nonEmptyText,
    type: z.string()
      .transform(s => s.toLowerCase().replace(/\s+/g, "_"))
      .refine(isResidentialType, "PropertySuggestion type must be residential"),
    idealFor: z.string(),
    priceRange: z.string(),
  }),
});

export const areaDetailsSchema = z.object({
  name: z.string(),
  schools: z.array(placeSchema).length(3),
  socialLife: z.array(placeSchema).length(3),
  shopping: z.array(placeSchema).length(3),
  greenSpaces: z.array(placeSchema).length(3),
  sports: z.array(placeSchema).length(3),
  properties: z.array(propertySchema).length(3),
});
