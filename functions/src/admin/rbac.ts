import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import {
  DEFAULT_ROLES_BY_ID,
  RULE_ADMIN_ROLE_IDS,
  SUPERADMIN_ROLE_ID,
  WILDCARD,
  isValidPermission,
  permissionsAllow,
} from './permissions';
import { AuditSource, writeAudit, writeAuditSafe } from './audit';

/**
 * Server-side RBAC. This module is the ONLY place that decides what a caller may do.
 * Frontend visibility is UX only.
 *
 * Source of truth, in order:
 *   1. users/{uid}.role === 'banned' or token.banned  -> no access
 *   2. role_assignments/{uid} (status 'active')       -> its role's permissions
 *   3. legacy admin (token.admin or users.role=admin) -> treated as role `admin`
 *      (backward compatibility: nobody loses access when RBAC is rolled out)
 * A suspended/archived assignment ALWAYS denies, even with a stale `admin` token claim.
 */

const db = () => admin.firestore();
const HttpsError = functions.https.HttpsError;

export type StaffStatus = 'active' | 'suspended' | 'archived';

export interface AuthLike {
  uid: string;
  token?: Record<string, unknown>;
}

export interface StaffAccess {
  uid: string;
  isStaff: boolean;
  roleId: string | null;
  permissions: string[];
  isSuperadmin: boolean;
  /** True when access derives from the legacy admin flag (no role_assignments doc yet). */
  legacy: boolean;
  status: StaffStatus | 'none' | 'banned';
}

const noAccess = (uid: string, status: StaffAccess['status']): StaffAccess => ({
  uid,
  isStaff: false,
  roleId: null,
  permissions: [],
  isSuperadmin: false,
  legacy: false,
  status,
});

/** Permissions of a role: Firestore `roles/{id}` (editable) with fallback to built-in defaults. */
export async function loadRolePermissions(roleId: string): Promise<string[]> {
  if (roleId === SUPERADMIN_ROLE_ID) return [WILDCARD]; // immutable
  const snap = await db().collection('roles').doc(roleId).get();
  if (snap.exists) {
    const data = snap.data() as { active?: boolean; permissions?: unknown } | undefined;
    if (data?.active === false) return [];
    return Array.isArray(data?.permissions) ? (data!.permissions as unknown[]).filter(isValidPermission) : [];
  }
  return DEFAULT_ROLES_BY_ID[roleId]?.permissions ?? [];
}

export async function resolveAccess(auth: AuthLike): Promise<StaffAccess> {
  const uid = auth.uid;
  try {
    if (auth.token?.['banned'] === true) return noAccess(uid, 'banned');

    const [userSnap, raSnap] = await Promise.all([
      db().collection('users').doc(uid).get(),
      db().collection('role_assignments').doc(uid).get(),
    ]);
    const userData = userSnap.exists ? (userSnap.data() as { role?: string } | undefined) : undefined;
    if (userData?.role === 'banned') return noAccess(uid, 'banned');

    let roleId: string;
    let legacy = false;
    if (raSnap.exists) {
      const ra = raSnap.data() as { roleId: string; status: StaffStatus };
      if (ra.status !== 'active') return noAccess(uid, ra.status);
      roleId = ra.roleId;
    } else if (auth.token?.['admin'] === true || userData?.role === 'admin') {
      roleId = 'admin';
      legacy = true;
    } else {
      return noAccess(uid, 'none');
    }

    const permissions = await loadRolePermissions(roleId);
    return {
      uid,
      isStaff: true,
      roleId,
      permissions,
      isSuperadmin: roleId === SUPERADMIN_ROLE_ID,
      legacy,
      status: 'active',
    };
  } catch (err) {
    // Fail closed.
    functions.logger.error('resolveAccess failed', { uid, error: err instanceof Error ? err.message : String(err) });
    return noAccess(uid, 'none');
  }
}

/**
 * Throws unless the caller holds `permission`. Denials by *staff members* are audited
 * (best effort); denials of non-staff are not, to avoid log flooding by random clients.
 */
export async function requirePermission(auth: AuthLike | undefined, permission: string): Promise<StaffAccess> {
  if (!auth) throw new HttpsError('unauthenticated', 'Autenticação necessária.');
  const access = await resolveAccess(auth);
  if (!access.isStaff || !permissionsAllow(access.permissions, permission)) {
    if (access.isStaff) {
      await writeAuditSafe({
        actorUid: access.uid,
        actorRole: access.roleId,
        actorPermissions: access.permissions,
        action: 'permission_denied',
        module: permission.split(':')[0],
        entityType: 'permission',
        entityId: permission,
        result: 'denied',
        source: 'callable',
      });
    }
    throw new HttpsError('permission-denied', 'Você não tem permissão para esta ação.');
  }
  return access;
}

/** Sensitive operations must carry a human reason (stored in the audit log). */
export function requireReason(value: unknown, min = 5, max = 300): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new HttpsError('invalid-argument', `Informe o motivo (${min}–${max} caracteres).`);
  }
  return value.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Staff role assignment (assign / suspend / archive / restore)
// ─────────────────────────────────────────────────────────────────────────────

export interface ApplyStaffRoleInput {
  actor: StaffAccess;
  targetUid: string;
  /** Required when assigning; for suspend/archive/restore the current role is kept unless provided. */
  roleId?: string;
  status: StaffStatus;
  reason: string;
  action: string;
  source?: AuditSource;
  /** Only the bootstrap path may bypass the self-change and superadmin-only guards. */
  bootstrap?: boolean;
}

export interface ApplyStaffRoleResult {
  changed: boolean;
  roleId: string | null;
  status: StaffStatus;
  previous: { roleId: string | null; status: StaffStatus | 'none' };
}

async function syncClaims(targetUid: string, roleId: string | null, revoke: boolean): Promise<void> {
  const auth = admin.auth();
  let existing: Record<string, unknown> = {};
  try {
    existing = ((await auth.getUser(targetUid)).customClaims ?? {}) as Record<string, unknown>;
  } catch {
    throw new HttpsError('not-found', 'Conta de autenticação do usuário não encontrada.');
  }
  const ruleAdmin = roleId !== null && (RULE_ADMIN_ROLE_IDS as readonly string[]).includes(roleId);
  const next: Record<string, unknown> = { ...existing, admin: ruleAdmin, superadmin: roleId === SUPERADMIN_ROLE_ID };
  if (roleId) next.staffRole = roleId;
  else delete next.staffRole;
  await auth.setCustomUserClaims(targetUid, next);
  if (revoke) await auth.revokeRefreshTokens(targetUid);
}

export async function applyStaffRole(input: ApplyStaffRoleInput): Promise<ApplyStaffRoleResult> {
  const { actor, targetUid, status, reason, action } = input;
  const bootstrap = input.bootstrap === true;

  if (!targetUid) throw new HttpsError('invalid-argument', 'targetUid inválido.');
  if (!bootstrap && targetUid === actor.uid) {
    throw new HttpsError('failed-precondition', 'Você não pode alterar o seu próprio acesso.');
  }

  const outcome = await db().runTransaction(async (tx) => {
    const raRef = db().collection('role_assignments').doc(targetUid);
    const userRef = db().collection('users').doc(targetUid);

    // ── all reads first ───────────────────────────────────────────────────────
    const [raSnap, userSnap] = await Promise.all([tx.get(raRef), tx.get(userRef)]);
    if (!userSnap.exists) throw new HttpsError('not-found', 'Usuário não encontrado.');
    const userData = (userSnap.data() ?? {}) as { role?: string };
    if (userData.role === 'banned' && status === 'active') {
      throw new HttpsError('failed-precondition', 'Usuário banido não pode receber acesso administrativo.');
    }

    const current = raSnap.exists ? (raSnap.data() as Record<string, unknown>) : null;
    const currentStatus = (current?.status as StaffStatus | undefined) ?? (userData.role === 'admin' ? 'active' : undefined);
    const currentRoleId = (current?.roleId as string | undefined) ?? (userData.role === 'admin' ? 'admin' : undefined);

    const newRoleId = input.roleId ?? currentRoleId;
    if (!newRoleId) {
      throw new HttpsError('failed-precondition', 'Usuário não possui acesso administrativo; informe o perfil.');
    }

    // Role must exist (custom doc or built-in) and be active.
    const roleSnap = await tx.get(db().collection('roles').doc(newRoleId));
    const roleActive = roleSnap.exists
      ? (roleSnap.data() as { active?: boolean } | undefined)?.active !== false
      : !!DEFAULT_ROLES_BY_ID[newRoleId];
    if (!roleActive) throw new HttpsError('invalid-argument', 'Perfil inexistente ou inativo.');

    // ── guards ────────────────────────────────────────────────────────────────
    const targetIsActiveSuper = currentStatus === 'active' && currentRoleId === SUPERADMIN_ROLE_ID;
    const becomesActiveSuper = status === 'active' && newRoleId === SUPERADMIN_ROLE_ID;
    if ((targetIsActiveSuper || becomesActiveSuper || newRoleId === SUPERADMIN_ROLE_ID) && !actor.isSuperadmin && !bootstrap) {
      throw new HttpsError('permission-denied', 'Somente um superadmin pode gerenciar o perfil superadmin.');
    }
    if (targetIsActiveSuper && !becomesActiveSuper) {
      const supers = await tx.get(
        db().collection('role_assignments').where('roleId', '==', SUPERADMIN_ROLE_ID).where('status', '==', 'active'),
      );
      const others = supers.docs.filter((d: { id: string }) => d.id !== targetUid).length;
      if (others < 1) {
        throw new HttpsError(
          'failed-precondition',
          'Não é possível remover, suspender ou arquivar o último superadmin ativo.',
        );
      }
    }

    // ── idempotent no-op ──────────────────────────────────────────────────────
    if (currentStatus === status && currentRoleId === newRoleId && current) {
      return {
        changed: false,
        roleId: newRoleId,
        status,
        previous: { roleId: currentRoleId ?? null, status: currentStatus ?? ('none' as const) },
      };
    }

    // ── writes ────────────────────────────────────────────────────────────────
    const now = admin.firestore.FieldValue.serverTimestamp();
    const doc: Record<string, unknown> = {
      ...(current ?? {}),
      uid: targetUid,
      roleId: newRoleId,
      status,
      updatedAt: now,
      updatedBy: actor.uid,
      lastReason: reason,
    };
    if (status === 'active') {
      if (!current || currentStatus !== 'active') doc.assignedAt = now;
      doc.assignedBy = actor.uid;
      if (currentStatus && currentStatus !== 'active') {
        doc.restoredAt = now;
        doc.restoredBy = actor.uid;
      }
      doc.suspendedAt = null;
      doc.archivedAt = null;
    } else if (status === 'suspended') {
      doc.suspendedAt = now;
      doc.suspendedBy = actor.uid;
      doc.suspendReason = reason;
    } else {
      doc.archivedAt = now;
      doc.archivedBy = actor.uid;
      doc.archiveReason = reason;
    }
    tx.set(raRef, doc);

    // Legacy compatibility: `users.role === 'admin'` is what rules/old code still look at.
    const ruleAdmin = status === 'active' && (RULE_ADMIN_ROLE_IDS as readonly string[]).includes(newRoleId);
    const compatRole = userData.role === 'banned' ? 'banned' : ruleAdmin ? 'admin' : 'client';
    tx.update(userRef, { role: compatRole, updatedAt: now });

    await writeAudit(
      {
        actorUid: actor.uid,
        actorRole: actor.roleId,
        actorPermissions: actor.permissions,
        action,
        module: 'usuarios',
        entityType: 'role_assignment',
        entityId: targetUid,
        reason,
        before: { roleId: currentRoleId ?? null, status: currentStatus ?? 'none' },
        after: { roleId: newRoleId, status },
        result: 'success',
        source: input.source ?? 'callable',
      },
      tx,
    );

    return {
      changed: true,
      roleId: newRoleId,
      status,
      previous: { roleId: currentRoleId ?? null, status: currentStatus ?? ('none' as const) },
    };
  });

  // Claims are re-synced even for a no-op so a retry heals a half-applied change.
  const activeRoleId = outcome.status === 'active' ? outcome.roleId : null;
  const wasRuleAdmin =
    outcome.previous.status === 'active' &&
    outcome.previous.roleId !== null &&
    (RULE_ADMIN_ROLE_IDS as readonly string[]).includes(outcome.previous.roleId);
  const isRuleAdmin = activeRoleId !== null && (RULE_ADMIN_ROLE_IDS as readonly string[]).includes(activeRoleId);
  await syncClaims(targetUid, activeRoleId, activeRoleId === null || (wasRuleAdmin && !isRuleAdmin));

  return outcome;
}
