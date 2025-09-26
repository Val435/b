// src/services/imageLookupService.ts

import dotenv from "dotenv";
dotenv.config();

import { setGlobalDispatcher, Agent } from "undici";
setGlobalDispatcher(
  new Agent({
    connect: { timeout: Number(process.env.UNDICI_CONNECT_TIMEOUT_MS) || 20_000 },
  })
);

const API_KEY =
  process.env.GOOGLE_MAPS_KEY ||
  process.env.GOOGLE_PLACES_API_KEY ||
  "";

if (!API_KEY) {
  console.warn(" Missing GOOGLE_MAPS_KEY / GOOGLE_PLACES_API_KEY in .env");
}

const DEBUG = (process.env.PLACES_DEBUG || "").toLowerCase() === "true";

const DEFAULT_MAX_WIDTH_PX = Number(process.env.PLACES_MAX_WIDTH_PX) || 1200;
const DEFAULT_MAX_HEIGHT_PX = Number(process.env.PLACES_MAX_HEIGHT_PX) || 800;

const REQ_TIMEOUT_MS = Number(process.env.IMAGES_HTTP_TIMEOUT_MS) || 15_000;
const REQ_RETRIES = Number(process.env.IMAGES_HTTP_RETRIES) || 2;

function maskKey(k: string) {
  if (!k) return "<empty>";
  return k.length <= 8 ? "<short>" : k.slice(0, 4) + "…" + k.slice(-4);
}

function log(...args: any[]) {
  if (DEBUG) console.log(...args);
}

// ✅ Caché mejorado: incluye place_id
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour
type CacheEntry = { 
  photoUri: string; 
  placeId?: string;
  totalPhotos?: number;
  expiresAt: number 
};
const queryCache = new Map<string, CacheEntry>();

// ✅ Caché específico de place_id por query base (sin photoIndex)
const placeIdCache = new Map<string, { placeId: string; totalPhotos: number }>();

function getCachedPhoto(query: string) {
  const entry = queryCache.get(query);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    queryCache.delete(query);
    return undefined;
  }
  return entry.photoUri;
}

function setCachedPhoto(query: string, uri: string, placeId?: string, totalPhotos?: number) {
  queryCache.set(query, { 
    photoUri: uri, 
    placeId,
    totalPhotos,
    expiresAt: Date.now() + CACHE_TTL_MS 
  });
}

function getCachedPlaceId(baseQuery: string) {
  return placeIdCache.get(baseQuery);
}

function setCachedPlaceId(baseQuery: string, placeId: string, totalPhotos: number) {
  placeIdCache.set(baseQuery, { placeId, totalPhotos });
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

function isRetryable(err: any, res?: Response | null) {
  const code = err?.cause?.code || err?.code;
  const msg = String(err?.message || err || "");
  if (res) {
    if (res.status === 429) return true;
    if (res.status >= 500) return true;
  }
  return (
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    /network|timeout|EAI_AGAIN|ECONNREFUSED|ENOTFOUND/i.test(msg)
  );
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = REQ_TIMEOUT_MS
): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(new Error("timeout")), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ac.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function fetchJsonWithRetry<T = any>(
  url: string,
  init: RequestInit,
  retries = REQ_RETRIES,
  timeoutMs = REQ_TIMEOUT_MS
): Promise<{ ok: boolean; status: number; json: T | null; res: Response | null }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs);
      if (!res.ok) {
        const okToRetry = isRetryable(null, res);
        if (!okToRetry || attempt === retries) {
          let body = "";
          try {
            body = await safeText(res);
          } catch {}
          console.warn("HTTP non-OK:", res.status, url, body.slice(0, 200));
          return { ok: false, status: res.status, json: null, res };
        }
        await delay(400 * (attempt + 1));
        continue;
      }
      const json = (await res.json()) as T;
      return { ok: true, status: res.status, json, res };
    } catch (err) {
      const willRetry = attempt < retries && isRetryable(err);
      console.warn(
        "fetchJsonWithRetry fail:",
        url,
        (err as any)?.cause?.code || (err as any)?.message,
        "attempt",
        attempt,
        "retry?",
        willRetry
      );
      if (!willRetry) return { ok: false, status: 0, json: null, res: null };
      await delay(400 * (attempt + 1));
    }
  }
  return { ok: false, status: 0, json: null, res: null };
}

async function fetchWithRetryRaw(
  url: string,
  init: RequestInit,
  retries = REQ_RETRIES,
  timeoutMs = REQ_TIMEOUT_MS
): Promise<Response | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs);
      if (!res.ok) {
        const okToRetry = isRetryable(null, res);
        if (!okToRetry || attempt === retries) return res;
        await delay(400 * (attempt + 1));
        continue;
      }
      return res;
    } catch (err) {
      const willRetry = attempt < retries && isRetryable(err);
      console.warn(
        "fetchWithRetryRaw fail:",
        url,
        (err as any)?.cause?.code || (err as any)?.message,
        "attempt",
        attempt,
        "retry?",
        willRetry
      );
      if (!willRetry) return null;
      await delay(400 * (attempt + 1));
    }
  }
  return null;
}

const BAD_TYPES = new Set([
  "accounting",
  "bank",
  "insurance_agency",
  "lawyer",
  "real_estate_agency",
  "post_office",
  "car_dealer",
  "car_rental",
  "car_repair",
  "car_wash",
  "gas_station",
  "restaurant",
  "cafe",
  "bar",
  "night_club",
  "shopping_mall",
  "store",
  "gym",
  "church",
  "mosque",
  "synagogue",
  "school",
  "university",
]);

const COMMERCIAL_HINTS =
  /(commercial|retail|office|warehouse|industrial|chamber of commerce|bookkeeping|business|mall|plaza|center|company|inc\b|llc\b|suite\s*#?\d+|unit\s*\d+)/i;

const looksCommercial = (p: {
  displayName?: { text?: string };
  types?: string[];
}) =>
  COMMERCIAL_HINTS.test(p.displayName?.text || "") ||
  (Array.isArray(p.types) && p.types.some((t: string) => BAD_TYPES.has(t)));

const residentialish = (p: { types?: string[] }) =>
  Array.isArray(p.types) &&
  p.types.some((t: string) =>
    [
      "premise",
      "street_address",
      "route",
      "locality",
      "sublocality",
      "neighborhood",
      "plus_code",
    ].includes(t)
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
    mode?: "area" | "property" | "poi";
  }
): Promise<string | null> {
  try {
    const photoIndex = opts?.photoIndex ?? 0;
    const cacheKey = `${rawQuery}:${photoIndex}`;

    // ✅ Verificar caché de foto específica
    const cached = getCachedPhoto(cacheKey);
    if (cached !== undefined) {
      console.log(`[Places] 💾 Cache hit for "${rawQuery}" [#${photoIndex}]`);
      return cached;
    }

    if (!API_KEY) return null;

    const maxWidthPx = opts?.maxWidthPx ?? DEFAULT_MAX_WIDTH_PX;
    const maxHeightPx = opts?.maxHeightPx ?? DEFAULT_MAX_HEIGHT_PX;
    const languageCode = opts?.languageCode ?? "en";
    const regionCode = opts?.regionCode ?? "US";
    const mode = opts?.mode ?? "area";

    // ✅ Crear key base (sin photoIndex) para caché de place_id
    const baseQueryKey = `${rawQuery}:${opts?.locationHint || ""}:${opts?.includedType || ""}:${mode}`;

    // ✅ Verificar si ya tenemos el place_id cacheado
    const cachedPlaceData = getCachedPlaceId(baseQueryKey);
    let placeId: string | null = cachedPlaceData?.placeId || null;
    let totalPhotos: number | undefined = cachedPlaceData?.totalPhotos;

    // ✅ Si NO tenemos place_id, hacer Text Search
    if (!placeId) {
      console.log(`[Places] 🔍 Searching for "${rawQuery}"...`);

      const seen = new Set<string>();
      const queries: string[] = [];
      const add = (q: string | undefined) => {
        const val = q?.trim();
        if (val && !seen.has(val)) {
          queries.push(val);
          seen.add(val);
        }
      };

      const cleanedRaw = rawQuery.replace(/[''&]/g, " ").replace(/\s+/g, " ").trim();

      add([rawQuery, opts?.locationHint].filter(Boolean).join(" "));
      add(rawQuery);

      if (opts?.includedType) {
        add([rawQuery, opts.includedType, opts.locationHint].filter(Boolean).join(" "));
        add([rawQuery, opts.includedType].filter(Boolean).join(" "));
      }

      if (cleanedRaw && cleanedRaw !== rawQuery) {
        add([cleanedRaw, opts?.locationHint].filter(Boolean).join(" "));
      }

      if (mode === "property") {
        add(`${rawQuery} house`);
        add(`${rawQuery} home`);
        add(`${rawQuery} residential`);
      }

      const headersSearch: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "places.id",
      };

      log(" PLACES_DEBUG=ON  key=", maskKey(API_KEY));
      log(" queries to try:", queries);

      // ✅ Intentar Text Search (solo una vez)
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
              low: { latitude: opts.lat - 0.1, longitude: opts.lng - 0.1 },
              high: { latitude: opts.lat + 0.1, longitude: opts.lng + 0.1 },
            },
          };
        }

        if (opts?.includedType) {
          body.includedType = opts.includedType;
        }

        log("POST searchText payload:", JSON.stringify(body));
        const searchResp = await fetchJsonWithRetry<{
          places?: Array<{ id: string }>;
        }>("https://places.googleapis.com/v1/places:searchText", {
          method: "POST",
          headers: headersSearch,
          body: JSON.stringify(body),
        });

        if (!searchResp.ok || !searchResp.json?.places?.length) {
          if (!searchResp.ok)
            console.warn("Text Search error:", searchResp.status);
          continue;
        }

        const places = searchResp.json.places.slice(0, 5);
        console.log(`[Places] query="${textQuery}" -> ${places.length} places`);

        // Tomar el primer place_id
        if (places[0]?.id) {
          placeId = places[0].id;
          console.log(`[Places] ✅ Found placeId: ${placeId}`);
          break;
        }
      }

      if (!placeId) {
        console.log(`[Places] ❌ No place found for "${rawQuery}"`);
        return null;
      }
    } else {
      console.log(`[Places] ♻️ Reusing cached placeId for "${rawQuery}"`);
    }

    // ✅ Obtener Place Details (solo si no lo tenemos cacheado)
    if (totalPhotos === undefined) {
      const headersDetails: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "id,photos,types,location",
      };

      console.log(`[Places] 📋 Fetching details for placeId: ${placeId}`);
      const detRes = await fetchJsonWithRetry<{
        id: string;
        types?: string[];
        photos?: Array<{ name: string }>;
      }>(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: headersDetails,
      });

      if (!detRes.ok || !detRes.json) {
        console.warn("Place Details error");
        return null;
      }

      const det = detRes.json;
      if (!det.photos?.length) {
        console.log(`[Places] ❌ No photos for placeId: ${placeId}`);
        return null;
      }

      totalPhotos = det.photos.length;

      // ✅ Guardar place_id en caché
      setCachedPlaceId(baseQueryKey, placeId, totalPhotos);
      console.log(`[Places] 💾 Cached placeId with ${totalPhotos} photos`);

      // Aplicar filtros según mode
      const types = det.types || [];
      if (mode === "property") {
        if (looksCommercial({ types, displayName: { text: "" } })) {
          console.log(`[Places] ⚠️ Skipping commercial property`);
          return null;
        }
        if (!residentialish({ types })) {
          console.log(`[Places] ⚠️ Not residential`);
          return null;
        }
      } else if (mode === "area") {
        if (looksCommercial({ types, displayName: { text: "" } })) {
          console.log(`[Places] ⚠️ Skipping commercial area`);
          return null;
        }
      }
    }

    // ✅ Obtener la foto específica por índice
    // Volver a pedir Details para obtener el array de fotos
    const headersDetails: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask": "photos",
    };

    const detRes2 = await fetchJsonWithRetry<{
      photos?: Array<{ name: string }>;
    }>(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: headersDetails,
    });

    if (!detRes2.ok || !detRes2.json?.photos?.length) {
      console.warn("Cannot get photos array");
      return null;
    }

    const photos = detRes2.json.photos;
    const ph = photos[photoIndex] ?? photos[0];

    if (!ph?.name) {
      console.log(`[Places] ❌ No photo at index ${photoIndex}`);
      return null;
    }

    const photoName = ph.name;
    console.log(`[Places] 📸 Photo: ${photoName} [#${photoIndex}/${photos.length}]`);

    // ✅ Obtener URL de la foto
    const mediaUrl =
      `https://places.googleapis.com/v1/${photoName}/media` +
      `?maxWidthPx=${maxWidthPx}&maxHeightPx=${maxHeightPx}&skipHttpRedirect=true`;

    log("GET media:", mediaUrl);
    const photoRes = await fetchWithRetryRaw(mediaUrl, {
      headers: { "X-Goog-Api-Key": API_KEY },
    });

    if (!photoRes) {
      console.warn("media request failed (network/timeout):", mediaUrl);
      return null;
    }

    const contentType = photoRes.headers.get("content-type") || "";
    log("media status:", photoRes.status, "ct:", contentType);

    if (!photoRes.ok) {
      const err = await safeText(photoRes as unknown as Response);
      console.warn("Photos media error:", photoRes.status, err);
      return null;
    }

    let photoUrl: string | null = null;

    if (contentType.includes("application/json")) {
      const j = (await photoRes.json()) as { photoUri?: string };
      log("media JSON:", j);
      if (j.photoUri) {
        photoUrl = j.photoUri.startsWith("http")
          ? j.photoUri
          : `https:${j.photoUri}`;
        console.log("✅ Foto encontrada:", photoUrl);
      } else {
        log("media JSON sin photoUri");
      }
    } else {
      const loc = photoRes.headers.get("location");
      log("media redirect Location:", loc);
      if (loc) {
        photoUrl = loc.startsWith("http") ? loc : `https:${loc}`;
        console.log("✅ Foto (Location):", photoUrl);
      }
    }

    if (photoUrl) {
      setCachedPhoto(cacheKey, photoUrl, placeId, totalPhotos);
      return photoUrl;
    }

    console.log(`[Places] ❌ No photo URL for "${rawQuery}" [#${photoIndex}]`);
    return null;
  } catch (e) {
    console.error("fetchVerifiedImage() error:", e);
    return null;
  }
}

export { COMMERCIAL_HINTS };