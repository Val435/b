import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

export function getOpenAI() {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}
