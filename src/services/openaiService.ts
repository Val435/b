import dotenv from "dotenv";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { sanitizeImages, FALLBACKS } from "../utils/image";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });




const nonEmptyText = z.string().min(20, "Full description must be detailed");

export const urlString = z
  .string()
  .regex(/^https?:\/\/\S+$/i, "Must be a URL starting with http or https");

export const imageUrlString = z
  .string()
  .regex(
    /^https:\/\/\S+\.(jpg|jpeg|png|webp)(\?.*)?$|^https:\/\/images\.unsplash\.com\/.*[?&]fm=(jpg|jpeg|png|webp)\b|^https:\/\/lh3\.googleusercontent\.com\/.+/i,
    "imageUrl must be a valid https URL (jpg/png/webp, Unsplash raw ?fm= or Google Photos)"
  );


const placeSchema = z.object({
  name: z.string(),
  description: z.string(),
  fullDescription: nonEmptyText,
  website: urlString,
  imageUrl: imageUrlString
});

const propertySchema = z.object({
  address: z.string(),
  price: z.string(),
  description: z.string(),
  fullDescription: nonEmptyText,
    imageUrls: z.array(imageUrlString).min(3).max(5),
  details: z.object({
    type: z.string(),
    builtYear: z.number().int(),
    lotSizeSqFt: z.number().int(),
    parkingSpaces: z.number().int(),
    inUnitLaundry: z.boolean(),
    district: z.string(),
  }),
});


const coreSchema = z.object({
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
    type: z.string(),
    idealFor: z.string(),
    priceRange: z.string(),
  }),
});


const areaDetailsSchema = z.object({
  name: z.string(),
  schools: z.array(placeSchema).length(3),
  socialLife: z.array(placeSchema).length(3),
  shopping: z.array(placeSchema).length(3),
  greenSpaces: z.array(placeSchema).length(3),
  sports: z.array(placeSchema).length(3),
  properties: z.array(propertySchema).length(3),
});


const systemPromptCore = `
You are a smart real estate recommendation engine.

TASK
- Generate EXACTLY 3 recommended areas that match the user's lifestyle/finances.
- For each area return ONLY: name, state, reason, fullDescription, demographics (raceEthnicity, incomeLevels, crimeData), and (optionally) placesOfInterest, lifestyleTags.
- Also return a single propertySuggestion (type, idealFor, priceRange, fullDescription).

OUTPUT RULES
- Numbers must be integers (no decimals).
- "reason": 1 sentence (<= 18 words).
- "fullDescription": 1–2 concise sentences (<= 35 words).
- No schools/social/shopping/green/sports/properties in this phase.
- Output must match the provided JSON schema exactly.
`.trim();

const systemPromptDetails = `
You are a smart real estate recommendation engine.

TASK
- You will receive ONE area (name/state/reason/etc). Generate details for THIS area only:
  schools(3), socialLife(3), shopping(3), greenSpaces(3), sports(3), properties(3).
- Each list must have EXACTLY 3 items.

IMAGE RULES
- Every item that requires an image must be an https direct file ending with .jpg/.jpeg/.png/.webp.
- Each property must include "imageUrls": an array of 3–5 such https links; if fewer than 3 valid links, repeat the default property URL to fill the array.
- If any image is missing or invalid, use these exact defaults (repeating for each empty slot):
  school:   ${FALLBACKS.school}
  social:   ${FALLBACKS.social}
  shopping: ${FALLBACKS.shopping}
  greens:   ${FALLBACKS.greens}
  sports:   ${FALLBACKS.sports}
  property: ${FALLBACKS.property}

TEXT RULES
- description: 1 sentence (<= 18 words).
- fullDescription: 1–2 concise sentences (<= 35 words).

OUTPUT RULES
- Include the "name" of the area so we can merge later.
- Output must match the provided JSON schema exactly.
`.trim();

export const fetchRecommendationsFromOpenAI = async (userProfile: any) => {
  console.log("🤖 [OpenAI] Starting (2 phases with web_search_preview)…");
  console.log("📤 Profile:", JSON.stringify(userProfile, null, 2));

  
  const coreResp = await openai.responses.parse({
    model: "gpt-4o-2024-08-06",
    tools: [{ type: "web_search_preview" }], 
    input: [
      { role: "system", content: systemPromptCore },
      { role: "user", content: JSON.stringify(userProfile, null, 2) },
    ],
    text: { format: zodTextFormat(coreSchema, "core_reco") },
    temperature: 0.3,
    max_output_tokens: 1600,
  });
  const core = coreResp.output_parsed as z.infer<typeof coreSchema>;

  const detailsList = await Promise.all(
    core.recommendedAreas.map((area) =>
      openai.responses.parse({
        model: "gpt-4o-2024-08-06",
        tools: [{ type: "web_search_preview" }],
        input: [
          { role: "system", content: systemPromptDetails },
          { role: "user", content: JSON.stringify({ userProfile, area }, null, 2) },
        ],
        text: { format: zodTextFormat(areaDetailsSchema, "area_details") },
        temperature: 0.3,
        max_output_tokens: 2200,
      }).then(r => r.output_parsed as z.infer<typeof areaDetailsSchema>)
    )
  );

  
  const mergedAreas = core.recommendedAreas.map((a) => {
    const d = detailsList.find((x) => x.name === a.name);
    return {
      ...a,
      ...(d ?? {
        name: a.name,
        schools: [],
        socialLife: [],
        shopping: [],
        greenSpaces: [],
        sports: [],
        properties: [],
      }),
    };
  });

  const finalResult = {
    recommendedAreas: mergedAreas,
    propertySuggestion: core.propertySuggestion,
  };

  console.log("[OpenAI] Sanitizing images…");
  return await sanitizeImages(finalResult);
};

