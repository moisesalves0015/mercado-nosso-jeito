import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import type { buildAdminMock } from '../__fakes__/fakeAdmin';

jest.mock('firebase-admin', () =>
  (jest.requireActual('../__fakes__/fakeAdmin') as { buildAdminMock: typeof buildAdminMock }).buildAdminMock(),
);

import { fakeDb, fakeAuth, FakeTimestamp } from '../__fakes__/fakeAdmin';
import {
  adminAssignRole,
  adminGetMyAccess,
  adminListAudit,
  adminListRoles,
  adminListStaff,
  adminSeedRoles,
  adminSetStaffStatus,
  adminUpsertRole,
  adminBanUser,
  setAdminClaim,
} from '../index';
import { sanitizeForAudit } from './audit';
import { ALL_PERMISSIONS, DEFAULT_ROLES_BY_ID, normalizePermissions, permissionsAllow } from './permissions';

type Callable = { run: (data: unknown, ctx: unknown) => Promise<Record<string, any>> };
const call = (fn: unknown, data: unknown, ctx: unknown) => (fn as Callable).run(data, ctx);
const ctx = (uid: string, token: Record<string, unknown> = {}) => ({ auth: { uid, token } });
const anonymous = { auth: undefined };

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toMatchObject({ code });
}

const RULE_ADMIN = ['admin', 'superadmin'];

function seedUser(uid: string, role = 'client') {
  const email = `${uid}@loja.com`;
  fakeDb.seed(`users/${uid}`, { name: `Nome ${uid}`, email, role });
  fakeAuth.seedUser(uid, email);
}

function seedStaff(uid: string, roleId: string, status = 'active') {
  seedUser(uid, status === 'active' && RULE_ADMIN.includes(roleId) ? 'admin' : 'client');
  fakeDb.seed(`role_assignments/${uid}`, { uid, roleId, status });
}

const auditDocs = () => fakeDb.listPaths('audit_logs/').map((p) => fakeDb.read(p) as Record<string, any>);
const REASON = 'Motivo válido para auditoria';

beforeEach(() => {
  fakeDb.reset(); // also resets the fake Auth store
});

describe('permissions catalogue', () => {
  it('admin role does not receive critical governance permissions; superadmin has the wildcard', () => {
    const admin = DEFAULT_ROLES_BY_ID.admin.permissions;
    expect(admin).toContain('pedidos:edit');
    expect(admin).not.toContain('usuarios:admin');
    expect(admin).not.toContain('auditoria:export');
    expect(permissionsAllow(DEFAULT_ROLES_BY_ID.superadmin.permissions, 'usuarios:admin')).toBe(true);
  });

  it('analista can only view dashboards and reports', () => {
    expect(DEFAULT_ROLES_BY_ID.analista.permissions.sort()).toEqual(['dashboard:view', 'relatorios:view']);
  });

  it('every default permission belongs to the catalogue', () => {
    for (const role of Object.values(DEFAULT_ROLES_BY_ID)) {
      for (const p of role.permissions) {
        expect(p === '*' || ALL_PERMISSIONS.includes(p as never)).toBe(true);
      }
    }
  });

  it('normalizePermissions rejects unknown permissions and de-duplicates', () => {
    expect(() => normalizePermissions(['pedidos:view', 'pedidos:destroy'])).toThrow();
    expect(normalizePermissions(['pedidos:view', 'pedidos:view'])).toEqual(['pedidos:view']);
  });
});

describe('audit sanitization', () => {
  it('redacts secrets/CPF, truncates long strings and bounds depth', () => {
    const out = sanitizeForAudit({
      name: 'Ana',
      cpf: '123.456.789-00',
      password: 'x',
      nested: { apiKey: 'k', ok: 1 },
      long: 'a'.repeat(1000),
    }) as Record<string, any>;
    expect(out.cpf).toBe('[redacted]');
    expect(out.password).toBe('[redacted]');
    expect(out.nested.apiKey).toBe('[redacted]');
    expect(out.nested.ok).toBe(1);
    expect(out.long.length).toBeLessThanOrEqual(301);
  });
});

describe('access resolution', () => {
  it('requires authentication', async () => {
    await expectCode(call(adminGetMyAccess, {}, anonymous), 'unauthenticated');
  });

  it('plain customers are not staff', async () => {
    seedUser('cust');
    const r = await call(adminGetMyAccess, {}, ctx('cust'));
    expect(r.isStaff).toBe(false);
    expect(r.permissions).toEqual([]);
  });

  it('legacy admins keep working as role "admin" (backward compatibility)', async () => {
    seedUser('legacy', 'admin');
    const r = await call(adminGetMyAccess, {}, ctx('legacy', { admin: true }));
    expect(r).toMatchObject({ isStaff: true, roleId: 'admin', legacy: true, isSuperadmin: false });
    expect(r.permissions).not.toContain('usuarios:admin');
  });

  it('a suspended assignment denies access even with a stale admin token claim', async () => {
    seedStaff('gone', 'admin', 'suspended');
    await expectCode(call(adminListStaff, {}, ctx('gone', { admin: true })), 'permission-denied');
  });

  it('banned users never get access', async () => {
    seedUser('bad', 'banned');
    fakeDb.seed('role_assignments/bad', { uid: 'bad', roleId: 'superadmin', status: 'active' });
    await expectCode(call(adminListStaff, {}, ctx('bad', { admin: true })), 'permission-denied');
  });

  it('role permissions come from the editable roles collection when present', async () => {
    seedStaff('op', 'operacoes');
    fakeDb.seed('roles/operacoes', { id: 'operacoes', permissions: ['usuarios:view'], active: true });
    const r = await call(adminGetMyAccess, {}, ctx('op'));
    expect(r.permissions).toEqual(['usuarios:view']);
  });
});

describe('adminAssignRole', () => {
  it('denies non-staff and does not flood the audit log', async () => {
    seedUser('cust');
    seedUser('t');
    await expectCode(call(adminAssignRole, { targetUid: 't', roleId: 'operacoes', reason: REASON }, ctx('cust')), 'permission-denied');
    expect(auditDocs()).toHaveLength(0);
  });

  it('denies a legacy admin (no usuarios:admin) and records the denied attempt', async () => {
    seedUser('legacy', 'admin');
    seedUser('t');
    await expectCode(
      call(adminAssignRole, { targetUid: 't', roleId: 'operacoes', reason: REASON }, ctx('legacy', { admin: true })),
      'permission-denied',
    );
    const logs = auditDocs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: 'permission_denied', result: 'denied', actorUid: 'legacy', entityId: 'usuarios:admin' });
  });

  it('superadmin assigns a non-admin role: no rule-level admin, claims merged, audited', async () => {
    seedStaff('sa', 'superadmin');
    seedUser('target');
    fakeAuth.seedUser('target', 'target@loja.com', { custom: 'keep' });

    const r = await call(adminAssignRole, { targetUid: 'target', roleId: 'operacoes', reason: REASON }, ctx('sa'));
    expect(r).toMatchObject({ success: true, changed: true, roleId: 'operacoes', status: 'active' });

    expect(fakeDb.read('role_assignments/target')).toMatchObject({ roleId: 'operacoes', status: 'active', assignedBy: 'sa' });
    expect(fakeDb.read('users/target')?.role).toBe('client'); // NOT 'admin': no rule-level access
    expect(fakeAuth.claimsOf('target')).toMatchObject({ admin: false, superadmin: false, staffRole: 'operacoes', custom: 'keep' });

    const logs = auditDocs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: 'staff.assign_role',
      module: 'usuarios',
      entityType: 'role_assignment',
      entityId: 'target',
      actorUid: 'sa',
      actorRole: 'superadmin',
      reason: REASON,
      result: 'success',
      before: { roleId: null, status: 'none' },
      after: { roleId: 'operacoes', status: 'active' },
    });
    expect(logs[0].createdAt).toBeInstanceOf(FakeTimestamp);
  });

  it('assigning "admin" syncs the legacy users.role and the admin claim', async () => {
    seedStaff('sa', 'superadmin');
    seedUser('target');
    await call(adminAssignRole, { targetUid: 'target', roleId: 'admin', reason: REASON }, ctx('sa'));
    expect(fakeDb.read('users/target')?.role).toBe('admin');
    expect(fakeAuth.claimsOf('target')).toMatchObject({ admin: true, superadmin: false, staffRole: 'admin' });
  });

  it('resolves the target by e-mail', async () => {
    seedStaff('sa', 'superadmin');
    seedUser('target');
    const r = await call(adminAssignRole, { targetEmail: 'TARGET@loja.com', roleId: 'suporte', reason: REASON }, ctx('sa'));
    expect(r.targetUid).toBe('target');
    await expectCode(call(adminAssignRole, { targetEmail: 'nobody@x.com', roleId: 'suporte', reason: REASON }, ctx('sa')), 'not-found');
  });

  it('validates reason, role and target', async () => {
    seedStaff('sa', 'superadmin');
    seedUser('target');
    await expectCode(call(adminAssignRole, { targetUid: 'target', roleId: 'operacoes', reason: 'x' }, ctx('sa')), 'invalid-argument');
    await expectCode(call(adminAssignRole, { targetUid: 'target', roleId: 'inexistente', reason: REASON }, ctx('sa')), 'invalid-argument');
    await expectCode(call(adminAssignRole, { targetUid: 'ghost', roleId: 'operacoes', reason: REASON }, ctx('sa')), 'not-found');
    await expectCode(call(adminAssignRole, { roleId: 'operacoes', reason: REASON }, ctx('sa')), 'invalid-argument');
  });

  it('blocks changing your own access', async () => {
    seedStaff('sa', 'superadmin');
    seedStaff('sa2', 'superadmin');
    await expectCode(call(adminAssignRole, { targetUid: 'sa', roleId: 'analista', reason: REASON }, ctx('sa')), 'failed-precondition');
    expect(fakeDb.read('role_assignments/sa')?.roleId).toBe('superadmin');
  });

  it('refuses to give staff access to a banned user', async () => {
    seedStaff('sa', 'superadmin');
    seedUser('banned', 'banned');
    await expectCode(call(adminAssignRole, { targetUid: 'banned', roleId: 'operacoes', reason: REASON }, ctx('sa')), 'failed-precondition');
  });
});

describe('superadmin protection', () => {
  async function grantManagerRole() {
    // custom role holding usuarios:admin but NOT superadmin
    await call(
      adminUpsertRole,
      { roleId: 'gestor', label: 'Gestor', permissions: ['usuarios:admin', 'usuarios:view'], reason: REASON },
      ctx('sa'),
    );
    seedStaff('mgr', 'gestor');
  }

  it('only a superadmin can grant the superadmin role', async () => {
    seedStaff('sa', 'superadmin');
    await grantManagerRole();
    seedUser('target');
    await expectCode(call(adminAssignRole, { targetUid: 'target', roleId: 'superadmin', reason: REASON }, ctx('mgr')), 'permission-denied');
    const ok = await call(adminAssignRole, { targetUid: 'target', roleId: 'superadmin', reason: REASON }, ctx('sa'));
    expect(ok.roleId).toBe('superadmin');
    expect(fakeAuth.claimsOf('target')).toMatchObject({ admin: true, superadmin: true });
  });

  it('a non-superadmin cannot suspend, archive or demote a superadmin (denial is audited)', async () => {
    seedStaff('sa', 'superadmin');
    await grantManagerRole();
    seedStaff('sa2', 'superadmin');
    await expectCode(call(adminSetStaffStatus, { targetUid: 'sa2', status: 'suspended', reason: REASON }, ctx('mgr')), 'permission-denied');
    await expectCode(call(adminAssignRole, { targetUid: 'sa2', roleId: 'analista', reason: REASON }, ctx('mgr')), 'permission-denied');
    expect(fakeDb.read('role_assignments/sa2')?.status).toBe('active');
    expect(auditDocs().filter((l) => l.result === 'denied' && l.actorUid === 'mgr').length).toBeGreaterThanOrEqual(2);
  });

  it('the last active superadmin can never be removed — even by concurrent mutual demotion', async () => {
    seedStaff('sa1', 'superadmin');
    seedStaff('sa2', 'superadmin');

    const results = await Promise.allSettled([
      call(adminSetStaffStatus, { targetUid: 'sa2', status: 'suspended', reason: REASON }, ctx('sa1')),
      call(adminSetStaffStatus, { targetUid: 'sa1', status: 'suspended', reason: REASON }, ctx('sa2')),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ code: 'failed-precondition' });

    const active = ['sa1', 'sa2'].filter((u) => fakeDb.read(`role_assignments/${u}`)?.status === 'active');
    expect(active).toHaveLength(1);
  });

  it('adminBanUser cannot ban an active superadmin', async () => {
    seedStaff('sa', 'superadmin');
    seedUser('legacy', 'admin');
    await expectCode(call(adminBanUser, { targetUid: 'sa', reason: 'teste' }, ctx('legacy', { admin: true })), 'failed-precondition');
    expect(fakeDb.read('users/sa')?.role).toBe('admin');
  });
});

describe('suspend / archive / restore (reversible, never deletes)', () => {
  it('suspend removes effective access and revokes sessions; restore brings it back', async () => {
    seedStaff('sa', 'superadmin');
    seedUser('t');
    await call(adminAssignRole, { targetUid: 't', roleId: 'admin', reason: REASON }, ctx('sa'));

    const sus = await call(adminSetStaffStatus, { targetUid: 't', status: 'suspended', reason: 'Investigação interna' }, ctx('sa'));
    expect(sus).toMatchObject({ changed: true, status: 'suspended' });
    expect(fakeDb.read('role_assignments/t')).toMatchObject({ status: 'suspended', roleId: 'admin', suspendedBy: 'sa', suspendReason: 'Investigação interna' });
    expect(fakeDb.read('users/t')?.role).toBe('client');
    expect(fakeAuth.claimsOf('t')).toMatchObject({ admin: false, superadmin: false });
    expect(fakeAuth.claimsOf('t').staffRole).toBeUndefined();
    expect(fakeAuth.revoked).toContain('t');
    await expectCode(call(adminListStaff, {}, ctx('t', { admin: true })), 'permission-denied');

    const res = await call(adminSetStaffStatus, { targetUid: 't', status: 'active', reason: 'Retorno confirmado' }, ctx('sa'));
    expect(res).toMatchObject({ changed: true, status: 'active', roleId: 'admin' });
    expect(fakeDb.read('role_assignments/t')).toMatchObject({ status: 'active', restoredBy: 'sa' });
    expect(fakeDb.read('users/t')?.role).toBe('admin');

    const actions = auditDocs().map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(['staff.assign_role', 'staff.suspend', 'staff.restore']));
  });

  it('archive keeps the record (archivedAt/By/Reason) and is restorable', async () => {
    seedStaff('sa', 'superadmin');
    seedStaff('t', 'operacoes');
    await call(adminSetStaffStatus, { targetUid: 't', status: 'archived', reason: 'Desligamento' }, ctx('sa'));
    expect(fakeDb.read('role_assignments/t')).toMatchObject({ status: 'archived', archivedBy: 'sa', archiveReason: 'Desligamento' });
    expect(fakeDb.read('users/t')).toBeDefined(); // nothing deleted
    await call(adminSetStaffStatus, { targetUid: 't', status: 'active', reason: 'Recontratado' }, ctx('sa'));
    expect(fakeDb.read('role_assignments/t')?.status).toBe('active');
  });

  it('is idempotent: repeating the same change does not duplicate audit entries but heals claims', async () => {
    seedStaff('sa', 'superadmin');
    seedStaff('t', 'operacoes');
    await call(adminSetStaffStatus, { targetUid: 't', status: 'suspended', reason: REASON }, ctx('sa'));
    const before = auditDocs().length;
    const again = await call(adminSetStaffStatus, { targetUid: 't', status: 'suspended', reason: REASON }, ctx('sa'));
    expect(again.changed).toBe(false);
    expect(auditDocs()).toHaveLength(before);
  });

  it('rejects invalid status values and requires a reason', async () => {
    seedStaff('sa', 'superadmin');
    seedStaff('t', 'operacoes');
    await expectCode(call(adminSetStaffStatus, { targetUid: 't', status: 'deleted', reason: REASON }, ctx('sa')), 'invalid-argument');
    await expectCode(call(adminSetStaffStatus, { targetUid: 't', status: 'suspended' }, ctx('sa')), 'invalid-argument');
  });

  it('cannot suspend a user that has no administrative access', async () => {
    seedStaff('sa', 'superadmin');
    seedUser('plain');
    await expectCode(call(adminSetStaffStatus, { targetUid: 'plain', status: 'suspended', reason: REASON }, ctx('sa')), 'failed-precondition');
  });
});

describe('legacy setAdminClaim', () => {
  it('a legacy admin can no longer promote others (needs usuarios:admin)', async () => {
    seedUser('legacy', 'admin');
    seedUser('t');
    await expectCode(call(setAdminClaim, { targetUid: 't', isAdmin: true }, ctx('legacy', { admin: true })), 'permission-denied');
    expect(fakeDb.read('users/t')?.role).toBe('client');
  });

  it('superadmin promotes and revokes through the RBAC engine (audited)', async () => {
    seedStaff('sa', 'superadmin');
    seedUser('t');
    const up = await call(setAdminClaim, { targetUid: 't', isAdmin: true }, ctx('sa'));
    expect(up).toMatchObject({ success: true, isAdmin: true });
    expect(fakeDb.read('role_assignments/t')).toMatchObject({ roleId: 'admin', status: 'active' });
    expect(fakeDb.read('users/t')?.role).toBe('admin');

    await call(setAdminClaim, { targetUid: 't', isAdmin: false }, ctx('sa'));
    expect(fakeDb.read('role_assignments/t')?.status).toBe('archived');
    expect(fakeDb.read('users/t')?.role).toBe('client');
    expect(auditDocs().map((l) => l.action)).toEqual(expect.arrayContaining(['staff.assign_role', 'staff.archive']));
  });

  it('keeps the self-demotion guard', async () => {
    seedStaff('sa', 'superadmin');
    await expectCode(call(setAdminClaim, { targetUid: 'sa', isAdmin: false }, ctx('sa')), 'failed-precondition');
  });
});

describe('adminUpsertRole', () => {
  it('creates a custom role with versioning and audit', async () => {
    seedStaff('sa', 'superadmin');
    const r = await call(
      adminUpsertRole,
      { roleId: 'gerente_loja', label: 'Gerente', description: 'x', permissions: ['pedidos:view', 'pedidos:edit'], reason: REASON },
      ctx('sa'),
    );
    expect(r).toMatchObject({ success: true, version: 1 });
    expect(fakeDb.read('roles/gerente_loja')).toMatchObject({ permissions: ['pedidos:edit', 'pedidos:view'], active: true, system: false, createdBy: 'sa' });
    const r2 = await call(
      adminUpsertRole,
      { roleId: 'gerente_loja', label: 'Gerente', permissions: ['pedidos:view'], reason: REASON },
      ctx('sa'),
    );
    expect(r2.version).toBe(2);
    const last = auditDocs().filter((l) => l.action === 'role.upsert').pop()!;
    expect(last.entityId).toBe('gerente_loja');
  });

  it('rejects the immutable superadmin role, bad ids and unknown permissions', async () => {
    seedStaff('sa', 'superadmin');
    const base = { label: 'Rótulo', permissions: ['pedidos:view'], reason: REASON };
    await expectCode(call(adminUpsertRole, { ...base, roleId: 'superadmin' }, ctx('sa')), 'failed-precondition');
    await expectCode(call(adminUpsertRole, { ...base, roleId: 'Bad Id!' }, ctx('sa')), 'invalid-argument');
    await expectCode(call(adminUpsertRole, { ...base, roleId: 'novo_papel', permissions: ['pedidos:destroy'] }, ctx('sa')), 'invalid-argument');
  });

  it('prevents privilege escalation: you cannot grant permissions you do not hold', async () => {
    seedStaff('sa', 'superadmin');
    await call(adminUpsertRole, { roleId: 'gestor', label: 'Gestor', permissions: ['usuarios:admin', 'pedidos:view'], reason: REASON }, ctx('sa'));
    seedStaff('mgr', 'gestor');
    await expectCode(
      call(adminUpsertRole, { roleId: 'ninja', label: 'Ninja', permissions: ['financeiro:approve'], reason: REASON }, ctx('mgr')),
      'permission-denied',
    );
    const ok = await call(adminUpsertRole, { roleId: 'leitor', label: 'Leitor', permissions: ['pedidos:view'], reason: REASON }, ctx('mgr'));
    expect(ok.success).toBe(true);
  });

  it('refuses to deactivate system roles or roles still in use', async () => {
    seedStaff('sa', 'superadmin');
    await expectCode(
      call(adminUpsertRole, { roleId: 'analista', label: 'Analista', permissions: ['dashboard:view'], active: false, reason: REASON }, ctx('sa')),
      'failed-precondition',
    );
    await call(adminUpsertRole, { roleId: 'temporario', label: 'Temp', permissions: ['pedidos:view'], reason: REASON }, ctx('sa'));
    seedStaff('user1', 'temporario');
    await expectCode(
      call(adminUpsertRole, { roleId: 'temporario', label: 'Temp', permissions: ['pedidos:view'], active: false, reason: REASON }, ctx('sa')),
      'failed-precondition',
    );
  });

  it('is denied to roles without usuarios:admin', async () => {
    seedStaff('op', 'operacoes');
    await expectCode(
      call(adminUpsertRole, { roleId: 'x_role', label: 'X', permissions: ['pedidos:view'], reason: REASON }, ctx('op')),
      'permission-denied',
    );
  });
});

describe('adminSeedRoles (additive, idempotent, dry-run by default)', () => {
  it('dry-run is the default and writes nothing', async () => {
    seedStaff('sa', 'superadmin');
    const r = await call(adminSeedRoles, {}, ctx('sa'));
    expect(r.dryRun).toBe(true);
    expect(r.toCreate).toHaveLength(8);
    expect(fakeDb.listPaths('roles/')).toHaveLength(0);
    expect(auditDocs()).toHaveLength(0);
  });

  it('applies once, never overwrites edited roles and is idempotent', async () => {
    seedStaff('sa', 'superadmin');
    fakeDb.seed('roles/analista', { id: 'analista', permissions: ['dashboard:view'], active: true, label: 'Customizado' });

    const first = await call(adminSeedRoles, { dryRun: false, reason: REASON }, ctx('sa'));
    expect(first.created).toHaveLength(7);
    expect(first.existing).toEqual(['analista']);
    expect(fakeDb.read('roles/analista')?.label).toBe('Customizado');

    const second = await call(adminSeedRoles, { dryRun: false, reason: REASON }, ctx('sa'));
    expect(second.created).toEqual([]);
    expect(auditDocs().filter((l) => l.action === 'roles.seed')).toHaveLength(1);
  });

  it('requires a reason when applying', async () => {
    seedStaff('sa', 'superadmin');
    await expectCode(call(adminSeedRoles, { dryRun: false }, ctx('sa')), 'invalid-argument');
  });
});

describe('listing', () => {
  it('adminListStaff includes legacy admins not yet migrated and is denied without usuarios:view', async () => {
    seedStaff('sa', 'superadmin');
    seedStaff('op', 'operacoes');
    seedUser('legacy1', 'admin');
    const r = await call(adminListStaff, {}, ctx('sa'));
    const byUid = Object.fromEntries((r.staff as any[]).map((s) => [s.uid, s]));
    expect(byUid.sa).toMatchObject({ roleId: 'superadmin', legacy: false });
    expect(byUid.legacy1).toMatchObject({ roleId: 'admin', legacy: true });
    await expectCode(call(adminListStaff, {}, ctx('op')), 'permission-denied');
  });

  it('adminListRoles merges built-in and custom roles', async () => {
    seedStaff('sa', 'superadmin');
    fakeDb.seed('roles/custom_x', { id: 'custom_x', label: 'Custom', permissions: ['pedidos:view'], active: true });
    const r = await call(adminListRoles, {}, ctx('sa'));
    const ids = (r.roles as any[]).map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(['superadmin', 'admin', 'operacoes', 'financeiro', 'marketing', 'suporte', 'catalogo', 'analista', 'custom_x']));
    expect(r.roles.find((x: any) => x.id === 'superadmin').permissions).toEqual(['*']);
  });
});

describe('adminListAudit', () => {
  function seedAudit(id: string, ms: number, over: Record<string, unknown> = {}) {
    fakeDb.seed(`audit_logs/${id}`, {
      actorUid: 'sa',
      action: 'staff.assign_role',
      module: 'usuarios',
      entityType: 'role_assignment',
      entityId: 'x',
      result: 'success',
      createdAt: new FakeTimestamp(ms),
      ...over,
    });
  }

  it('requires auditoria:view (operacoes lacks it, admin has it)', async () => {
    seedStaff('op', 'operacoes');
    seedStaff('adm', 'admin');
    await expectCode(call(adminListAudit, {}, ctx('op')), 'permission-denied');
    await expect(call(adminListAudit, {}, ctx('adm'))).resolves.toHaveProperty('entries');
  });

  it('returns newest first, filters and paginates with a cursor', async () => {
    seedStaff('sa', 'superadmin');
    seedAudit('a1', 1000);
    seedAudit('a2', 2000, { module: 'pedidos', action: 'order.update' });
    seedAudit('a3', 3000);
    seedAudit('a4', 4000, { result: 'denied' });

    const all = await call(adminListAudit, { limit: 2 }, ctx('sa'));
    expect(all.entries.map((e: any) => e.id)).toEqual(['a4', 'a3']);
    expect(all.nextCursor).toBe(3000);

    const page2 = await call(adminListAudit, { limit: 2, startAfterMillis: all.nextCursor }, ctx('sa'));
    expect(page2.entries.map((e: any) => e.id)).toEqual(['a2', 'a1']);

    const byModule = await call(adminListAudit, { module: 'pedidos' }, ctx('sa'));
    expect(byModule.entries.map((e: any) => e.id)).toEqual(['a2']);

    const combined = await call(adminListAudit, { module: 'usuarios', result: 'denied' }, ctx('sa'));
    expect(combined.entries.map((e: any) => e.id)).toEqual(['a4']);
    expect(combined.entries[0].createdAtMillis).toBe(4000);
  });
});
