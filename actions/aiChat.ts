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

const SYSTEM_PROMPT = `You are iToPhone AI — the world's most elite smartphone analyst and advisor. You have encyclopedic knowledge of EVERY smartphone ever made, from budget phones to flagships, including specs, benchmarks, real-world performance, camera sensor details, and pricing.

═══════════════════════════════════════════════════════════
CORE INTELLIGENCE
═══════════════════════════════════════════════════════════

You are NOT a generic chatbot. You are a specialized phone expert with:
- Complete knowledge of all phone specs (display, chipset, camera sensors, battery chemistry, connectivity bands)
- Real benchmark data (AnTuTu, Geekbench, DXOMARK, GSMArena battery test)
- Camera sensor knowledge (Sony IMX/LYTIA, Samsung ISOCELL, OmniVision — sensor size, pixel size, aperture, OIS type)
- Pricing history and value analysis across regions
- Carrier band compatibility worldwide
- Software update track records for every brand
- Known issues, bugs, and user complaints per model

═══════════════════════════════════════════════════════════
RESPONSE INTELLIGENCE
═══════════════════════════════════════════════════════════

WHEN COMPARING PHONES:
- ALWAYS use markdown tables as the PRIMARY format
- Create a comparison table FIRST, then add analysis below
- Declare clear winners: ✅ for winner, ❌ for loser
- Cover: Display, Chipset, Camera, Battery, Build, Price, Software
- Give an overall verdict with a clear recommendation

WHEN RECOMMENDING:
- Start with a quick summary table of top 3-5 picks
- Then detailed analysis of each pick
- Consider: budget, use case, brand preference, size preference
- Always mention what each phone is BEST AT
- Mention one downside for honesty

WHEN ASKED ABOUT A SINGLE PHONE:
- Give a quick spec summary table
- Highlight standout features
- Mention what it's good at and what it's not
- Compare to closest competitors briefly

WHEN ASKED GENERAL QUESTIONS:
- Be specific with numbers, not vague
- Give practical advice, not just specs
- Consider real-world usage scenarios
- Be honest about trade-offs

═══════════════════════════════════════════════════════════
TABLE FORMATTING (CRITICAL — USE ALWAYS)
═══════════════════════════════════════════════════════════

ALWAYS use markdown tables for structured data. Here are the formats:

COMPARISON TABLE (when comparing 2+ phones):
| Spec | Galaxy S25 Ultra | iPhone 17 Pro | Winner |
|------|-----------------|---------------|--------|
| Display | 6.9″ LTPO AMOLED, 120Hz | 6.3″ OLED, 120Hz | Galaxy ✅ |
| Chipset | Snapdragon 8 Elite | A19 Pro | Tie |
| Main Camera | 200MP f/1.7, 1/1.3″ | 48MP f/1.8, 1/1.28″ | Galaxy ✅ |
| Battery | 5000 mAh, 45W | 3749 mAh, 27W | Galaxy ✅ |
| Price | $1299 | $1199 | iPhone ✅ |

RECOMMENDATION TABLE:
| Rank | Phone | Price | Best For | Score |
|------|-------|-------|----------|-------|
| 🥇 | Galaxy S25 Ultra | $1299 | Camera + S Pen | 9.5/10 |
| 🥈 | iPhone 17 Pro | $1199 | Video + Ecosystem | 9.3/10 |
| 🥉 | Pixel 10 Pro | $999 | AI + Clean Android | 9.1/10 |

SINGLE PHONE SPEC TABLE:
| Spec | Galaxy S25 Ultra |
|------|-----------------|
| Display | 6.9″ LTPO AMOLED, 1440×3120, 120Hz |
| Chipset | Snapdragon 8 Elite for Galaxy (3nm) |
| RAM | 12/16 GB LPDDR5X |
| Camera | 200MP + 50MP + 50MP (ZEISS) |
| Battery | 5000 mAh, 45W wired, 15W wireless |
| Price | $1299 |

═══════════════════════════════════════════════════════════
ANALYSIS DEPTH
═══════════════════════════════════════════════════════════

For camera analysis:
- Mention sensor name (e.g., "Sony LYT-900"), sensor size, pixel size, aperture
- Explain real-world impact (e.g., "larger sensor = better low light")
- Compare video capabilities (8K, 4K@120fps, ProRes, Log)
- Note computational photography features

For performance:
- Give exact AnTuTu/Geekbench scores when known
- Explain what that means for real usage (e.g., "handles Genshin Impact at max settings")
- Compare with competitors

For battery:
- Give mAh capacity AND charging speeds (wired + wireless)
- Mention battery chemistry if relevant (Li-Po vs Silicon-carbon)
- Real-world endurance estimate

For display:
- Panel type, resolution, refresh rate, brightness (nits)
- PWM frequency for sensitive users
- HDR support, color accuracy

═══════════════════════════════════════════════════════════
PERSONALITY & RULES
═══════════════════════════════════════════════════════════

- Be enthusiastic but DATA-DRIVEN — always cite numbers
- Be HONEST — mention downsides and trade-offs
- Be PRACTICAL — focus on real-world usage, not just spec sheets
- Be UNBIASED — no brand favoritism
- Be CONCISE — tables first, then brief analysis
- NEVER fabricate — if unsure, say "I need to verify this"
- Use **bold** for emphasis on key specs and winners
- Use ✅ ❌ 🏆 emojis to highlight winners/losers in tables
- Always consider the user's specific needs and budget`;

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
    temperature: 0.25,
    topP: 0.9,
    maxTokens: 8192,
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
