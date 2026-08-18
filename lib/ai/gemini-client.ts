import "server-only";

import { GoogleGenAI } from "@google/genai";

/**
 * Gemini client — kept ONLY for embeddings (Groq handles LLM calls).
 * Embeddings use Gemini's text-embedding model for vector search.
 */

let geaiClient: InstanceType<typeof GoogleGenAI> | null = null;

export function getGeminiClient(): InstanceType<typeof GoogleGenAI> {
  if (geaiClient) return geaiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }
  geaiClient = new GoogleGenAI({ apiKey });
  return geaiClient;
}
