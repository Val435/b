import dotenv from "dotenv";
import { getOpenAI } from "./openai/client";
import { mainPrompt, detailsPrompt } from "./openai/prompts";
import { coreSchema, areaDetailsSchema } from "./openai/schemas";
import { zodTextFormat } from "openai/helpers/zod";
import { mergeAreas } from "./openai/mappers/mergeAreas";
import { sanitizeImages } from "./openai/mappers/images/sanitizeImages";
import { z } from "zod";

// 👇 NUEVO
import JSON5 from "json5";
import { jsonrepair } from "jsonrepair";

dotenv.config();

// ===== Tipos inferidos de Zod =====
type CoreReco = z.infer<typeof coreSchema>;
type AreaDetails = z.infer<typeof areaDetailsSchema>;

// ===== Helpers =====

// Escapa caracteres problemáticos al enviar JSON como input del usuario.
// Importante: NO modifiques la salida del modelo.
function safeJSONStringify(obj: any) {
  return JSON.stringify(obj)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// 👇 NUEVO: utilidades de saneo/depuración para salidas del modelo
function logWindowAround(raw: string, pos: number, span = 160) {
  const start = Math.max(0, pos - span);
  const end = Math.min(raw.length, pos + span);
  // eslint-disable-next-line no-console
  console.error("✂️ JSON window (" + start + ".." + end + "):\n" + raw.slice(start, end));
}

function stripCodeFences(s: string) {
  // ```json ... ```  o  ``` ... ```
  const fence = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const m = s.match(fence);
  return m ? m[1] : s;
}

function extractLikelyJson(s: string) {
  // intenta quedarte solo con el bloque JSON principal
  const firstBrace = s.indexOf("{");
  const firstBracket = s.indexOf("[");
  const first = [firstBrace, firstBracket].filter(i => i >= 0).sort((a,b)=>a-b)[0] ?? -1;
  if (first < 0) return s;

  const lastBrace = s.lastIndexOf("}");
  const lastBracket = s.lastIndexOf("]");
  const last = Math.max(lastBrace, lastBracket);
  if (last > first) return s.slice(first, last + 1);
  return s;
}

// Fallback robusto para “arreglar” JSON casi-válido del modelo
function sanitizeAlmostJson(text: string): string {
  let s = String(text).trim();

  // 1) quitar fences y quedarnos con el bloque JSON más probable
  const fence = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const m = s.match(fence);
  if (m) s = m[1];
  // recorta desde el primer { o [
  const first = (() => {
    const a = s.indexOf("{");
    const b = s.indexOf("[");
    if (a === -1) return b;
    if (b === -1) return a;
    return Math.min(a, b);
  })();
  const last = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (first >= 0 && last > first) s = s.slice(first, last + 1);

  // 2) normalizaciones básicas
  s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  s = s.replace(/,(\s*[\]}])/g, "$1");      // comas colgantes
  s = s.replace(/}\s*{/g, "},{");           // }{ → },{
  s = s.replace(/}\s*},/g, "},");           // }}, → },
  s = s.replace(/}\s*}\s*{/g, "},{");       // }}{ → },{
  s = s.replace(/[\u0000-\u001F\u007F-\u009F]/g, ""); // control chars
  s = s.replace(/\r\n?/g, "\n");

  // 3) 🔧 FIX del caso reportado: cerraron un objeto con ']' en lugar de '}' dentro de un array de objetos.
  //    ... "prop":"valor"] , {  →  ... "prop":"valor"} , {
  //    3.1) caso específico de website (lo más común que viste)
  s = s.replace(/("website"\s*:\s*"[^"]*")\s*\]\s*,\s*\{/g, '$1}, {');
  //    3.2) genérico para cualquier propiedad string
  s = s.replace(/("[^"]*"\s*:\s*"[^"]*")\s*\]\s*,\s*\{/g, '$1}, {');
  //    3.3) genérico para boolean/null/número
  s = s.replace(/("([^"]+)"\s*:\s*(?:true|false|null|-?\d+(?:\.\d+)?))\s*\]\s*,\s*\{/g, '$1}, {');

  return s.trim();
}

function extractResponseText(raw: any): string {
  return (
    raw?.output_text ??
    raw?.output?.[0]?.content?.[0]?.text ??
    raw?.choices?.[0]?.message?.content ??
    ""
  );
}

async function mapWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const worker = async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) break;
      results[idx] = await fn(items[idx], idx);
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

async function parseWithSimpleFallback<T>(
  reqArgs: Parameters<ReturnType<typeof getOpenAI>["responses"]["parse"]>[0],
  schema: z.ZodTypeAny
): Promise<T> {
  const openai = getOpenAI();

  try {
    const r = await openai.responses.parse(reqArgs);
    const parsed = (r.output_parsed ?? null) as T | null;
    if (!parsed) throw new Error("Parsed output is null");
    return parsed;
  } catch (e0: any) {
    // pedir respuesta cruda
    const raw = await openai.responses.create(reqArgs);
    let text = extractResponseText(raw);

    // a) intento directo
    try {
      const obj = JSON.parse(text);
      return schema.parse(obj) as T;
    } catch (e1: any) {
      const m = /position (\d+)/i.exec(String(e1));
      if (m) logWindowAround(text, parseInt(m[1], 10));
    }

    // b) saneo propio (incluye FIX de '"],{' → '"},{')
    const cleaned = sanitizeAlmostJson(text);
    try {
      const obj = JSON.parse(cleaned);
      return schema.parse(obj) as T;
    } catch (e2: any) {
      const m = /position (\d+)/i.exec(String(e2));
      if (m) logWindowAround(cleaned, parseInt(m[1], 10));
    }

    // c) JSON5 (tolerante a comas colgantes, etc.)
    try {
      const obj = JSON5.parse(cleaned);
      return schema.parse(obj) as T;
    } catch {
      // sigue
    }

    // d) Reparación agresiva con jsonrepair
    try {
      const repaired = jsonrepair(cleaned);
      const obj = JSON.parse(repaired);
      return schema.parse(obj) as T;
    } catch {
      // e) Último intento: barrido amplio de cualquier '],{' remanente
      try {
        const lastResort = cleaned.replace(/\]\s*,\s*\{/g, "}, {");
        const obj = JSON.parse(lastResort);
        return schema.parse(obj) as T;
      } catch (eFinal) {
        // eslint-disable-next-line no-console
        console.error("❌ JSON irreparable. Head:\n", String(text).slice(0, 400));
        throw eFinal;
      }
    }
  }
}

// ===== Main service =====
export async function fetchRecommendationsFromOpenAI(userProfile: any) {
  const openai = getOpenAI();

  // === 1) Recomendaciones iniciales (Responses API usa text.format) ===
  const coreFmt = zodTextFormat(coreSchema, "core_reco");

  const core = await parseWithSimpleFallback<CoreReco>(
    {
      model: "gpt-4o-2024-08-06",
      tools: [{ type: "web_search_preview" }],
      input: [
        {
          role: "system",
          content:
            `${mainPrompt}\n\nReturn ONLY the JSON object. No prose. No markdown. No backticks. No trailing commas.`,
        },
        { role: "user", content: safeJSONStringify(userProfile) },
      ],
      text: { format: coreFmt },
      temperature: 0,
      max_output_tokens: 2000,
    },
    coreSchema
  );

  if (!core.recommendedAreas || core.recommendedAreas.length === 0) {
    throw new Error("Failed to get recommended areas from OpenAI response.");
  }

  // === 2) Detalles por área (con límite de concurrencia) ===
  const detailsFmt = zodTextFormat(areaDetailsSchema, "area_details");

  const detailsList = await mapWithConcurrencyLimit(
    core.recommendedAreas,
    3,
    async (area) => {
      const safeArea = JSON.parse(safeJSONStringify(area));
      return parseWithSimpleFallback<AreaDetails>(
        {
          model: "gpt-4o-2024-08-06",
          tools: [{ type: "web_search_preview" }],
          input: [
            {
              role: "system",
              content:
                `${detailsPrompt}\n\nReturn ONLY the JSON object. No prose. No markdown. No backticks. No trailing commas.`,
            },
            { role: "user", content: safeJSONStringify({ userProfile, area: safeArea }) },
          ],
          text: { format: detailsFmt },
          temperature: 0,
          max_output_tokens: 3500,
        },
        areaDetailsSchema
      );
    }
  );

  // === 3) Merge + sanitización final de imágenes ===
  const mergedAreas = mergeAreas(core, detailsList);
  const finalResult = {
    recommendedAreas: mergedAreas,
    propertySuggestion: core.propertySuggestion,
  };

  return await sanitizeImages(finalResult);
}
