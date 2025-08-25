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
  "lh3.googleusercontent.com",
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
  area:     "https://cdn.pixabay.com/photo/2016/11/29/04/28/architecture-1868667_1280.jpg", // 👈 nuevo
};

type ImageKind = keyof typeof FALLBACKS;


const ensurePreferred = (url: string | undefined, type: ImageKind): string => {
  if (!url) return FALLBACKS[type];
  const u = url.trim();
  const isDirectFile   = /^https:\/\/\S+\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(u);
  const isUnsplashRaw  = /^https:\/\/images\.unsplash\.com\/.*[?&]fm=(jpg|jpeg|png|webp)\b/i.test(u);
  const isGooglePhotos = /^https:\/\/lh3\.googleusercontent\.com\/.+/i.test(u);
  if (isDirectFile || isUnsplashRaw || isGooglePhotos) return u;
  return FALLBACKS[type];
};

const sanitizeImages = async (parsed: any) => {
  const TYPE_HINTS: Record<ImageKind, string | undefined> = {
    school: "school",
    social: "bar",
    shopping: "shopping_mall",
    greens: "park",
    sports: "stadium",
    property: undefined,
    area: undefined, 
  };

 
  const ensureAreaImage = async (area: any) => {
    const ensured = ensurePreferred(area.imageUrl, "area");
    let looked: string | null = null;
    try {
  
      looked = await fetchVerifiedImage(`${area.name} ${area.state}`, {
        locationHint: [area.name, area.state].filter(Boolean).join(", "),
      });
     
      if (!looked) {
        looked = await fetchVerifiedImage(area.name, {
          locationHint: area.state,
        });
      }
    } catch {
      looked = null;
    }
    area.imageUrl = looked || ensured;
    console.log("🖼 area ·", area.name, "->", looked ? "GOOGLE OK" : "FALLBACK", area.imageUrl);
  };

  
  const usedAreaImages = new Set<string>();

  const handleList = async (
    items: any[] | undefined,
    type: ImageKind,
    getName: (x: any) => string,
    areaName: string,
    areaState: string
  ) => {
    if (!items) return;
    const locationHint = [areaName, areaState].filter(Boolean).join(", ");
    const includedType = TYPE_HINTS[type];
    const used = new Set<string>();
    await Promise.all(
      items.map(async (it) => {
           const processUrl = async (orig?: string, photoIndex = 0) => {
          const ensured = ensurePreferred(orig, type);
          let looked: string | null = null;
          try {
             looked = await fetchVerifiedImage(getName(it), { locationHint, includedType, photoIndex });
            if (!looked) {
              looked = await fetchVerifiedImage(getName(it), { locationHint, photoIndex });
            }
          } catch {
            looked = null;
          }
          let finalUrl = looked || ensured;
          if (used.has(finalUrl)) {
            const alt = ensured !== finalUrl ? ensured : FALLBACKS[type];
            finalUrl = used.has(alt) ? FALLBACKS[type] : alt;
          }
          used.add(finalUrl);
          return { finalUrl, lookedOk: !!looked };
        };

        if (Array.isArray(it.imageUrls)) {
          const targetLen = Math.min(Math.max(it.imageUrls.length, 3), 5);
          const originals = it.imageUrls.slice(0, targetLen);
          const sanitized: string[] = [];
          for (let i = 0; i < originals.length; i++) {
            const { finalUrl, lookedOk } = await processUrl(originals[i], i);
            sanitized.push(finalUrl);
             console.log(
              "🖼",
              type,
              `[${i}] ·`,
              getName(it),
              "->",
              lookedOk ? "GOOGLE OK" : "FALLBACK",
              finalUrl
            );
          }
          while (sanitized.length < targetLen) {
            const idx = sanitized.length;
            const { finalUrl, lookedOk } = await processUrl(undefined, idx);
            sanitized.push(finalUrl);
            console.log(
              "🖼",
              type,
              `[${idx}] ·`,
              getName(it),
              "->",
              lookedOk ? "GOOGLE OK" : "FALLBACK",
              finalUrl
            );
          }
          it.imageUrls = sanitized;
        } else {
          const { finalUrl, lookedOk } = await processUrl(it.imageUrl);
          it.imageUrl = finalUrl;
          console.log("🖼", type, "·", getName(it), "->", lookedOk ? "GOOGLE OK" : "FALLBACK", finalUrl);
        }
        
      })
    );
  };

  await Promise.all(
    (parsed?.recommendedAreas ?? []).map(async (area: any) => {
      const aName = area?.name ?? "";
      const aState = area?.state ?? "";

   
      await ensureAreaImage(area);

   
      if (usedAreaImages.has(area.imageUrl)) {
       
        const alt = FALLBACKS.area;
        area.imageUrl = usedAreaImages.has(alt) ? ensurePreferred(area.imageUrl, "area") : alt;
      }
      usedAreaImages.add(area.imageUrl);

      await handleList(area?.schools,     "school",   (s) => s.name,    aName, aState);
      await handleList(area?.socialLife,  "social",   (s) => s.name,    aName, aState);
      await handleList(area?.shopping,    "shopping", (s) => s.name,    aName, aState);
      await handleList(area?.greenSpaces, "greens",   (s) => s.name,    aName, aState);
      await handleList(area?.sports,      "sports",   (s) => s.name,    aName, aState);
      await handleList(area?.properties,  "property", (p) => p.address, aName, aState);
    })
  );

  return parsed;
};

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

