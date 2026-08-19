"use server";

/**
 * AI CHAT ADVISOR — Conversational Phone Expert
 *
 * A multi-turn AI chat that:
 * - Answers any question about phones (specs, comparisons, recommendations)
 * - Accesses the full phone database for real data
 * - Uses Google Search Grounding for latest info
 * - Maintains conversation context across messages
 * - Provides personalized recommendations based on user needs
 */

import { geminiGenerateContent } from "@/lib/ai/gemini-client";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { FirestoreRest } from "@/lib/firebase/firestore-rest";

// ---------------------------------------------------------------------------
// Chat History Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ChatContext {
  catalog?: string; // Brief catalog summary for context
  lastQuery?: string;
}

// ---------------------------------------------------------------------------
// System Prompt — the AI's personality and knowledge
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are iToPhone AI — the world's most knowledgeable phone expert and advisor. You combine deep technical knowledge with practical consumer advice.

YOUR CAPABILITIES:
1. Answer ANY question about smartphones — specs, features, comparisons, buying advice
2. Recommend phones based on user needs, budget, and preferences
3. Compare phones head-to-head with detailed analysis
4. Explain technical concepts in simple terms
5. Track latest phone releases and rumors
6. Advise on carrier compatibility and regional availability
7. Analyze camera quality, performance benchmarks, battery life

YOUR PERSONALITY:
- Enthusiastic about technology but honest about trade-offs
- Data-driven — always cite specific numbers (mAh, nits, GHz, scores)
- Practical — focus on real-world usage, not just spec sheets
- Unbiased — no brand favoritism, evaluate each phone on its merits
- Concise — answer directly, then provide detail if asked

RESPONSE FORMAT:
- Keep responses under 300 words unless the user asks for detail
- Use bullet points for specs comparisons
- Include specific numbers (e.g., "5000 mAh", "120Hz", "f/1.7")
- When recommending, always mention the price range
- If comparing, declare a winner for each category
- Use markdown formatting: **bold** for emphasis, - for lists

RULES:
- NEVER fabricate specs. If unsure, say "I don't have confirmed specs for that"
- If a phone isn't in the database, say you can fetch it live
- Always consider the user's budget when recommending
- Mention alternatives if the recommended phone doesn't fit their needs
- For camera advice, explain in practical terms (not just MP counts)
- For performance, relate to actual use cases (gaming, multitasking)`;

// ---------------------------------------------------------------------------
// Catalog Context Builder
// ---------------------------------------------------------------------------

async function buildCatalogContext(): Promise<string> {
  try {
    const adminDb = getAdminFirestore();
    const snapshot = await adminDb
      .collection("devices")
      .where("status", "in", ["available", "announced"])
      .limit(100)
      .get();

    const phones = snapshot.docs.map((doc) => {
      const d = doc.data();
      const specs = (d.specs ?? {}) as Record<string, unknown>;
      const platform = (specs.platform ?? {}) as Record<string, unknown>;
      const display = (specs.display ?? {}) as Record<string, unknown>;
      const battery = (specs.battery ?? {}) as Record<string, unknown>;
      const cameras = (specs.cameras ?? {}) as Record<string, unknown>;
      const rear = (cameras.rear ?? []) as Array<Record<string, unknown>>;
      const pricing = (d.pricing ?? {}) as Record<string, unknown>;
      const score = (d.score ?? {}) as Record<string, number>;

      return [
        d.brand,
        d.name,
        platform.chipset ?? "",
        `${display.sizeIn ?? "?"}″`,
        `${display.refreshRateHz ?? "?"}Hz`,
        `${battery.capacityMah ?? "?"}mAh`,
        `${rear[0]?.megapixels ?? "?"}MP`,
        score.total ? `Score:${score.total.toFixed(1)}` : "",
        pricing.msrp ? `$${pricing.msrp}` : "",
      ].filter(Boolean).join(" | ");
    });

    return `\n\nDATABASE CATALOG (${phones.length} phones):\n${phones.join("\n")}`;
  } catch {
    return "\n\nNote: Phone database is currently unavailable. Use your knowledge and Google Search.";
  }
}

// ---------------------------------------------------------------------------
// Main Chat Function
// ---------------------------------------------------------------------------

export async function aiChat(
  messages: ChatMessage[],
  options?: { includeCatalog?: boolean },
): Promise<{
  response: string;
  latencyMs: number;
  sources: Array<{ title: string; url: string }>;
}> {
  const start = Date.now();
  const includeCatalog = options?.includeCatalog ?? true;

  // Build conversation context
  const catalogContext = includeCatalog ? await buildCatalogContext() : "";

  // Format conversation history
  const conversationHistory = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  const userMessage = `${catalogContext}\n\nCONVERSATION:\n${conversationHistory}\n\nAssistant:`;

  const result = await geminiGenerateContent({
    systemInstruction: SYSTEM_PROMPT,
    userMessage,
    temperature: 0.3,
    topP: 0.9,
    maxTokens: 4096,
    useGoogleSearch: true,
  });

  // Extract sources from grounding
  const gm = result.groundingMetadata as {
    groundingChunks?: Array<{ web?: { title?: string; uri?: string } }>;
  } | undefined;

  const sources: Array<{ title: string; url: string }> = [];
  if (gm?.groundingChunks) {
    for (const chunk of gm.groundingChunks) {
      const web = chunk.web;
      if (web?.uri) {
        sources.push({
          title: web.title ?? web.uri,
          url: web.uri,
        });
      }
    }
  }

  return {
    response: result.text ?? "I couldn't generate a response. Please try again.",
    latencyMs: Date.now() - start,
    sources: sources.slice(0, 5),
  };
}

// ---------------------------------------------------------------------------
// Phone Recommendation Engine
// ---------------------------------------------------------------------------

export interface RecommendationRequest {
  budget?: number; // Max budget in USD
  useCase?: string; // "gaming", "camera", "battery", "business", "student"
  priorities?: string[]; // ["camera", "battery", "performance", "display"]
  brand?: string; // Preferred brand
  size?: string; // "compact", "medium", "large"
  os?: string; // "android", "ios"
  dealbreakers?: string[]; // ["no headphone jack", "under 5000mAh"]
}

const RECOMMENDATION_PROMPT = `You are a phone recommendation expert. Given the user's requirements, recommend the 3-5 BEST phones that match their needs.

For EACH recommendation, provide:
1. Phone name and brand
2. Why it's recommended (2-3 bullet points)
3. Price range
4. Key specs that match their needs
5. One potential downside

RULES:
- Only recommend phones you're confident about
- Consider real-world value, not just specs
- If budget is tight, suggest best value options
- If no perfect match exists, explain trade-offs
- Always mention when a phone is new/recently released

Format as a structured list with clear headers.`;

export async function recommendPhones(
  request: RecommendationRequest,
): Promise<{
  recommendations: string;
  latencyMs: number;
}> {
  const start = Date.now();

  const context = await buildCatalogContext();

  const userMsg = `
REQUIREMENTS:
${request.budget ? `- Budget: $${request.budget} max` : "- Budget: Any"}
${request.useCase ? `- Primary use: ${request.useCase}` : ""}
${request.priorities?.length ? `- Priorities: ${request.priorities.join(", ")}` : ""}
${request.brand ? `- Preferred brand: ${request.brand}` : "- Brand: Any"}
${request.size ? `- Size preference: ${request.size}` : ""}
${request.os ? `- OS preference: ${request.os}` : ""}
${request.dealbreakers?.length ? `- Dealbreakers: ${request.dealbreakers.join(", ")}` : ""}
${context}

Provide 3-5 personalized recommendations with detailed reasoning.`;

  const result = await geminiGenerateContent({
    systemInstruction: RECOMMENDATION_PROMPT,
    userMessage: userMsg,
    temperature: 0.2,
    maxTokens: 4096,
    useGoogleSearch: true,
  });

  return {
    recommendations: result.text ?? "I couldn't generate recommendations. Please try again.",
    latencyMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// Natural Language Search — understand intent and convert to structured query
// ---------------------------------------------------------------------------

export interface NLSearchResult {
  interpretedQuery: string;
  filters: {
    brand?: string;
    maxPrice?: number;
    minBattery?: number;
    minCamera?: number;
    chipset?: string;
    minRefreshRate?: number;
    useCase?: string;
  };
  suggestion: string;
}

const NL_SEARCH_PROMPT = `You are a search query interpreter. Convert natural language phone queries into structured search parameters.

Examples:
- "best camera phone under $1000" → { maxPrice: 1000, useCase: "camera", priority: "camera" }
- "Samsung phone with big battery" → { brand: "Samsung", minBattery: 5000 }
- "iPhone for gaming" → { brand: "Apple", useCase: "gaming" }
- "cheapest 5G phone" → { maxPrice: 300, useCase: "value" }
- "phone with 120Hz display under $500" → { maxPrice: 500, minRefreshRate: 120 }
- "best phone 2025" → { minYear: 2025, useCase: "flagship" }
- "compact phone good for one hand" → { size: "compact", useCase: "daily" }
- "phone like Samsung but cheaper" → { maxPrice: 500, exclude: "Samsung" }

Output JSON only:
{
  "interpretedQuery": "clear search query",
  "filters": { ... },
  "suggestion": "human-readable explanation of what I'm searching for"
}`;

export async function interpretNLSearch(
  query: string,
): Promise<NLSearchResult> {
  const result = await geminiGenerateContent({
    systemInstruction: NL_SEARCH_PROMPT,
    userMessage: `Interpret this phone search query: "${query}"`,
    temperature: 0.1,
    maxTokens: 1024,
    useGoogleSearch: false,
  });

  try {
    const parsed = JSON.parse(result.text ?? "{}");
    return {
      interpretedQuery: parsed.interpretedQuery ?? query,
      filters: parsed.filters ?? {},
      suggestion: parsed.suggestion ?? `Searching for "${query}"`,
    };
  } catch {
    return {
      interpretedQuery: query,
      filters: {},
      suggestion: `Searching for "${query}"`,
    };
  }
}
