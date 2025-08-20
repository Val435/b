import dotenv from "dotenv";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { fetchVerifiedImage } from "./imageLookupService";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


const PREFERRED_HOSTS = [
  "upload.wikimedia.org",
  "images.unsplash.com",
  "cdn.pixabay.com",
];

const isPreferredHost = (u: string) => {
  try {
    const host = new URL(u).host;
    return PREFERRED_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
};

const FALLBACKS = {
  school:   "https://cdn.pixabay.com/photo/2016/11/21/16/36/school-1844439_1280.jpg",
  social:   "https://cdn.pixabay.com/photo/2016/11/29/12/35/club-1867421_1280.jpg",
  shopping: "https://cdn.pixabay.com/photo/2016/10/30/05/26/mall-1786475_1280.jpg",
  greens:   "https://cdn.pixabay.com/photo/2016/07/27/05/19/park-1544552_1280.jpg",
  sports:   "https://cdn.pixabay.com/photo/2016/11/29/09/08/sport-1867161_1280.jpg",
  property: "https://cdn.pixabay.com/photo/2016/08/26/15/06/house-1622401_1280.jpg",
};

const ensurePreferred = (
  url: string | undefined,
  type: keyof typeof FALLBACKS
): string => {
  const isDirectImage = !!url && /^https:\/\/\S+\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(url);
  if (isDirectImage && isPreferredHost(url!)) return url!;
  return FALLBACKS[type];
};

const sanitizeImages = async (parsed: any) => {
  const handleList = async (
    items: any[] | undefined,
    type: keyof typeof FALLBACKS,
    getName: (x: any) => string
  ) => {
    if (!items) return;
    await Promise.all(
      items.map(async (it) => {
        const ensured = ensurePreferred(it.imageUrl, type);
        if (ensured === FALLBACKS[type]) {
          const looked = await fetchVerifiedImage(getName(it));
          it.imageUrl = looked ?? ensured;
        } else {
          it.imageUrl = ensured;
        }
      })
    );
  };

  await Promise.all(
    parsed?.recommendedAreas?.map(async (area: any) => {
      await handleList(area?.schools, "school", (s) => s.name);
      await handleList(area?.socialLife, "social", (s) => s.name);
      await handleList(area?.shopping, "shopping", (s) => s.name);
      await handleList(area?.greenSpaces, "greens", (s) => s.name);
      await handleList(area?.sports, "sports", (s) => s.name);
      await handleList(area?.properties, "property", (p) => p.address);
    }) ?? []
  );
  return parsed;
};

// ===================== Validadores Zod base (compatibles con tu DB) =====================
const nonEmptyText = z.string().min(20, "Full description must be detailed");

export const urlString = z
  .string()
  .regex(/^https?:\/\/\S+$/i, "Must be a URL starting with http or https");

// Acepta cualquier https con extensión de imagen
export const imageUrlString = z
  .string()
  .regex(
    /^https:\/\/\S+\.(jpg|jpeg|png|webp)(\?.*)?$/i,
    "imageUrl debe ser un enlace https directo a JPG/PNG/WebP"
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
  imageUrl: imageUrlString,
  details: z.object({
    type: z.string(),
    builtYear: z.number().int(),
    lotSizeSqFt: z.number().int(),
    parkingSpaces: z.number().int(),
    inUnitLaundry: z.boolean(),
    district: z.string(),
  }),
});

// ===================== ESQUEMAS DE 2 FASES =====================
// Fase 1 (Core): SOLO info esencial de cada área + propertySuggestion
const coreSchema = z.object({
  recommendedAreas: z.array(z.object({
    name: z.string(),
    state: z.string(),
    reason: z.string(),
    fullDescription: nonEmptyText,
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
    // opcionalmente puedes incluir estas dos si las usas en el front:
    placesOfInterest: z.array(z.string()).min(2).max(5).optional(),
    lifestyleTags: z.array(z.string()).min(2).max(6).optional(),
  })).length(3), // EXACTAMENTE 3 áreas
  propertySuggestion: z.object({
    fullDescription: nonEmptyText,
    type: z.string(),
    idealFor: z.string(),
    priceRange: z.string(),
  }),
});

// Fase 2 (Detalles por área): SOLO listas (3 ítems exactos cada una)
const areaDetailsSchema = z.object({
  name: z.string(),
  schools: z.array(placeSchema).length(3),
  socialLife: z.array(placeSchema).length(3),
  shopping: z.array(placeSchema).length(3),
  greenSpaces: z.array(placeSchema).length(3),
  sports: z.array(placeSchema).length(3),
  properties: z.array(propertySchema).length(3),
});

// ===================== PROMPTS breves =====================
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
- Every item that requires imageUrl must be an https direct file ending with .jpg/.jpeg/.png/.webp.
- If unsure, use these exact defaults:
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
  console.log("🤖 [OpenAI] Inicio (2 fases con web_search_preview)…");
  console.log("📤 Perfil:", JSON.stringify(userProfile, null, 2));

  // 1) CORE (3 áreas + demografía/crimen + propertySuggestion)
  const coreResp = await openai.responses.parse({
    model: "gpt-4o-2024-08-06",
    tools: [{ type: "web_search_preview" }], // se mantiene
    input: [
      { role: "system", content: systemPromptCore },
      { role: "user", content: JSON.stringify(userProfile, null, 2) },
    ],
    text: { format: zodTextFormat(coreSchema, "core_reco") },
    temperature: 0.3,
    max_output_tokens: 1600,
  });
  const core = coreResp.output_parsed as z.infer<typeof coreSchema>;

  // 2) DETALLES por área (en paralelo) — usa web_search_preview para las imágenes
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

  // 3) MERGE por nombre
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

  console.log("🧼 [OpenAI] Sanitizando imágenes…");
  return await sanitizeImages(finalResult);
};

