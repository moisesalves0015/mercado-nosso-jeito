import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLES_BY_ID,
  permissionsAllow,
  permissionsAllowAny,
  resolveFrontendStaffAccess,
} from '../src/admin/permissions.ts';
import {
  ADMIN_NAV_ITEMS,
  LEGACY_ADMIN_REDIRECTS,
  resolveAdminBreadcrumbs,
} from '../src/admin/routes.ts';

describe('Admin Routes & Navigation Tree', () => {
  it('defines all 15 core administrative modules with valid permissions', () => {
    assert.equal(ADMIN_NAV_ITEMS.length, 15);
    const paths = ADMIN_NAV_ITEMS.map((i) => i.path);
    assert.deepEqual(paths, [
      '/admin/dashboard',
      '/admin/orders',
      '/admin/support',
      '/admin/customers',
      '/admin/products',
      '/admin/categories',
      '/admin/inventory',
      '/admin/finance',
      '/admin/marketing',
      '/admin/loyalty',
      '/admin/reports',
      '/admin/users',
      '/admin/roles',
      '/admin/audit',
      '/admin/settings',
    ]);

    for (const item of ADMIN_NAV_ITEMS) {
      assert.ok(item.requiredPermissions.length > 0, `${item.id} must require permissions`);
      for (const perm of item.requiredPermissions) {
        assert.ok(
          ALL_PERMISSIONS.includes(perm as never),
          `Permission ${perm} on route ${item.path} must belong to the RBAC catalogue`,
        );
      }
    }
  });

  it('resolves breadcrumbs for list, detail, creation and 404 admin routes', () => {
    const dash = resolveAdminBreadcrumbs('/admin/dashboard');
    assert.equal(dash.at(-1)?.label, 'Visão Geral');

    const orderDetail = resolveAdminBreadcrumbs('/admin/orders/ord_998877');
    assert.equal(orderDetail.length, 3);
    assert.equal(orderDetail[1].to, '/admin/orders');
    assert.match(orderDetail[2].label, /Pedido #ORD_998877/);

    const customerDetail = resolveAdminBreadcrumbs('/admin/customers/uid_abc123');
    assert.equal(customerDetail[1].to, '/admin/customers');
    assert.match(customerDetail[2].label, /Ficha do Morador/);

    const ticketDetail = resolveAdminBreadcrumbs('/admin/support/tck_5544');
    assert.equal(ticketDetail[1].to, '/admin/support');
    assert.match(ticketDetail[2].label, /Chamado #TCK_5544/);

    const prodNew = resolveAdminBreadcrumbs('/admin/products/new');
    assert.equal(prodNew[1].to, '/admin/products');
    assert.equal(prodNew[2].label, 'Novo Produto');

    const prodDetail = resolveAdminBreadcrumbs('/admin/products/prod_10');
    assert.equal(prodDetail[1].to, '/admin/products');
    assert.match(prodDetail[2].label, /Produto #prod_10/);

    const prodView = resolveAdminBreadcrumbs('/admin/products/prod_10/view');
    assert.equal(prodView[1].to, '/admin/products');
    assert.match(prodView[2].label, /Ficha #prod_10/);

    const prodEdit = resolveAdminBreadcrumbs('/admin/products/prod_10/edit');
    assert.equal(prodEdit[1].to, '/admin/products');
    assert.match(prodEdit[2].label, /Editar #prod_10/);

    const prodMetrics = resolveAdminBreadcrumbs('/admin/products/prod_10/metrics');
    assert.equal(prodMetrics[1].to, '/admin/products');
    assert.match(prodMetrics[2].label, /Métricas #prod_10/);

    const userDetail = resolveAdminBreadcrumbs('/admin/users/staff_99');
    assert.equal(userDetail[1].to, '/admin/users');
    assert.match(userDetail[2].label, /Membro/);

    const notFound = resolveAdminBreadcrumbs('/admin/rota-inexistente');
    assert.equal(notFound.at(-1)?.label, 'Página não encontrada');
  });

  it('maps legacy PT-BR admin URLs to canonical routes', () => {
    const map = new Map(LEGACY_ADMIN_REDIRECTS.map((r) => [r.from, r.to]));
    assert.equal(map.get('/admin/pedidos'), '/admin/orders');
    assert.equal(map.get('/admin/clientes'), '/admin/customers');
    assert.equal(map.get('/admin/suporte'), '/admin/support');
    assert.equal(map.get('/admin/categorias'), '/admin/categories');
    assert.equal(map.get('/admin/estoque'), '/admin/inventory');
    assert.equal(map.get('/admin/financeiro'), '/admin/finance');
    assert.equal(map.get('/admin/usuarios'), '/admin/users');
    assert.equal(map.get('/admin/papeis'), '/admin/roles');
    assert.equal(map.get('/admin/auditoria'), '/admin/audit');
  });
});

describe('Frontend RBAC Access Resolution (resolveFrontendStaffAccess)', () => {
  it('blocks suspended or archived staff immediately even with stale admin:true token claim', () => {
    const suspended = resolveFrontendStaffAccess({
      uid: 'u_sus',
      userRole: 'admin',
      tokenClaims: { admin: true, superadmin: true },
      assignmentDoc: { roleId: 'admin', status: 'suspended' },
    });
    assert.equal(suspended.isStaff, false);
    assert.equal(suspended.status, 'suspended');
    assert.deepEqual(suspended.permissions, []);

    const archived = resolveFrontendStaffAccess({
      uid: 'u_arc',
      userRole: 'admin',
      tokenClaims: { admin: true },
      assignmentDoc: { roleId: 'superadmin', status: 'archived' },
    });
    assert.equal(archived.isStaff, false);
    assert.equal(archived.status, 'archived');
    assert.deepEqual(archived.permissions, []);
  });

  it('blocks banned accounts regardless of assignment or token claims', () => {
    const banned = resolveFrontendStaffAccess({
      uid: 'u_ban',
      userRole: 'banned',
      tokenClaims: { admin: true },
      assignmentDoc: { roleId: 'superadmin', status: 'active' },
    });
    assert.equal(banned.isStaff, false);
    assert.equal(banned.status, 'banned');
  });

  it('grants granular permissions for operacoes, financeiro, suporte, catalogo and analista', () => {
    const op = resolveFrontendStaffAccess({
      uid: 'u_op',
      userRole: 'client',
      assignmentDoc: { roleId: 'operacoes', status: 'active' },
    });
    assert.equal(op.isStaff, true);
    assert.equal(permissionsAllow(op.permissions, 'pedidos:edit'), true);
    assert.equal(permissionsAllow(op.permissions, 'estoque:edit'), true);
    assert.equal(permissionsAllow(op.permissions, 'usuarios:admin'), false);
    assert.equal(permissionsAllow(op.permissions, 'auditoria:view'), false);

    const fin = resolveFrontendStaffAccess({
      uid: 'u_fin',
      userRole: 'client',
      assignmentDoc: { roleId: 'financeiro', status: 'active' },
    });
    assert.equal(fin.isStaff, true);
    assert.equal(permissionsAllow(fin.permissions, 'financeiro:approve'), true);
    assert.equal(permissionsAllow(fin.permissions, 'pedidos:approve'), true);
    assert.equal(permissionsAllow(fin.permissions, 'produtos:edit'), false);

    const sup = resolveFrontendStaffAccess({
      uid: 'u_sup',
      userRole: 'client',
      assignmentDoc: { roleId: 'suporte', status: 'active' },
    });
    assert.equal(sup.isStaff, true);
    assert.equal(permissionsAllowAny(sup.permissions, ['suporte:edit', 'suporte:view']), true);
    assert.equal(permissionsAllow(sup.permissions, 'financeiro:approve'), false);

    const analista = resolveFrontendStaffAccess({
      uid: 'u_ana',
      userRole: 'client',
      assignmentDoc: { roleId: 'analista', status: 'active' },
    });
    assert.equal(analista.isStaff, true);
    assert.deepEqual(analista.permissions.sort(), ['dashboard:view', 'relatorios:view']);
    assert.equal(permissionsAllow(analista.permissions, 'pedidos:view'), false);
  });

  it('preserves backward compatibility for legacy admins without role_assignments doc', () => {
    const legacy = resolveFrontendStaffAccess({
      uid: 'u_leg',
      userRole: 'admin',
      tokenClaims: { admin: true },
      assignmentDoc: null,
    });
    assert.equal(legacy.isStaff, true);
    assert.equal(legacy.legacy, true);
    assert.equal(legacy.roleId, 'admin');
    assert.equal(legacy.isSuperadmin, false);
    assert.equal(permissionsAllow(legacy.permissions, 'pedidos:edit'), true);
    assert.equal(permissionsAllow(legacy.permissions, 'usuarios:admin'), false);
    assert.equal(DEFAULT_ROLES_BY_ID.superadmin.permissions[0], '*');
  });
});

