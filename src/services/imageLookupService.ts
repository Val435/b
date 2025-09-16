import dotenv from "dotenv";
dotenv.config();

const API_KEY =
  process.env.GOOGLE_MAPS_KEY ||
  process.env.GOOGLE_PLACES_API_KEY ||
  "";

if (!API_KEY) {
  console.warn(" Missing GOOGLE_MAPS_KEY / GOOGLE_PLACES_API_KEY in .env");
}

const DEBUG = (process.env.PLACES_DEBUG || "").toLowerCase() === "true";

// Recommended sizes: 1200x800
const DEFAULT_MAX_WIDTH_PX = Number(process.env.PLACES_MAX_WIDTH_PX) || 1200;
const DEFAULT_MAX_HEIGHT_PX = Number(process.env.PLACES_MAX_HEIGHT_PX) || 800;

function maskKey(k: string) {
  if (!k) return "<empty>";
  return k.length <= 8 ? "<short>" : k.slice(0, 4) + "…" + k.slice(-4);
}

function log(...args: any[]) {
  if (DEBUG) console.log(...args);
}

// --- simple in-memory cache ---
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
type CacheEntry = { photoUri: string; expiresAt: number };
const queryCache = new Map<string, CacheEntry>();

function getCachedPhoto(query: string) {
  const entry = queryCache.get(query);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    queryCache.delete(query);
    return undefined;
  }
  return entry.photoUri;
}

function setCachedPhoto(query: string, uri: string) {
  queryCache.set(query, { photoUri: uri, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function safeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return "<no-body>";
  }
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}


const BAD_TYPES = new Set([
  "accounting","bank","insurance_agency","lawyer","real_estate_agency",
  "post_office","car_dealer","car_rental","car_repair","car_wash","gas_station",
  "restaurant","cafe","bar","night_club","shopping_mall","store","gym",
  "church","mosque","synagogue","school","university"
]);

const COMMERCIAL_HINTS =
  /(commercial|retail|office|warehouse|industrial|chamber of commerce|bookkeeping|business|mall|plaza|center|company|inc\b|llc\b|suite\s*#?\d+|unit\s*\d+)/i;

const looksCommercial = (p: { displayName?: { text?: string }, types?: string[] }) =>
  COMMERCIAL_HINTS.test(p.displayName?.text || "") ||
  (Array.isArray(p.types) && p.types.some((t: string) => BAD_TYPES.has(t)));

const residentialish = (p: { types?: string[] }) =>
  Array.isArray(p.types) && p.types.some((t: string) =>
    ["premise","street_address","route","locality","sublocality","neighborhood","plus_code"].includes(t)
  );

export async function fetchVerifiedImage(
  rawQuery: string,
  opts?: {
    locationHint?: string;
    includedType?: string;
    maxWidthPx?: number;
    maxHeightPx?: number;
    languageCode?: string;
    regionCode?: string;

    lat?: number;
    lng?: number;
    photoIndex?: number;
  }
): Promise<string | null> {
  try {
    const cached = getCachedPhoto(rawQuery);
    if (cached !== undefined) {
      console.log(`[Places] cache hit for "${rawQuery}"`);
      return cached;
    }

    if (!API_KEY) return null;

    const maxWidthPx  = opts?.maxWidthPx  ?? DEFAULT_MAX_WIDTH_PX;
    const maxHeightPx = opts?.maxHeightPx ?? DEFAULT_MAX_HEIGHT_PX;
    const languageCode = opts?.languageCode ?? "en";
    const regionCode   = opts?.regionCode   ?? "US";
    const photoIndex   = opts?.photoIndex ?? 0;

    const seen = new Set<string>();
    const queries: string[] = [];
    const add = (q: string | undefined) => {
      const val = q?.trim();
      if (val && !seen.has(val)) {
        queries.push(val);
        seen.add(val);
      }
    };

    const cleanedRaw = rawQuery
      .replace(/[’'&]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    add([rawQuery, opts?.locationHint].filter(Boolean).join(" "));
    add(rawQuery);

    if (opts?.includedType) {
      add([rawQuery, opts.includedType, opts.locationHint]
        .filter(Boolean)
        .join(" "));
      add([rawQuery, opts.includedType].filter(Boolean).join(" "));
    }

    if (cleanedRaw && cleanedRaw !== rawQuery) {
      add([cleanedRaw, opts?.locationHint].filter(Boolean).join(" "));
    }

    
    add(`${rawQuery} house`);
    add(`${rawQuery} home`);
    add(`${rawQuery} residential`);

   
    const headersSearch: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "places.id",
    };

   
    const headersDetails: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "id,photos,types,location",
    };

    log(" PLACES_DEBUG=ON  key=", maskKey(API_KEY));
    log(" queries to try:", queries);

    let photoUrl: string | null = null;

    for (const textQuery of queries) {
      const body: any = {
        textQuery,
        maxResultCount: 5,
        languageCode,
        regionCode,
      };

      if (typeof opts?.lat === "number" && typeof opts?.lng === "number") {
        body.locationBias = {
          rectangle: {
            low:  { latitude: opts.lat - 0.1, longitude: opts.lng - 0.1 },
            high: { latitude: opts.lat + 0.1, longitude: opts.lng + 0.1 },
          },
        };
      }

      if (opts?.includedType) {
        body.includedType = opts.includedType;
      }

      log("POST searchText payload:", JSON.stringify(body));
      const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: headersSearch,
        body: JSON.stringify(body),
      });

      if (!searchRes.ok) {
        const err = await safeText(searchRes as unknown as Response);
        console.warn("Text Search error:", searchRes.status, err);
        continue;
      }
      log(" searchText status:", searchRes.status);

      const search = (await searchRes.json()) as {
        places?: Array<{ id: string }>;
      };

      const placesLen = search.places?.length || 0;
      console.log(`[Places] query="${textQuery}" -> places: ${placesLen}`);
      if (!placesLen) continue;

      // --- Traer detalles por ID y elegir una foto válida ---
      let chosenPhotoName: string | undefined;

      for (const cand of (search.places || []).slice(0, 5)) {
        try {
          const detRes = await fetch(
            `https://places.googleapis.com/v1/places/${cand.id}`,
            { headers: headersDetails }
          );

          if (!detRes.ok) {
            log("details error", detRes.status, await safeText(detRes as unknown as Response));
            continue;
          }

          const det = await detRes.json() as {
            id: string;
            types?: string[];
            photos?: Array<{ name: string }>;
            // location?: { latitude:number; longitude:number }
          };

          // filtros con types (Essentials en Details)
          if (!det.photos?.length) continue;
          if (looksCommercial({ types: det.types, displayName: { text: "" } })) continue;
          if (!residentialish({ types: det.types })) continue;

          const ph = det.photos[photoIndex] ?? det.photos[0];
          if (ph?.name) {
            chosenPhotoName = ph.name;
            break;
          }
        } catch (e) {
          log("details fetch err", e);
        }
      }

      if (!chosenPhotoName) {
        console.log(`No usable photo after Details for "${textQuery}"`);
        continue;
      }

      const photoName = chosenPhotoName;
      console.log("[Places] photoName:", photoName, `[#${photoIndex}]`);

      const mediaUrl =
        `https://places.googleapis.com/v1/${photoName}/media` +
        `?maxWidthPx=${maxWidthPx}&maxHeightPx=${maxHeightPx}&skipHttpRedirect=true`;

      log("GET media:", mediaUrl);
      const photoRes = await fetch(mediaUrl, {
        headers: { "X-Goog-Api-Key": API_KEY },
      });

      const contentType = photoRes.headers.get("content-type") || "";
      log("media status:", photoRes.status, "ct:", contentType);

      if (!photoRes.ok) {
        const err = await safeText(photoRes as unknown as Response);
        console.warn("Photos media error:", photoRes.status, err);
        continue;
      }

      if (contentType.includes("application/json")) {
        const j = (await photoRes.json()) as { photoUri?: string };
        log("media JSON:", j);
        if (j.photoUri) {
          photoUrl = j.photoUri.startsWith("http")
            ? j.photoUri
            : `https:${j.photoUri}`;
          console.log("Foto encontrada:", photoUrl);
        } else {
          log("media JSON sin photoUri");
        }
      } else {
        const loc = photoRes.headers.get("location");
        log("media redirect Location:", loc);
        if (loc) {
          photoUrl = loc.startsWith("http") ? loc : `https:${loc}`;
          console.log("Foto (Location):", photoUrl);
        }
      }

      if (photoUrl) break;

      await delay(200);
    }

    if (photoUrl) {
      // Guarda en cache (opcional)
      setCachedPhoto(rawQuery, photoUrl);
      return photoUrl;
    }

    console.log("exhaust queries without usable photo for:", rawQuery);
    return null;
  } catch (e) {
    console.error("fetchVerifiedImage() error:", e);
    return null;
  }
}
