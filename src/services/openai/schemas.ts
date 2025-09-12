import { z } from "zod";

// ===== Escalares reutilizables =====
export const nonEmptyText = z.string().min(20);
export const urlString = z.string().regex(/^https?:\/\/\S+$/i);
export const imageUrlString = z.string().regex(
  /^https:\/\/\S+\.(jpg|jpeg|png|webp)(\?.*)?$|^https:\/\/images\.unsplash\.com\/.*[?&]fm=(jpg|jpeg|png|webp)\b|^https:\/\/lh3\.googleusercontent\.com\/.+/i
);

// ===== Helpers residenciales =====
export const RESIDENTIAL_TYPES = [
  "single_family","condo","condominium","townhouse",
  "apartment","duplex","triplex","loft",
  "bungalow","cottage","multi_family",
  "manufactured","mobile_home","rowhouse"
] as const;

export const isResidentialType = (t: string) =>
  (RESIDENTIAL_TYPES as readonly string[])
    .includes(t.toLowerCase().replace(/\s+/g, "_"));

// ===== Place (sin .url() para evitar format:"uri") =====
const placeSchema = z.object({
  name: z.string(),
  description: z.string(),
  fullDescription: nonEmptyText,
  imageUrl: imageUrlString.nullable(), // ← antes: z.string().url().nullable()
  website: urlString.nullable(),       // ← antes: z.string().url().nullable()
});

const placesWithSummarySchema = z.object({
  items: z.array(placeSchema).min(3).max(10),
 summary: z.array(z.string()).length(3),});

// ===== Property =====
export const propertySchema = z.object({
  address: z.string(),
  price: z.string(),
  description: z.string(),
  fullDescription: nonEmptyText,
  imageUrls: z.array(imageUrlString).max(5).default([]), // sin .min(3)
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

const propertiesWithSummarySchema = z.object({
  items: z.array(propertySchema).min(3).max(10),
  summary: z.string(),
});

// ===== Core =====
export const coreSchema = z.object({
  recommendedAreas: z.array(z.object({
    name: z.string(),
    state: z.string(),
    reason: z.string(),
    fullDescription: nonEmptyText,
    imageUrl: imageUrlString.nullable(),
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
    placesOfInterest: z.array(z.string()).max(5).default([]),
    lifestyleTags: z.array(z.string()).max(6).default([]),
  })).min(3).max(10), // <-- aquí cambiamos length(3) a rango
  propertySuggestion: z.object({
    fullDescription: nonEmptyText,
    type: z.string()
      .transform(s => s.toLowerCase().replace(/\s+/g, "_"))
      .refine(isResidentialType, "PropertySuggestion type must be residential"),
    idealFor: z.string(),
    priceRange: z.string(),
  }),
});

// ===== Area Details =====
export const areaDetailsSchema = z.object({
  name: z.string(),
  schools: placesWithSummarySchema,
  socialLife: placesWithSummarySchema,
  shopping: placesWithSummarySchema,
  greenSpaces: placesWithSummarySchema,
  sports: placesWithSummarySchema,
  transportation: placesWithSummarySchema,
  family: placesWithSummarySchema,
  restaurants: placesWithSummarySchema,
  pets: placesWithSummarySchema,
  hobbies: placesWithSummarySchema,
  // Hacer opcional: el modelo a veces omite esta sección
  properties: propertiesWithSummarySchema.optional(),
});
