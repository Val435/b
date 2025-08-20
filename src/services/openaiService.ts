import dotenv from "dotenv";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import fetch from "node-fetch";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const GOOGLE_KEY = process.env.GOOGLE_MAPS_KEY!;

// =================== FALLBACKS ===================
const FALLBACKS = {
  school:   "https://cdn.pixabay.com/photo/2016/11/21/16/36/school-1844439_1280.jpg",
  social:   "https://cdn.pixabay.com/photo/2016/11/29/12/35/club-1867421_1280.jpg",
  shopping: "https://cdn.pixabay.com/photo/2016/10/30/05/26/mall-1786475_1280.jpg",
  greens:   "https://cdn.pixabay.com/photo/2016/07/27/05/19/park-1544552_1280.jpg",
  sports:   "https://cdn.pixabay.com/photo/2016/11/29/09/08/sport-1867161_1280.jpg",
  property: "https://cdn.pixabay.com/photo/2016/08/26/15/06/house-1622401_1280.jpg",
};

// =================== GOOGLE PLACES HELPERS ===================
async function getPlaceIdByText(query: string): Promise<string | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_KEY}`;
    const r = await fetch(url);
    const j = await r.json();
    return j?.results?.[0]?.place_id ?? null;
  } catch {
    return null;
  }
}

function extractPlaceIdFromGmapsUrl(googleMapsUrl?: string): string | null {
  if (!googleMapsUrl) return null;
  try {
    const u = new URL(googleMapsUrl);
    const q = u.searchParams.get("q");
    if (q?.startsWith("place_id:")) return q.substring("place_id:".length);
    return null;
  } catch {
    return null;
  }
}

async function getPhotoUrlByPlaceId(placeId: string, maxwidth = 1200): Promise<string | null> {
  try {
    const details = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photo&key=${GOOGLE_KEY}`;
    const dr = await fetch(details);
    const dj = await dr.json();
    const ref = dj?.result?.photos?.[0]?.photo_reference;
    if (!ref) return null;
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${ref}&key=${GOOGLE_KEY}`;
  } catch {
    return null;
  }
}

async function resolveImageForPlace(params: {
  name: string;
  areaName?: string;
  googleMapsUrl?: string;
  placeIdHint?: string;
}): Promise<string | null> {
  let placeId = params.placeIdHint || extractPlaceIdFromGmapsUrl(params.googleMapsUrl);
  if (!placeId) {
    const query = [params.name, params.areaName].filter(Boolean).join(" ");
    placeId = await getPlaceIdByText(query);
  }
  if (!placeId) return null;
  return await getPhotoUrlByPlaceId(placeId);
}

// =================== SANITIZE IMAGES (usa Google Places) ===================
function looksLikeValidImageUrl(u: string) {
  try {
    imageUrlString.parse(u);
    return true;
  } catch {
    return false;
  }
}

const sanitizeImages = async (parsed: any) => {
  const handleList = async (
    items: any[] | undefined,
    type: keyof typeof FALLBACKS,
    areaName: string | undefined,
    getName: (x: any) => string
  ) => {
    if (!items) return;
    await Promise.all(
      items.map(async (it) => {
        if (!it.imageUrl || !looksLikeValidImageUrl(it.imageUrl)) {
          const img = await resolveImageForPlace({
            name: getName(it),
            areaName,
            googleMapsUrl: it.googleMapsUrl,
            placeIdHint: it.placeId,
          });
          it.imageUrl = img ?? FALLBACKS[type];
        }
      })
    );
  };

  await Promise.all(
    parsed?.recommendedAreas?.map(async (area: any) => {
      const areaName = area?.name;
      await handleList(area?.schools,     "school",   areaName, (s) => s.name);
      await handleList(area?.socialLife,  "social",   areaName, (s) => s.name);
      await handleList(area?.shopping,    "shopping", areaName, (s) => s.name);
      await handleList(area?.greenSpaces, "greens",   areaName, (s) => s.name);
      await handleList(area?.sports,      "sports",   areaName, (s) => s.name);
      await handleList(area?.properties,  "property", areaName, (p) => p.address ?? p.name ?? "");
    }) ?? []
  );
  return parsed;
};

// =================== VALIDADORES (STRICT, para post-parse) ===================
const nonEmptyText = z.string().min(20, "Full description must be detailed");

// URL genérica sin flags
export const urlString = z
  .string()
  .regex(/^(?:https?):\/\/[^\s]+$/, "Must be a URL starting with http or https");

// Acepta: imágenes directas o endpoint Google Place Photo
export const imageUrlString = z.string().regex(
  /^https:\/\/(?:[^ \t\r\n]*\.(?:jpg|jpeg|png|webp)(?:\?[^ \t\r\n]*)?|(?:(?:maps\.googleapis\.com|maps\.google\.com)\/maps\/api\/place\/photo)[^ \t\r\n]*)$/,
  "imageUrl must be https and either a direct image (jpg/png/webp) or a Google Place Photo endpoint"
);

// --------- STRICT schemas (post-parse) ----------
const placeSchemaStrict = z.object({
  name: z.string(),
  description: z.string(),
  fullDescription: nonEmptyText,
  website: urlString.optional(),
  googleMapsUrl: urlString.optional(),
  placeId: z.string().optional(),
  imageUrl: imageUrlString.optional(),
});

const propertySchemaStrict = z.object({
  address: z.string(),
  price: z.string(),
  description: z.string(),
  fullDescription: nonEmptyText,
  imageUrl: imageUrlString.optional(),
  details: z.object({
    type: z.string(),
    builtYear: z.number().int(),
    lotSizeSqFt: z.number().int(),
    parkingSpaces: z.number().int(),
    inUnitLaundry: z.boolean(),
    district: z.string(),
  }),
});

const placeListExactly3_Strict = z.array(placeSchemaStrict).min(3).max(3);
const propertyListExactly3_Strict = z.array(propertySchemaStrict).min(3).max(3);

const areaDetailsSchemaStrict = z.object({
  name: z.string(),
  schools: placeListExactly3_Strict,
  socialLife: placeListExactly3_Strict,
  shopping: placeListExactly3_Strict,
  greenSpaces: placeListExactly3_Strict,
  sports: placeListExactly3_Strict,
  properties: propertyListExactly3_Strict,
});

// =================== SCHEMAS PARA EL MODELO (compatibles JSON Schema) ===================
// Nada de .int(), ni regex, ni transforms. Solo tipos básicos y min/max en arrays.
const placeSchemaModel = z.object({
  name: z.string(),
  description: z.string(),
  fullDescription: z.string().min(20),
  website: z.string().optional(),
  googleMapsUrl: z.string().optional(),
  placeId: z.string().optional(),
  imageUrl: z.string().optional(),
});

const propertySchemaModel = z.object({
  address: z.string(),
  price: z.string(),
  description: z.string(),
  fullDescription: z.string().min(20),
  imageUrl: z.string().optional(),
  details: z.object({
    type: z.string(),
    builtYear: z.number(),       // sin .int()
    lotSizeSqFt: z.number(),
    parkingSpaces: z.number(),
    inUnitLaundry: z.boolean(),
    district: z.string(),
  }),
});

const placeListExactly3_Model = z.array(placeSchemaModel).min(3).max(3);
const propertyListExactly3_Model = z.array(propertySchemaModel).min(3).max(3);

const areaDetailsSchemaModel = z.object({
  name: z.string(),
  schools: placeListExactly3_Model,
  socialLife: placeListExactly3_Model,
  shopping: placeListExactly3_Model,
  greenSpaces: placeListExactly3_Model,
  sports: placeListExactly3_Model,
  properties: propertyListExactly3_Model,
});

// =================== CORE SCHEMA (como lo tenías) ===================
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

// =================== PROMPTS ===================
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

DATA FIELDS
- For every place/property include, when possible:
  - googleMapsUrl (the exact Google Maps link of the place),
  - placeId (if you can identify it),
  - website (official site).
- Do NOT invent stock images; leave imageUrl empty if unsure (we will fill it after).

TEXT RULES
- description: 1 sentence (<= 18 words).
- fullDescription: 1–2 concise sentences (<= 35 words).

OUTPUT RULES
- Include the "name" of the area so we can merge later.
- Output must match the provided JSON schema exactly.
`.trim();

// =================== MAIN FLOW ===================
export const fetchRecommendationsFromOpenAI = async (userProfile: any) => {
  console.log("🤖 [OpenAI] Inicio (2 fases con web_search_preview)...");
  console.log("📤 Perfil:", JSON.stringify(userProfile, null, 2));

  // 1) CORE
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

  // 2) DETALLES por área (en paralelo) -> usar SCHEMA *MODEL* para el modelo
  const detailsListRaw = await Promise.all(
    core.recommendedAreas.map((area) =>
      openai.responses.parse({
        model: "gpt-4o-2024-08-06",
        tools: [{ type: "web_search_preview" }],
        input: [
          { role: "system", content: systemPromptDetails },
          { role: "user", content: JSON.stringify({ userProfile, area }, null, 2) },
        ],
        text: { format: zodTextFormat(areaDetailsSchemaModel, "area_details") }, // <--- schema simple
        temperature: 0.3,
        max_output_tokens: 2200,
      }).then(r => r.output_parsed as z.infer<typeof areaDetailsSchemaModel>)
    )
  );

  // Post-parse: valida con el STRICT (regex, .int(), etc.)
  const detailsList = detailsListRaw.map(raw => areaDetailsSchemaStrict.parse(raw));

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

  console.log("[OpenAI] Resolviendo imágenes reales con Google Places…");
  return await sanitizeImages(finalResult);
};
