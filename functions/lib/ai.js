"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.specNovaEmbedder = exports.ai = void 0;
exports.embedDeviceContent = embedDeviceContent;
const genkit_1 = require("genkit");
const googleai_1 = require("@genkit-ai/googleai");
const config_1 = require("./config");
/**
 * Firebase Genkit runtime: Google AI plugin wired for the iToPhone
 * pipeline. `gemini15Pro` normalizes raw scraped specs into typed JSON;
 * `geminiEmbedding001` produces the vectors stored alongside every device
 * for Firestore Native Vector Search. We pin `outputDimensionality` to
 * EMBEDDING_DIMENSION (768) so vectors match the deployed vector index.
 */
exports.ai = (0, genkit_1.genkit)({
    plugins: [
        (0, googleai_1.googleAI)({
            apiKey: config_1.GEMINI_API_KEY,
        }),
    ],
    model: googleai_1.gemini15Pro,
});
exports.specNovaEmbedder = googleai_1.geminiEmbedding001;
async function embedDeviceContent(content) {
    const [result] = await exports.ai.embed({
        embedder: exports.specNovaEmbedder,
        content,
        options: { outputDimensionality: config_1.EMBEDDING_DIMENSION },
    });
    const embedding = result?.embedding;
    if (!embedding?.length) {
        throw new Error("Genkit embed returned an empty vector.");
    }
    if (embedding.length !== config_1.EMBEDDING_DIMENSION) {
        throw new Error(`Unexpected embedding dimension ${embedding.length} (expected ${config_1.EMBEDDING_DIMENSION}).`);
    }
    return embedding;
}
//# sourceMappingURL=ai.js.map