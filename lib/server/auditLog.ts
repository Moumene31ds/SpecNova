import "server-only";

import { FieldValue } from "@/lib/firebase/firestore-rest";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/types";
import { getClientIp, getClientUserAgent } from "./adminAuth";

/**
 * Append-only audit trail for every privileged mutation.
 *
 * Docs live in `audit_logs/{autoId}` and are written exclusively via the
 * Admin SDK (Firestore rules permit create only — no update/delete), so the
 * trail is tamper-evident against regular account compromise.
 *
 * `before` / `after` snapshot the affected resource at mutation time; the
 * `changedFields` list makes it cheap to render human-readable diffs without
 * re-reading state later.
 */

export type AuditSeverity = "info" | "warning" | "critical";

export interface AuditEntry {
  actorUid: string;
  actorEmail: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changedFields: string[];
  severity: AuditSeverity;
  note: string | null;
  ip: string;
  userAgent: string;
  createdAt: FieldValue;
}

/** Recursively strip non-serializable values (undefined, bigint, functions). */
export function toAuditValue(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    return { value } as Record<string, unknown>;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue;
    if (typeof v === "bigint" || typeof v === "function") continue;
    out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

/** Top-level field names that differ between two snapshots (deep-compare). */
export function diffFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): string[] {
  if (!before && !after) return [];
  if (!before) return Object.keys(after ?? {});
  if (!after) return Object.keys(before);
  const changed = new Set<string>();
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) changed.add(key);
  }
  return [...changed].sort();
}

interface WriteAuditOptions {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  severity?: AuditSeverity;
  note?: string | null;
  actorUid?: string;
  actorEmail?: string | null;
}

/** Write an immutable audit entry. Fire-and-forget by default (never throws). */
export async function writeAuditLog(opts: WriteAuditOptions): Promise<string> {
  const before = toAuditValue(opts.before);
  const after = toAuditValue(opts.after);

  const entry: AuditEntry = {
    actorUid: opts.actorUid ?? "system",
    actorEmail: opts.actorEmail ?? null,
    action: opts.action,
    resourceType: opts.resourceType,
    resourceId: opts.resourceId ?? null,
    before,
    after,
    changedFields: diffFields(before, after),
    severity: opts.severity ?? "info",
    note: opts.note ?? null,
    ip: await getClientIp(),
    userAgent: await getClientUserAgent(),
    createdAt: FieldValue.serverTimestamp(),
  };

  try {
    const ref = await getAdminFirestore().collection(COLLECTIONS.auditLogs).add(entry);
    return ref.id;
  } catch (err) {
    // Auditing must never break the primary operation.
    console.error("[specnova] writeAuditLog failed", err);
    return "";
  }
}
