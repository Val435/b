import dotenv from "dotenv";
dotenv.config();

import { getOpenAI } from "./openai/client";
import { systemPromptCore, systemPromptDetails } from "./openai/prompts";
import { coreSchema, areaDetailsSchema } from "./openai/schemas";
import { zodTextFormat } from "openai/helpers/zod";
import { mergeAreas } from "./openai/mappers/mergeAreas";
import { sanitizeImages } from "./openai/mappers/images/sanitizeImages";


export async function fetchRecommendationsFromOpenAI(userProfile: any) {
  const openai = getOpenAI();

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

  const core = coreResp.output_parsed;

  if (!core || !core.recommendedAreas) {
    throw new Error("Failed to get recommended areas from OpenAI response.");
  }

  const detailsList = await Promise.all(
    core.recommendedAreas.map((area: any) =>
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
      }).then(r => r.output_parsed)
    )
  );

  const mergedAreas = mergeAreas(core, detailsList);
  const finalResult = { recommendedAreas: mergedAreas, propertySuggestion: core.propertySuggestion };
  return await sanitizeImages(finalResult);
}
