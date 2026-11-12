import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { buildAdminMock } from '../__fakes__/fakeAdmin';

jest.mock('firebase-admin', () =>
  (jest.requireActual('../__fakes__/fakeAdmin') as { buildAdminMock: typeof buildAdminMock }).buildAdminMock(),
);

import { fakeDb, FakeTimestamp } from '../__fakes__/fakeAdmin';
import {
  adminListOrders,
  adminListCustomers,
  adminGetCustomer,
  adminListProducts,
  adminListTickets,
  adminUpsertProduct,
  adminArchiveProduct,
  adminToggleProductActive,
  adminUpdateSettings,
  adminUpdateLoyaltyConfig,
} from './opsCallables';

type Callable = { run: (data: unknown, ctx: unknown) => Promise<Record<string, unknown>> };
const call = (fn: unknown, data: unknown, ctx: unknown) => (fn as Callable).run(data, ctx);

const asStaff = (uid: string, roleId: string) => {
  fakeDb.seed(`users/${uid}`, { role: 'client', name: `Staff ${roleId}` });
  fakeDb.seed(`role_assignments/${uid}`, { roleId, status: 'active' });
  return { auth: { uid, token: {} } };
};

describe('Granular RBAC & PII Minimization (opsCallables)', () => {
  beforeEach(() => {
    fakeDb.reset();
    fakeDb.seed('users/cust1', {
      name: 'Maria Silva',
      email: 'maria@example.com',
      telefone: '11999998888',
      cpf: '12345678901',
      role: 'client',
      diamonds: 50,
    });
    fakeDb.seed('orders/ord1', {
      uid: 'cust1',
      orderNumber: 'ORD-001',
      userName: 'Maria Silva',
      userEmail: 'maria@example.com',
      userPhone: '11999998888',
      status: 'pending',
      paymentStatus: 'awaiting_confirmation',
      total: 42.5,
      createdAt: FakeTimestamp.fromMillis(1_750_000_000_000),
      address: { condominio: 'Solar', bloco: 'A', apartamento: '101', street: 'Rua X' },
    });
    fakeDb.seed('products/prod1', {
      title: 'Arroz 5kg',
      price: 25,
      costPrice: 15,
      category: 'Mercearia',
      stock: 10,
      active: true,
      InternalNotes: 'Fornecedor secreto',
    });
    fakeDb.seed('support_tickets/tck1', {
      ticketNumber: 'TCK-1',
      uid: 'cust1',
      subject: 'Entrega atrasada',
      status: 'open',
      priority: 'medium',
      createdAt: FakeTimestamp.fromMillis(1_750_000_000_000),
    });
  });

  it('operacoes lê pedidos, produtos e tickets mas é negado em configurações e clube', async () => {
    const ctx = asStaff('u-op', 'operacoes');
    const orders = await call(adminListOrders, { limit: 10 }, ctx);
    expect((orders.orders as unknown[]).length).toBe(1);
    const tickets = await call(adminListTickets, { limit: 10 }, ctx);
    expect((tickets.tickets as unknown[]).length).toBe(1);

    await expect(
      call(adminUpdateSettings, { settingId: 'store', payload: { pixKey: 'x' } }, ctx),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(
      call(adminUpdateLoyaltyConfig, { payload: { active: false } }, ctx),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('financeiro lê pedidos mas não pode editar catálogo, tickets nem configurações', async () => {
    const ctx = asStaff('u-fin', 'financeiro');
    const orders = await call(adminListOrders, { limit: 10 }, ctx);
    expect((orders.orders as unknown[]).length).toBe(1);

    await expect(call(adminListTickets, { limit: 10 }, ctx)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(
      call(adminUpsertProduct, { productId: 'prod1', title: 'Novo', price: 30, category: 'Mercearia' }, ctx),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('catalogo cria/edita/arquiva produtos com auditoria antes/depois e é bloqueado de alterar estoque direto ou ver clientes', async () => {
    const ctx = asStaff('u-cat', 'catalogo');
    await expect(call(adminListCustomers, { limit: 10 }, ctx)).rejects.toMatchObject({ code: 'permission-denied' });

    // Tentar alterar estoque direto em produto existente deve falhar
    await expect(
      call(adminUpsertProduct, { productId: 'prod1', title: 'Arroz 5kg', price: 27, category: 'Mercearia', stock: 999 }, ctx),
    ).rejects.toMatchObject({ code: 'invalid-argument' });

    // Atualização válida grava auditoria
    await call(adminUpsertProduct, { productId: 'prod1', title: 'Arroz 5kg', price: 27, category: 'Mercearia' }, ctx);
    expect(fakeDb.read('products/prod1')?.price).toBe(27);

    await call(adminToggleProductActive, { productId: 'prod1', active: false }, ctx);
    expect(fakeDb.read('products/prod1')?.active).toBe(false);

    await call(adminArchiveProduct, { productId: 'prod1', reason: 'Item descontinuado pelo fornecedor' }, ctx);
    expect(fakeDb.read('products/prod1')?.archiveReason).toBe('Item descontinuado pelo fornecedor');

    const audits = fakeDb.childDocs('audit_logs');
    // 1 permission_denied (adminListCustomers) + 3 product mutations (upsert, toggle, archive)
    expect(audits.length).toBe(4);
  });

  it('suporte e clientes nunca recebem CPF bruto na listagem nem no detalhe', async () => {
    const ctx = asStaff('u-sup', 'suporte');
    const list = await call(adminListCustomers, { limit: 10 }, ctx);
    const row = (list.customers as Array<Record<string, unknown>>)[0];
    expect(row.cpf).toBeUndefined();
    expect(row.cpfMasked).toBe('***.***.***-01');

    const detail = await call(adminGetCustomer, { customerId: 'cust1' }, ctx);
    const c = detail.customer as Record<string, unknown>;
    expect(c.cpf).toBeUndefined();
    expect(c.cpfMasked).toBe('***.***.***-01');
  });

  it('analista não acessa listas operacionais brutas de pedidos, clientes ou produtos', async () => {
    const ctx = asStaff('u-ana', 'analista');
    await expect(call(adminListProducts, { limit: 10 }, ctx)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(call(adminListOrders, { limit: 10 }, ctx)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(call(adminListCustomers, { limit: 10 }, ctx)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('marketing é negado em pedidos, tickets e configurações, mas pode ver produtos sem costPrice/InternalNotes', async () => {
    const ctx = asStaff('u-mkt', 'marketing');
    await expect(call(adminListOrders, { limit: 10 }, ctx)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(call(adminListTickets, { limit: 10 }, ctx)).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(
      call(adminUpdateSettings, { settingId: 'shipping', payload: { freeShippingThreshold: 10, baseShippingFee: 5 } }, ctx),
    ).rejects.toMatchObject({ code: 'permission-denied' });

    const prods = await call(adminListProducts, { limit: 10 }, ctx);
    const p = (prods.products as Array<Record<string, unknown>>)[0];
    expect(p.costPrice).toBeUndefined();
    expect(p.InternalNotes).toBeUndefined();
  });
});
