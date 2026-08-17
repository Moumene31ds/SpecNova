import "server-only";

/**
 * Distributed rate limiting.
 *
 * Primary: Upstash Redis REST API (fixed window via INCR/EXPIRE) — set
 * `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` to enable.
 * Fallback: per-process in-memory fixed window (dev / single-instance).
 * No external SDK dependency — the REST contract is trivial.
 */

interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL ?? "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

const memory = new Map<string, { count: number; resetAt: number }>();

async function upstashPipeline(commands: string[][]): Promise<unknown[]> {
  const res = await fetch(UPSTASH_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? data : [];
}

export async function rateLimit(opts: {
  key: string;
  limit: number;
  windowSec: number;
}): Promise<RateLimitResult> {
  const { key, limit, windowSec } = opts;
  const hashKey = `rl:${key}`;
  const now = Math.floor(Date.now() / 1000);

  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const results = await upstashPipeline([
        ["INCR", hashKey],
        ["EXPIRE", hashKey, String(windowSec)],
        ["TTL", hashKey],
      ]);
      const count = Number(results[0] ?? "0");
      const ttl = Number(results[2] ?? windowSec);
      return {
        ok: count <= limit,
        remaining: Math.max(0, limit - count),
        retryAfterSec: Math.max(0, ttl),
      };
    } catch (err) {
      console.error("[specnova] Upstash rate limit failed, falling back", err);
    }
  }

  // In-memory fallback.
  const entry = memory.get(hashKey);
  if (!entry || entry.resetAt <= now) {
    memory.set(hashKey, { count: 1, resetAt: now + windowSec });
    return { ok: true, remaining: limit - 1, retryAfterSec: windowSec };
  }
  entry.count += 1;
  return {
    ok: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    retryAfterSec: Math.max(0, entry.resetAt - now),
  };
}
