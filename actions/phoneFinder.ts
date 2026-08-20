"use server";

/**
 * AI PHONE FINDER — Conversational Phone Recommendation
 *
 * A chat-based phone finder that uses Gemini to understand user needs
 * and recommend phones from the database.
 */

import { geminiGenerateContent } from "@/lib/ai/gemini-client";
import { getAdminFirestore } from "@/lib/firebase/admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FinderMessage {
  role: "user" | "assistant";
  content: string;
  devices?: FinderDevice[];
}

export interface FinderDevice {
  id: string;
  brand: string;
  name: string;
  slug: string;
  score?: number;
  price?: number;
  reason?: string;
  specs?: {
    display?: string;
    chipset?: string;
    camera?: string;
    battery?: string;
  };
}

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const FINDER_SYSTEM_PROMPT = `You are iToPhone Phone Finder — an expert phone recommendation AI. You help users find their perfect phone through natural conversation.

══════════════════════════════════════════════════════════
CORE RULES
══════════════════════════════════════════════════════════

1. Be CONVERSATIONAL and FRIENDLY — like talking to a phone expert friend
2. Ask CLARIFYING questions when the request is vague (budget? use case? size?)
3. Give 3-5 TOP recommendations with clear reasoning
4. Be HONEST — mention one downside for each recommendation
5. ALWAYS consider the user's specific budget and needs
6. Use the phone database provided for REAL recommendations

══════════════════════════════════════════════════════════
RESPONSE FORMAT
══════════════════════════════════════════════════════════

For EACH recommendation, provide a JSON block like:
\`\`\`json
{
  "devices": [
    {
      "brand": "Samsung",
      "name": "Galaxy S25 Ultra",
      "score": 9.5,
      "price": 1299,
      "reason": "Best overall camera with 200MP sensor and 5x zoom",
      "specs": {
        "display": "6.9″ LTPO AMOLED, 120Hz",
        "chipset": "Snapdragon 8 Elite",
        "camera": "200MP + 50MP + 50MP",
        "battery": "5000mAh, 45W"
      }
    }
  ]
}
\`\`\`

After the JSON, add a brief conversational summary.

══════════════════════════════════════════════════════════
CONVERSATION STYLE
══════════════════════════════════════════════════════════

- First message: Be welcoming, ask what they're looking for
- Follow-up: Refine based on their answers
- Final: Give recommendations with confidence
- Keep responses under 300 words unless comparing multiple phones
- Use emoji sparingly for emphasis
- Be enthusiastic but data-driven`;

// ---------------------------------------------------------------------------
// Catalog Builder
// ---------------------------------------------------------------------------

async function buildCatalogContext(): Promise<string> {
  try {
    const adminDb = getAdminFirestore();
    const snapshot = await adminDb
      .collection("devices")
      .where("status", "in", ["available", "announced"])
      .limit(150)
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
        d.slug,
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
    return "\n\nNote: Phone database unavailable. Use your knowledge.";
  }
}

// ---------------------------------------------------------------------------
// Main Function
// ---------------------------------------------------------------------------

export async function phoneFinderChat(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<{
  response: string;
  devices: FinderDevice[];
  latencyMs: number;
}> {
  const start = Date.now();

  const catalogContext = await buildCatalogContext();

  const conversationHistory = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  const userMessage = `${catalogContext}\n\nCONVERSATION:\n${conversationHistory}\n\nAssistant:`;

  const result = await geminiGenerateContent({
    systemInstruction: FINDER_SYSTEM_PROMPT,
    userMessage,
    temperature: 0.3,
    topP: 0.9,
    maxTokens: 4096,
    useGoogleSearch: true,
  });

  const text = result.text ?? "I couldn't generate a response. Please try again.";

  // Extract devices from JSON in response
  let devices: FinderDevice[] = [];
  try {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      devices = parsed.devices ?? [];
    }
  } catch {
    // No JSON found, that's fine
  }

  return {
    response: text,
    devices,
    latencyMs: Date.now() - start,
  };
}
