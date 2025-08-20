
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function fetchVerifiedImage(placeName: string): Promise<string | null> {
  try {
    const prompt = `Provide a direct HTTPS image URL (jpg, jpeg, png or webp) representing ${placeName}. Return only the URL.`;

    const response = await openai.responses.create({
      model: "gpt-4o-2024-08-06",
      tools: [{ type: "web_search_preview" }],
      input: prompt,
      temperature: 0.2,
    });

    const url = response.output_text?.trim();
    if (!url || !/^https:\/\/\S\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(url)) {
      return null;
    }

    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) return null;

    return url;
  } catch (err) {
    console.error("fetchVerifiedImage error", err);
    return null;
  }
}
