import { genkit } from "genkit";
import { googleAI, gemini15Pro, geminiEmbedding001 } from "@genkit-ai/googleai";
import { GEMINI_API_KEY, EMBEDDING_DIMENSION } from "./config";

/**
 * Firebase Genkit runtime: Google AI plugin wired for the iToPhone
 * pipeline. `gemini15Pro` normalizes raw scraped specs into typed JSON;
 * `geminiEmbedding001` produces the vectors stored alongside every device
 * for Firestore Native Vector Search. We pin `outputDimensionality` to
 * EMBEDDING_DIMENSION (768) so vectors match the deployed vector index.
 */
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: GEMINI_API_KEY,
    }),
  ],
  model: gemini15Pro,
});

export const specNovaEmbedder = geminiEmbedding001;

export async function embedDeviceContent(content: string): Promise<number[]> {
  const [result] = await ai.embed({
    embedder: specNovaEmbedder,
    content,
    options: { outputDimensionality: EMBEDDING_DIMENSION },
  });
  const embedding = result?.embedding;
  if (!embedding?.length) {
    throw new Error("Genkit embed returned an empty vector.");
  }
  if (embedding.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Unexpected embedding dimension ${embedding.length} (expected ${EMBEDDING_DIMENSION}).`,
    );
  }
  return embedding;
}
