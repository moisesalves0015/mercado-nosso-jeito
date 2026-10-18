import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLES,
  DEFAULT_ROLES_BY_ID,
  SUPERADMIN_ROLE_ID,
  normalizePermissions,
  permissionsAllow,
} from './permissions';
import { StaffAccess, StaffStatus, applyStaffRole, requirePermission, requireReason, resolveAccess } from './rbac';
import { writeAudit, writeAuditSafe } from './audit';

/**
 * Admin / RBAC callables (Fase 1). Every handler:
 *   1. authenticates and checks a granular permission server-side (requirePermission);
 *   2. validates input;
 *   3. mutates inside a transaction together with its audit entry;
 *   4. never trusts any role/permission sent by the client.
 */

const db = () => admin.firestore();
const HttpsError = functions.https.HttpsError;

const ROLE_ID_RE = /^[a-z][a-z0-9_]{2,29}$/;

function str(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new HttpsError('invalid-argument', `${field} inválido (${min}–${max} caracteres).`);
  }
  return value.trim();
}

/** Records refused sensitive attempts (permission/precondition) before re-throwing. */
async function audited<T>(
  access: StaffAccess,
  meta: { action: string; module: string; entityType: string; entityId: string; reason?: string },
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpsError && (err.code === 'permission-denied' || err.code === 'failed-precondition')) {
      await writeAuditSafe({
        actorUid: access.uid,
        actorRole: access.roleId,
        actorPermissions: access.permissions,
        ...meta,
        result: 'denied',
        error: err.message,
        source: 'callable',
      });
    }
    throw err;
  }
}

async function resolveTargetUid(data: { targetUid?: unknown; targetEmail?: unknown }): Promise<string> {
  if (typeof data.targetUid === 'string' && data.targetUid.trim()) return data.targetUid.trim();
  if (typeof data.targetEmail === 'string' && data.targetEmail.trim()) {
    try {
      return (await admin.auth().getUserByEmail(data.targetEmail.trim().toLowerCase())).uid;
    } catch {
      throw new HttpsError('not-found', 'Nenhuma conta encontrada para este e-mail. O usuário precisa se cadastrar antes.');
    }
  }
  throw new HttpsError('invalid-argument', 'Informe targetUid ou targetEmail.');
}

// ─────────────────────────────────────────────────────────────────────────────
// adminGetMyAccess — the server-resolved access of the caller (UX only on the client)
// ─────────────────────────────────────────────────────────────────────────────
export const adminGetMyAccess = functions.https.onCall(async (_data, context) => {
  if (!context.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  const a = await resolveAccess({ uid: context.auth.uid, token: context.auth.token });
  return {
    isStaff: a.isStaff,
    roleId: a.roleId,
    permissions: a.permissions,
    isSuperadmin: a.isSuperadmin,
    legacy: a.legacy,
    status: a.status,
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// adminAssignRole — grant a role to an existing account (invite-by-existing-account)
// ─────────────────────────────────────────────────────────────────────────────
export const adminAssignRole = functions.https.onCall(async (data, context) => {
  const actor = await requirePermission(context.auth, 'usuarios:admin');
  const req = (data ?? {}) as { roleId?: unknown; reason?: unknown; targetUid?: unknown; targetEmail?: unknown };
  const reason = requireReason(req.reason);
  const roleId = str(req.roleId, 'roleId', 3, 30);
  const targetUid = await resolveTargetUid(req);

  const result = await audited(
    actor,
    { action: 'staff.assign_role', module: 'usuarios', entityType: 'role_assignment', entityId: targetUid, reason },
    () => applyStaffRole({ actor, targetUid, roleId, status: 'active', reason, action: 'staff.assign_role' }),
  );
  return { success: true, targetUid, ...result };
});

// ─────────────────────────────────────────────────────────────────────────────
// adminSetStaffStatus — suspend / archive / restore (never deletes)
// ─────────────────────────────────────────────────────────────────────────────
export const adminSetStaffStatus = functions.https.onCall(async (data, context) => {
  const actor = await requirePermission(context.auth, 'usuarios:admin');
  const req = (data ?? {}) as { status?: unknown; reason?: unknown; targetUid?: unknown; targetEmail?: unknown };
  const reason = requireReason(req.reason);
  if (req.status !== 'suspended' && req.status !== 'archived' && req.status !== 'active') {
    throw new HttpsError('invalid-argument', "status deve ser 'suspended', 'archived' ou 'active'.");
  }
  const status = req.status as StaffStatus;
  const targetUid = await resolveTargetUid(req);
  const action = status === 'active' ? 'staff.restore' : status === 'suspended' ? 'staff.suspend' : 'staff.archive';

  const result = await audited(
    actor,
    { action, module: 'usuarios', entityType: 'role_assignment', entityId: targetUid, reason },
    () => applyStaffRole({ actor, targetUid, status, reason, action }),
  );
  return { success: true, targetUid, ...result };
});

// ─────────────────────────────────────────────────────────────────────────────
// adminListStaff — staff roster (includes legacy admins not yet migrated)
// ─────────────────────────────────────────────────────────────────────────────
export const adminListStaff = functions.https.onCall(async (_data, context) => {
  await requirePermission(context.auth, 'usuarios:view');

  const assignments = await db().collection('role_assignments').limit(200).get();
  const seen = new Set<string>();
  const staff: Array<Record<string, unknown>> = [];

  const userInfo = async (uid: string) => {
    const u = await db().collection('users').doc(uid).get();
    const d = (u.exists ? u.data() : {}) as { name?: string; email?: string };
    return { name: d?.name ?? null, email: d?.email ?? null };
  };

  for (const doc of assignments.docs) {
    const ra = doc.data() as Record<string, unknown>;
    seen.add(doc.id);
    staff.push({
      uid: doc.id,
      roleId: ra.roleId ?? null,
      status: ra.status ?? 'active',
      legacy: false,
      ...(await userInfo(doc.id)),
    });
  }

  const legacy = await db().collection('users').where('role', '==', 'admin').limit(200).get();
  for (const doc of legacy.docs) {
    if (seen.has(doc.id)) continue;
    const d = doc.data() as { name?: string; email?: string };
    staff.push({ uid: doc.id, roleId: 'admin', status: 'active', legacy: true, name: d.name ?? null, email: d.email ?? null });
  }

  return { staff };
});

// ─────────────────────────────────────────────────────────────────────────────
// adminListRoles — built-in roles merged with the editable `roles` collection
// ─────────────────────────────────────────────────────────────────────────────
export const adminListRoles = functions.https.onCall(async (_data, context) => {
  await requirePermission(context.auth, 'usuarios:view');
  const snap = await db().collection('roles').limit(100).get();
  const stored = new Map<string, Record<string, unknown>>();
  snap.docs.forEach((d: { id: string; data: () => unknown }) => stored.set(d.id, d.data() as Record<string, unknown>));

  const roles = DEFAULT_ROLES.map((def) => {
    const s = stored.get(def.id);
    stored.delete(def.id);
    return {
      id: def.id,
      label: (s?.label as string) ?? def.label,
      description: (s?.description as string) ?? def.description,
      permissions: def.id === SUPERADMIN_ROLE_ID ? ['*'] : ((s?.permissions as string[]) ?? def.permissions),
      active: s?.active !== false,
      system: true,
      seeded: !!s,
    };
  });
  stored.forEach((s, id) =>
    roles.push({
      id,
      label: (s.label as string) ?? id,
      description: (s.description as string) ?? '',
      permissions: (s.permissions as string[]) ?? [],
      active: s.active !== false,
      system: false,
      seeded: true,
    }),
  );
  return { roles, catalogue: ALL_PERMISSIONS };
});

// ─────────────────────────────────────────────────────────────────────────────
// adminUpsertRole — create/edit a role (superadmin permissions are immutable)
// ─────────────────────────────────────────────────────────────────────────────
export const adminUpsertRole = functions.https.onCall(async (data, context) => {
  const actor = await requirePermission(context.auth, 'usuarios:admin');
  const req = (data ?? {}) as {
    roleId?: unknown;
    label?: unknown;
    description?: unknown;
    permissions?: unknown;
    active?: unknown;
    reason?: unknown;
  };
  const reason = requireReason(req.reason);
  const roleId = str(req.roleId, 'roleId', 3, 30);
  if (!ROLE_ID_RE.test(roleId)) {
    throw new HttpsError('invalid-argument', 'roleId deve usar a-z, 0-9 e _ (começando com letra).');
  }
  const label = str(req.label, 'label', 2, 40);
  const description = typeof req.description === 'string' ? req.description.trim().slice(0, 200) : '';
  const active = req.active === undefined ? true : req.active === true;
  let permissions: string[];
  try {
    permissions = normalizePermissions(req.permissions);
  } catch (e) {
    throw new HttpsError('invalid-argument', e instanceof Error ? e.message : 'permissions inválido.');
  }

  return audited(
    actor,
    { action: 'role.upsert', module: 'usuarios', entityType: 'role', entityId: roleId, reason },
    async () => {
      if (roleId === SUPERADMIN_ROLE_ID) {
        throw new HttpsError('failed-precondition', 'O perfil superadmin é imutável.');
      }
      if (!actor.isSuperadmin) {
        const escalated = permissions.filter((p) => !permissionsAllow(actor.permissions, p));
        if (escalated.length > 0) {
          throw new HttpsError('permission-denied', `Você não pode conceder permissões que não possui: ${escalated.join(', ')}`);
        }
      }
      const isSystem = !!DEFAULT_ROLES_BY_ID[roleId];
      if (isSystem && !active) {
        throw new HttpsError('failed-precondition', 'Perfis do sistema não podem ser desativados.');
      }

      return db().runTransaction(async (tx) => {
        const ref = db().collection('roles').doc(roleId);
        const snap = await tx.get(ref);
        const prev = snap.exists ? (snap.data() as Record<string, unknown>) : null;

        if (!active) {
          const inUse = await tx.get(
            db().collection('role_assignments').where('roleId', '==', roleId).where('status', '==', 'active'),
          );
          if (inUse.docs.length > 0) {
            throw new HttpsError('failed-precondition', 'Perfil em uso por usuários ativos; reatribua-os antes de desativar.');
          }
        }

        const now = admin.firestore.FieldValue.serverTimestamp();
        const next: Record<string, unknown> = {
          ...(prev ?? {}),
          id: roleId,
          label,
          description,
          permissions,
          active,
          system: isSystem,
          version: (Number(prev?.version) || 0) + 1,
          updatedAt: now,
          updatedBy: actor.uid,
        };
        if (!prev) {
          next.createdAt = now;
          next.createdBy = actor.uid;
        }
        tx.set(ref, next);

        await writeAudit(
          {
            actorUid: actor.uid,
            actorRole: actor.roleId,
            actorPermissions: actor.permissions,
            action: 'role.upsert',
            module: 'usuarios',
            entityType: 'role',
            entityId: roleId,
            reason,
            before: prev ? { label: prev.label, permissions: prev.permissions, active: prev.active } : null,
            after: { label, permissions, active },
            result: 'success',
            source: 'callable',
          },
          tx,
        );
        return { success: true, roleId, version: next.version };
      });
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// adminSeedRoles — idempotent, additive, dry-run by default
// ─────────────────────────────────────────────────────────────────────────────
export const adminSeedRoles = functions.https.onCall(async (data, context) => {
  const actor = await requirePermission(context.auth, 'usuarios:admin');
  const req = (data ?? {}) as { dryRun?: unknown; reason?: unknown };
  const dryRun = req.dryRun !== false; // safe default
  const reason = dryRun ? 'dry-run' : requireReason(req.reason);

  return db().runTransaction(async (tx) => {
    const existing: string[] = [];
    const toCreate: string[] = [];
    for (const def of DEFAULT_ROLES) {
      const snap = await tx.get(db().collection('roles').doc(def.id));
      (snap.exists ? existing : toCreate).push(def.id);
    }
    if (dryRun || toCreate.length === 0) {
      return { dryRun, existing, toCreate, created: [] as string[] };
    }
    const now = admin.firestore.FieldValue.serverTimestamp();
    for (const id of toCreate) {
      const def = DEFAULT_ROLES_BY_ID[id];
      tx.set(db().collection('roles').doc(id), {
        id,
        label: def.label,
        description: def.description,
        permissions: def.permissions,
        active: true,
        system: true,
        version: 1,
        createdAt: now,
        createdBy: actor.uid,
        updatedAt: now,
        updatedBy: actor.uid,
      });
    }
    await writeAudit(
      {
        actorUid: actor.uid,
        actorRole: actor.roleId,
        actorPermissions: actor.permissions,
        action: 'roles.seed',
        module: 'usuarios',
        entityType: 'role',
        entityId: 'defaults',
        reason,
        before: { existing },
        after: { created: toCreate },
        result: 'success',
        source: 'migration',
      },
      tx,
    );
    return { dryRun, existing, toCreate, created: toCreate };
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// adminListAudit — filtered, cursor-paginated read of the audit trail
// ─────────────────────────────────────────────────────────────────────────────
export const adminListAudit = functions.https.onCall(async (data, context) => {
  await requirePermission(context.auth, 'auditoria:view');
  const req = (data ?? {}) as Record<string, unknown>;

  const limit = Math.min(Math.max(Number(req.limit) || 50, 1), 100);
  const filters: Array<[string, string]> = [];
  const pick = (k: string) => (typeof req[k] === 'string' && (req[k] as string).trim() ? (req[k] as string).trim() : null);
  const f = {
    entityType: pick('entityType'),
    entityId: pick('entityId'),
    actorUid: pick('actorUid'),
    module: pick('module'),
    action: pick('action'),
    result: pick('result'),
  };

  // One server-side equality filter (backed by a composite index with createdAt desc);
  // the remaining filters are applied in memory on the fetched page.
  let serverFilters: Array<[string, string]> = [];
  if (f.entityType && f.entityId) serverFilters = [['entityType', f.entityType], ['entityId', f.entityId]];
  else if (f.actorUid) serverFilters = [['actorUid', f.actorUid]];
  else if (f.module) serverFilters = [['module', f.module]];
  else if (f.action) serverFilters = [['action', f.action]];
  else if (f.result) serverFilters = [['result', f.result]];
  filters.push(...serverFilters);

  let q: FirebaseFirestore.Query = db().collection('audit_logs');
  for (const [field, value] of filters) q = q.where(field, '==', value);
  q = q.orderBy('createdAt', 'desc');
  if (typeof req.startAfterMillis === 'number') {
    q = q.startAfter(admin.firestore.Timestamp.fromMillis(req.startAfterMillis));
  }
  const snap = await q.limit(limit).get();

  const serverKeys = new Set(serverFilters.map(([k]) => k));
  const memoryFilters = (Object.entries(f) as Array<[keyof typeof f, string | null]>).filter(
    ([k, v]) => v && !serverKeys.has(k),
  );

  const entries = snap.docs
    .map((d: { id: string; data: () => unknown }) => {
      const e = d.data() as Record<string, unknown> & { createdAt?: { toMillis?: () => number } };
      return { id: d.id, ...e, createdAtMillis: e.createdAt?.toMillis?.() ?? null, createdAt: undefined };
    })
    .filter((e: Record<string, unknown>) => memoryFilters.every(([k, v]) => e[k] === v));

  const last = snap.docs.length === limit ? snap.docs[snap.docs.length - 1] : null;
  const nextCursor = last ? ((last.data() as { createdAt?: { toMillis?: () => number } }).createdAt?.toMillis?.() ?? null) : null;

  return { entries, nextCursor };
});
