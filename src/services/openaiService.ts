import dotenv from "dotenv";
import { getOpenAI } from "./openai/client";
import { mainPrompt, detailsPrompt } from "./openai/prompts";
import { coreSchema, areaDetailsSchema } from "./openai/schemas";
import { zodTextFormat } from "openai/helpers/zod";
import { mergeAreas } from "./openai/mappers/mergeAreas";
import { sanitizeImages } from "./openai/mappers/images/sanitizeImages";

dotenv.config();

// ===== Helpers =====

// Escapa caracteres problemáticos al enviar JSON
function safeJSONStringify(obj: any) {
  return JSON.stringify(obj)
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// Sanitiza el texto crudo devuelto por OpenAI antes de JSON.parse
function sanitizeOpenAIResponseText(text: string) {
  return text
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
    .replace(/(\r\n|\n|\r)/g, "\\n") // normaliza saltos de línea
    .replace(/([^\\])"/g, '$1\\"');  // escapa comillas no escapadas
}

// Controla concurrencia de promesas
async function mapWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const p = (async () => {
      const r = await fn(item);
      results.push(r);
    })();

    executing.push(p);
    if (executing.length >= limit) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(e => e === p), 1);
    }
  }
  await Promise.all(executing);
  return results;
}

// ===== Main service =====
export async function fetchRecommendationsFromOpenAI(userProfile: any) {
  const openai = getOpenAI();

  // === 1. Obtener recomendaciones iniciales ===
  const coreResp = await openai.responses.parse({
    model: "gpt-4o-2024-08-06",
    tools: [{ type: "web_search_preview" }],
    input: [
      { role: "system", content: mainPrompt },
      { role: "user", content: safeJSONStringify(userProfile) },
    ],
    text: {
      format: zodTextFormat(coreSchema, "core_reco"),
      transformer: sanitizeOpenAIResponseText, // 🔑 Sanitización al parsear
    },
    temperature: 0.3,
    max_output_tokens: 1600,
  });

  const core = coreResp.output_parsed;

  if (!core || !core.recommendedAreas) {
    throw new Error("Failed to get recommended areas from OpenAI response.");
  }

  // === 2. Obtener detalles de cada área (con límite de concurrencia) ===
  const detailsList = await mapWithConcurrencyLimit(
    core.recommendedAreas,
    3, // máximo 3 requests simultáneos
    async (area: any) => {
      const safeArea = JSON.parse(safeJSONStringify(area));
      const resp = await openai.responses.parse({
        model: "gpt-4o-2024-08-06",
        tools: [{ type: "web_search_preview" }],
        input: [
          { role: "system", content: detailsPrompt },
          { role: "user", content: safeJSONStringify({ userProfile, area: safeArea }) },
        ],
        text: {
          format: zodTextFormat(areaDetailsSchema, "area_details"),
          transformer: sanitizeOpenAIResponseText, // 🔑 sanitización aplicada también aquí
        },
        temperature: 0.3,
        max_output_tokens: 3000,
      });
      return resp.output_parsed;
    }
  );

  // === 3. Merge + sanitización final de imágenes ===
  const mergedAreas = mergeAreas(core, detailsList);
  const finalResult = {
    recommendedAreas: mergedAreas,
    propertySuggestion: core.propertySuggestion,
  };

  return await sanitizeImages(finalResult);
}