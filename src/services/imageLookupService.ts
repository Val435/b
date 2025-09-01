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

function dumpPlace(p: any, i: number) {
  const types = Array.isArray(p.types) ? p.types.slice(0, 5).join(",") : "";
  const photosLen = Array.isArray(p.photos) ? p.photos.length : 0;
  const name = p.displayName?.text ?? p.id ?? "<no-name>";
  const status = p.businessStatus ?? "<no-status>";
  log(
    `    #${i + 1} ${name}\n` +
      `       id=${p.id}\n` +
      `       status=${status} types=[${types}]\n` +
      `       photos=${photosLen}`
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Filtros anti-comercial y preferencia residencial ---
const BAD_TYPES = new Set([
  "accounting","bank","insurance_agency","lawyer","real_estate_agency",
  "post_office","car_dealer","car_rental","car_repair","car_wash","gas_station",
  "restaurant","cafe","bar","night_club","shopping_mall","store","gym",
  "church","mosque","synagogue","school","university"
]);

const COMMERCIAL_HINTS =
  /(commercial|retail|office|warehouse|industrial|chamber of commerce|bookkeeping|business|mall|plaza|center|company|inc\b|llc\b|suite\s*#?\d+|unit\s*\d+)/i;

const looksCommercial = (p: any) =>
  COMMERCIAL_HINTS.test(p.displayName?.text || "") ||
  (Array.isArray(p.types) && p.types.some((t: string) => BAD_TYPES.has(t)));

const residentialish = (p: any) =>
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
    const normQuery = cleanedRaw.toLowerCase();

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

    // 👇 sesgo a residencial (quitamos “business/building”)
    add(`${rawQuery} house`);
    add(`${rawQuery} home`);
    add(`${rawQuery} residential`);

    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.photos,places.types,places.businessStatus,places.location,places.rating",
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
        headers: baseHeaders,
        body: JSON.stringify(body),
      });

      if (!searchRes.ok) {
        const err = await safeText(searchRes);
        console.warn("Text Search error:", searchRes.status, err);
        continue;
      }
      log(" searchText status:", searchRes.status);

      const search = (await searchRes.json()) as {
        places?: Array<{
          id: string;
          displayName?: { text?: string };
          photos?: Array<{ name: string }>;
          businessStatus?: string;
          types?: string[];
        }>;
      };

      const placesLen = search.places?.length || 0;
      console.log(`[Places] query="${textQuery}" -> places: ${placesLen}`);
      if (!placesLen) continue;

      search.places!.slice(0, 5).forEach((p, i) => dumpPlace(p, i));
      const withPhotos = search.places!.filter((p) => p.photos?.length);
      log(`    candidates with photos: ${withPhotos.length}`);

      // --- filtro y ranking residencial ---
      const ranked = (search.places || [])
        .filter((p) => p.photos?.length)
        .filter((p) => !looksCommercial(p))
        .sort((a, b) => Number(residentialish(b)) - Number(residentialish(a)));

      if (!ranked.length) {
        console.log(`All candidates looked commercial for "${textQuery}"`);
        continue;
      }

      const place =
        ranked.find((p) => p.displayName?.text?.toLowerCase().includes(normQuery)) ||
        ranked.find((p) => p.businessStatus === "OPERATIONAL") ||
        ranked[0];

      if (!place?.photos?.length) {
        const top = ranked?.[0];
        const types = top?.types?.slice(0, 5).join(",") ?? "";
        console.log(
          `Ranked places but no photos (types=[${types}] status=${top?.businessStatus})`
        );
        continue;
      }

      log(
        "chosen place:",
        place.displayName?.text,
        "status=",
        place.businessStatus,
        "types=",
        place.types?.slice(0, 5),
        "photos=",
        place.photos?.length
      );

      const photo = place.photos[photoIndex];
      if (!photo) {
        console.log(
          `[Places] place has only ${place.photos.length} photos, missing index ${photoIndex}`
        );
        continue;
      }
      const photoName = photo.name;
      console.log(
        "[Places] photoName:",
        photoName,
        "for",
        place.displayName?.text,
        `[#${photoIndex}]`
      );

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
        const err = await safeText(photoRes);
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
      return photoUrl;
    }

    console.log("exhaust queries without usable photo for:", rawQuery);
    return null;
  } catch (e) {
    console.error("fetchVerifiedImage() error:", e);
    return null;
  }
}
