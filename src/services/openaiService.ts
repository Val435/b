import dotenv from "dotenv";
import { getOpenAI } from "./openai/client";
import { mainPrompt, detailsPrompt } from "./openai/prompts";
import { coreSchema, areaDetailsSchema } from "./openai/schemas";
import { zodTextFormat } from "openai/helpers/zod";
import { mergeAreas } from "./openai/mappers/mergeAreas";
import { sanitizeImages } from "./openai/mappers/images/sanitizeImages";
import { z } from "zod";

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

// Fallback muy simple para “arreglar” JSON casi-válido del modelo (sin libs externas)
function repairJsonLoosely(text: string): string {
  let s = String(text).trim();

  // 1) quitar code fences ```json ... ```
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();

  // 2) recortar al primer '{' y último '}' (evita prólogos/epílogos)
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }

  // 3) quitar comas colgantes antes de '}' o ']'
  //    ejemplo:  { "a": 1, }  -> { "a": 1 }
  //              [1,2,]       -> [1,2]
  s = s.replace(/,\s*([}\]])/g, "$1");

  // 4) normalizar algunos caracteres invisibles (U+2028/U+2029 rompen JSON)
  s = s.replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

  return s;
}

// Extrae el texto crudo de Responses API .create()
function extractResponseText(raw: any): string {
  return (
    raw?.output_text ??
    raw?.output?.[0]?.content?.[0]?.text ??
    ""
  );
}

// Limitador de concurrencia (pool de workers)
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

// Fallback genérico: intenta .parse(); si falla, pide texto crudo (.create), repara y valida con Zod
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
  } catch {
    // pedir respuesta cruda y reparar
    const raw = await openai.responses.create(reqArgs);
    const text = extractResponseText(raw);
    const repaired = repairJsonLoosely(text);
    const obj = JSON.parse(repaired);
    return schema.parse(obj) as T;
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
