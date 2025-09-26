// src/services/imageLookupService.ts - OPTIMIZADO

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
  console.warn("⚠️ Missing GOOGLE_MAPS_KEY / GOOGLE_PLACES_API_KEY in .env");
}

const DEBUG = (process.env.PLACES_DEBUG || "").toLowerCase() === "true";

const DEFAULT_MAX_WIDTH_PX = Number(process.env.PLACES_MAX_WIDTH_PX) || 1200;
const DEFAULT_MAX_HEIGHT_PX = Number(process.env.PLACES_MAX_HEIGHT_PX) || 800;

const REQ_TIMEOUT_MS = Number(process.env.IMAGES_HTTP_TIMEOUT_MS) || 15_000;
const REQ_RETRIES = Number(process.env.IMAGES_HTTP_RETRIES) || 2;

function log(...args: any[]) {
  if (DEBUG) console.log(...args);
}

// ✅ Caché mejorado: incluye place_id Y photos[]
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

type CacheEntry = { 
  photoUri: string; 
  expiresAt: number 
};

type PlaceCacheEntry = {
  placeId: string;
  totalPhotos: number;
  photos: Array<{ name: string }>; // ✅ NUEVO: cachear array de fotos
  expiresAt: number;
};

const photoCache = new Map<string, CacheEntry>();
const placeCache = new Map<string, PlaceCacheEntry>();

function getCachedPhoto(query: string) {
  const entry = photoCache.get(query);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    photoCache.delete(query);
    return undefined;
  }
  return entry.photoUri;
}

function setCachedPhoto(query: string, uri: string) {
  photoCache.set(query, { 
    photoUri: uri,
    expiresAt: Date.now() + CACHE_TTL_MS 
  });
}

function getCachedPlace(baseQuery: string) {
  const entry = placeCache.get(baseQuery);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    placeCache.delete(baseQuery);
    return undefined;
  }
  return entry;
}

function setCachedPlace(
  baseQuery: string, 
  placeId: string, 
  totalPhotos: number,
  photos: Array<{ name: string }>
) {
  placeCache.set(baseQuery, { 
    placeId, 
    totalPhotos,
    photos, // ✅ NUEVO
    expiresAt: Date.now() + CACHE_TTL_MS 
  });
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
    const photoCacheKey = `${rawQuery}:${photoIndex}`;

    // ✅ 1. Verificar caché de foto específica
    const cachedPhotoUrl = getCachedPhoto(photoCacheKey);
    if (cachedPhotoUrl !== undefined) {
      log(`[Places] 💾 Photo cache hit for "${rawQuery}" [#${photoIndex}]`);
      return cachedPhotoUrl;
    }

    if (!API_KEY) return null;

    const maxWidthPx = opts?.maxWidthPx ?? DEFAULT_MAX_WIDTH_PX;
    const maxHeightPx = opts?.maxHeightPx ?? DEFAULT_MAX_HEIGHT_PX;
    const languageCode = opts?.languageCode ?? "en";
    const regionCode = opts?.regionCode ?? "US";
    const mode = opts?.mode ?? "area";

    // ✅ 2. Crear key base (sin photoIndex) para caché de place
    const baseQueryKey = `${rawQuery}:${opts?.locationHint || ""}:${opts?.includedType || ""}:${mode}`;

    // ✅ 3. Verificar si ya tenemos place_id Y photos[] cacheados
    const cachedPlace = getCachedPlace(baseQueryKey);
    let placeId: string | null = cachedPlace?.placeId || null;
    let photos: Array<{ name: string }> | null = cachedPlace?.photos || null;

    // ✅ 4. Si NO tenemos place_id, hacer Text Search + Place Details
    if (!placeId || !photos) {
      log(`[Places] 🔍 Searching for "${rawQuery}"...`);

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

      // Text Search
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
        log(`[Places] query="${textQuery}" -> ${places.length} places`);

        if (places[0]?.id) {
          placeId = places[0].id;
          log(`[Places] ✅ Found placeId: ${placeId}`);
          break;
        }
      }

      if (!placeId) {
        log(`[Places] ❌ No place found for "${rawQuery}"`);
        return null;
      }

      // Place Details (obtener photos[])
      const headersDetails: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY,
        "X-Goog-FieldMask": "id,photos,types,location",
      };

      log(`[Places] 📋 Fetching details for placeId: ${placeId}`);
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
        log(`[Places] ❌ No photos for placeId: ${placeId}`);
        return null;
      }

      photos = det.photos;

      // ✅ Cachear place_id + photos[]
      setCachedPlace(baseQueryKey, placeId, photos.length, photos);
      log(`[Places] 💾 Cached placeId with ${photos.length} photos`);
    } else {
      log(`[Places] ♻️ Reusing cached placeId + photos for "${rawQuery}"`);
    }

    // ✅ 5. Obtener foto específica del array cacheado
    if (!photos || photos.length === 0) {
      log(`[Places] ❌ No photos available`);
      return null;
    }

    const ph = photos[photoIndex] ?? photos[0];
    if (!ph?.name) {
      log(`[Places] ❌ No photo at index ${photoIndex}`);
      return null;
    }

    const photoName = ph.name;
    log(`[Places] 📸 Photo: ${photoName} [#${photoIndex}/${photos.length}]`);

    // ✅ 6. Obtener URL de la foto
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
        log("✅ Foto encontrada:", photoUrl);
      } else {
        log("media JSON sin photoUri");
      }
    } else {
      const loc = photoRes.headers.get("location");
      log("media redirect Location:", loc);
      if (loc) {
        photoUrl = loc.startsWith("http") ? loc : `https:${loc}`;
        log("✅ Foto (Location):", photoUrl);
      }
    }

    if (photoUrl) {
      setCachedPhoto(photoCacheKey, photoUrl);
      return photoUrl;
    }

    log(`[Places] ❌ No photo URL for "${rawQuery}" [#${photoIndex}]`);
    return null;
  } catch (e) {
    console.error("fetchVerifiedImage() error:", e);
    return null;
  }
}

export const COMMERCIAL_HINTS =
  /(commercial|retail|office|warehouse|industrial|chamber of commerce|bookkeeping|business|mall|plaza|center|company|inc\b|llc\b|suite\s*#?\d+|unit\s*\d+)/i;