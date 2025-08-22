// src/imageLookupService.ts
import dotenv from "dotenv";
dotenv.config();

// ── CONFIG / API KEY ──────────────────────────────────────────────────────────
const API_KEY =
  process.env.GOOGLE_MAPS_KEY ||
  process.env.GOOGLE_PLACES_API_KEY ||
  "";

if (!API_KEY) {
  console.warn("⚠️ Falta GOOGLE_MAPS_KEY / GOOGLE_PLACES_API_KEY en .env");
}

// ── DEBUG helpers ─────────────────────────────────────────────────────────────
const DEBUG = (process.env.PLACES_DEBUG || "").toLowerCase() === "true";

function maskKey(k: string) {
  if (!k) return "<empty>";
  return k.length <= 8 ? "<short>" : k.slice(0, 4) + "…" + k.slice(-4);
}

function log(...args: any[]) {
  if (DEBUG) console.log(...args);
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

/**
 * Busca una foto real para un lugar usando Google Places (New v1):
 *  1) places:searchText  -> obtiene places[].photos[].name
 *  2) photos media JSON  -> obtiene { photoUri } directo (lh3.googleusercontent.com)
 *
 * Retorna null si no hay foto utilizable.
 */
export async function fetchVerifiedImage(
  rawQuery: string,
  opts?: {
    /** Contexto geográfico para desambiguar (ej. "Austin, TX"). */
    locationHint?: string;
    /** Tipo único de lugar para sesgar la búsqueda (v1 "includedType"), p.ej. "school", "park", "shopping_mall", "stadium", "bar". */
    includedType?: string;
    /** Tamaño deseado al pedir la imagen. */
    maxWidthPx?: number;
    maxHeightPx?: number;
    /** Opcional: idioma/región para desambiguar. */
    languageCode?: string; // ej. "en"
    regionCode?: string;   // ej. "US"
    /** Opcional: sesgo por ubicación si ya tienes coordenadas. */
    lat?: number;
    lng?: number;
  }
): Promise<string | null> {
  try {
    if (!API_KEY) return null;

    const maxWidthPx  = opts?.maxWidthPx  ?? 1200;
    const maxHeightPx = opts?.maxHeightPx ?? 800;
    const languageCode = opts?.languageCode ?? "en";
    const regionCode   = opts?.regionCode   ?? "US";

    // Variantes de búsqueda (sube el hit-rate)
    const queries = [
      [rawQuery, opts?.includedType, opts?.locationHint].filter(Boolean).join(" ").trim(),
      [rawQuery, opts?.locationHint].filter(Boolean).join(" ").trim(),
      rawQuery.trim(),
      [rawQuery, opts?.includedType || "place"].filter(Boolean).join(" ").trim(),
    ].filter(Boolean);

    // Versión “laxa” del nombre (quita símbolos que a veces rompen el match)
    const cleanedRaw = rawQuery
      .replace(/[’'&]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (cleanedRaw && cleanedRaw !== rawQuery) {
      queries.push(
        [cleanedRaw, opts?.locationHint].filter(Boolean).join(" ").trim()
      );
    }

    // (Opcional) variantes extra para direcciones puras
    queries.push(`${rawQuery} building`.trim());
    queries.push(`${rawQuery} business`.trim());

    // Encabezados con FieldMask robusto (¡clave pedir photos.name!)
    const baseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": API_KEY,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.photos,places.types,places.businessStatus,places.location,places.rating",
    };

    log("🔧 PLACES_DEBUG=ON  key=", maskKey(API_KEY));
    log("🔎 queries to try:", queries);

    for (const textQuery of queries) {
      const body: any = {
        textQuery,
        maxResultCount: 5,
        languageCode,
        regionCode,
      };

      // Sesgar por ubicación si tenemos lat/lng
      if (typeof opts?.lat === "number" && typeof opts?.lng === "number") {
        body.locationBias = {
          rectangle: {
            low:  { latitude: opts.lat - 0.1, longitude: opts.lng - 0.1 },
            high: { latitude: opts.lat + 0.1, longitude: opts.lng + 0.1 },
          },
        };
      }

      // Si incluyes type y quieres sesgo fuerte por tipo:
      if (opts?.includedType) {
        body.includedType = opts.includedType;
      }

      // 1) Text Search (New v1)
      log("➡️  POST searchText payload:", JSON.stringify(body));
      const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify(body),
      });

      if (!searchRes.ok) {
        const err = await safeText(searchRes);
        console.warn("🔎 Text Search error:", searchRes.status, err);
        continue;
      }
      log("⬅️  searchText status:", searchRes.status);

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

      // Detalle de candidatos (máx 5)
      search.places!.slice(0, 5).forEach((p, i) => dumpPlace(p, i));
      const withPhotos = search.places!.filter((p) => p.photos?.length);
      log(`    candidates with photos: ${withPhotos.length}`);

      // Prioriza lugares operativos con fotos, o si no, cualquiera con fotos
      const place =
        search.places?.find(
          (p) => p.businessStatus === "OPERATIONAL" && p.photos?.length
        ) ||
        search.places?.find((p) => p.photos?.length);

      if (!place?.photos?.length) {
        const top = search.places?.[0];
        const types = top?.types?.slice(0, 5).join(",") ?? "";
        console.log(
          `📷 Lugares encontrados para "${textQuery}", pero sin fotos (ej. top types=[${types}] status=${top?.businessStatus})`
        );
        continue;
      }

      log(
        "✔️  chosen place:",
        place.displayName?.text,
        "status=",
        place.businessStatus,
        "types=",
        place.types?.slice(0, 5),
        "photos=",
        place.photos?.length
      );

      const photoName = place.photos[0].name; // "places/.../photos/..."
      console.log(
        "[Places] photoName:",
        photoName,
        "for",
        place.displayName?.text
      );

      // 2) Photos media (JSON) — skipHttpRedirect para obtener { photoUri } (lh3)
      // ❗ NO uses encodeURIComponent(photoName) ni pases &key= en la URL
      const mediaUrl =
        `https://places.googleapis.com/v1/${photoName}/media` +
        `?maxWidthPx=${maxWidthPx}&maxHeightPx=${maxHeightPx}&skipHttpRedirect=true`;

      log("➡️  GET media:", mediaUrl);
      const photoRes = await fetch(mediaUrl, {
        headers: { "X-Goog-Api-Key": API_KEY },
      });

      const contentType = photoRes.headers.get("content-type") || "";
      log("⬅️  media status:", photoRes.status, "ct:", contentType);

      if (!photoRes.ok) {
        const err = await safeText(photoRes);
        console.warn("🖼️ Photos media error:", photoRes.status, err);
        continue;
      }

      if (contentType.includes("application/json")) {
        const j = (await photoRes.json()) as { photoUri?: string };
        log("media JSON:", j);
        if (j.photoUri) {
          const uri = j.photoUri.startsWith("http")
            ? j.photoUri
            : `https:${j.photoUri}`;
          console.log("✅ Foto encontrada:", uri);
          return uri;
        } else {
          log("⚠️ media JSON sin photoUri");
        }
      } else {
        // Caso raro: si no respetara skipHttpRedirect, intentar header Location
        const loc = photoRes.headers.get("location");
        log("media redirect Location:", loc);
        if (loc) {
          const url = loc.startsWith("http") ? loc : `https:${loc}`;
          console.log("✅ Foto (Location):", url);
          return url;
        }
      }

      // Si llegamos aquí, intenta con la siguiente variante de query
      await delay(200);
    }

    console.log("🧭 exhaust queries without usable photo for:", rawQuery);
    return null;
  } catch (e) {
    console.error("fetchVerifiedImage() error:", e);
    return null;
  }
}
