import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

/**
 * Append-only audit trail. `audit_logs` is written EXCLUSIVELY here (Admin SDK);
 * Firestore rules deny every client write, update and delete on it.
 */

export type AuditResult = 'success' | 'denied' | 'error';
export type AuditSource = 'ui' | 'callable' | 'import' | 'automation' | 'migration' | 'bootstrap';

export interface AuditEntry {
  actorUid: string;
  actorRole: string | null;
  /** Permissions the actor held when the action happened (capped for document size). */
  actorPermissions?: string[];
  action: string;
  module: string;
  entityType: string;
  entityId: string;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  result: AuditResult;
  error?: string | null;
  source: AuditSource;
}

const SENSITIVE_KEY = /pass(word)?|token|secret|api[_-]?key|authorization|private|cpf|card|cartao|cvv/i;
const MAX_STRING = 300;
const MAX_DEPTH = 4;
const MAX_ARRAY = 20;
const MAX_PERMISSIONS_SNAPSHOT = 200;

/**
 * Produces a small, secret-free snapshot suitable for before/after audit fields.
 * Sensitive keys are redacted, long strings truncated, depth and arrays bounded.
 */
export function sanitizeForAudit(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY).map((v) => sanitizeForAudit(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : sanitizeForAudit(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

function buildDoc(entry: AuditEntry): Record<string, unknown> {
  return {
    actorUid: entry.actorUid,
    actorRole: entry.actorRole,
    actorPermissions: (entry.actorPermissions ?? []).slice(0, MAX_PERMISSIONS_SNAPSHOT),
    action: entry.action,
    module: entry.module,
    entityType: entry.entityType,
    entityId: entry.entityId,
    reason: entry.reason ?? null,
    before: sanitizeForAudit(entry.before),
    after: sanitizeForAudit(entry.after),
    result: entry.result,
    error: entry.error ? String(entry.error).slice(0, MAX_STRING) : null,
    source: entry.source,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

/**
 * Writes an audit entry. When `tx` is provided the entry commits atomically with the
 * mutation it describes (success path). Without `tx` it is a plain write.
 */
export async function writeAudit(entry: AuditEntry, tx?: admin.firestore.Transaction): Promise<string> {
  const ref = admin.firestore().collection('audit_logs').doc();
  const data = buildDoc(entry);
  if (tx) {
    tx.set(ref, data);
  } else {
    await ref.set(data);
  }
  return ref.id;
}

/**
 * Best-effort audit for denied/failed attempts: it must never mask the original error,
 * so write failures are logged instead of thrown.
 */
export async function writeAuditSafe(entry: AuditEntry): Promise<void> {
  try {
    await writeAudit(entry);
  } catch (err) {
    functions.logger.error('audit write failed', {
      action: entry.action,
      actorUid: entry.actorUid,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
