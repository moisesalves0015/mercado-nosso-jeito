import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { buildAdminMock } from '../__fakes__/fakeAdmin';

jest.mock('firebase-admin', () =>
  (jest.requireActual('../__fakes__/fakeAdmin') as { buildAdminMock: typeof buildAdminMock }).buildAdminMock(),
);

import { fakeDb, FakeTimestamp } from '../__fakes__/fakeAdmin';
import { adminGetMetrics } from './metricsCallables';
import { adminListOrders, adminListCustomers, adminListProducts } from './opsCallables';

type Callable = { run: (data: unknown, ctx: unknown) => Promise<Record<string, unknown>> };
const call = (fn: unknown, data: unknown, ctx: unknown) => (fn as Callable).run(data, ctx);

describe('Server-side Metrics & Pagination (>200/250/300 datasets)', () => {
  const ctx = { auth: { uid: 'analista1', token: {} } };
  const adminCtx = { auth: { uid: 'admin1', token: { admin: true } } };

  beforeEach(() => {
    fakeDb.reset();
    fakeDb.seed('users/analista1', { role: 'client', name: 'Analista' });
    fakeDb.seed('role_assignments/analista1', { roleId: 'analista', status: 'active' });
    fakeDb.seed('users/admin1', { role: 'admin', name: 'Admin' });
  });

  it('agrega datasets > 200 pedidos, > 250 usuários, > 300 produtos e > 200 tickets sem truncar totais', async () => {
    const baseMs = Date.UTC(2026, 10, 10, 15, 0, 0); // 2026-11-10

    // 220 pedidos (> 200): 110 no condomínio Solar (R$ 10 cada), 110 no condomínio Lua (R$ 20 cada)
    for (let i = 1; i <= 220; i++) {
      const isSolar = i <= 110;
      fakeDb.seed(`orders/ord-${String(i).padStart(3, '0')}`, {
        uid: `cust-${i}`,
        status: i % 11 === 0 ? 'cancelled' : 'delivered',
        paymentStatus: i % 11 === 0 ? 'rejected' : 'approved',
        total: isSolar ? 10 : 20,
        createdAt: FakeTimestamp.fromMillis(baseMs + i * 1000),
        address: { condominio: isSolar ? 'Solar' : 'Lua' },
      });
    }

    // 260 usuários (> 250) (já temos analista1 e admin1 = 2, adicionamos 258)
    for (let i = 1; i <= 258; i++) {
      fakeDb.seed(`users/cust-${String(i).padStart(3, '0')}`, {
        role: 'client',
        name: `Morador ${i}`,
        email: `m${i}@test.local`,
      });
    }

    // 310 produtos (> 300)
    for (let i = 1; i <= 310; i++) {
      fakeDb.seed(`products/prod-${String(i).padStart(3, '0')}`, {
        title: `Produto ${i}`,
        price: 10,
        category: i % 2 === 0 ? 'Bebidas' : 'Padaria',
        stock: i <= 15 ? 2 : 20,
        minStock: 5,
        active: true,
      });
    }

    // 210 chamados (> 200)
    for (let i = 1; i <= 210; i++) {
      fakeDb.seed(`support_tickets/tck-${String(i).padStart(3, '0')}`, {
        status: i <= 205 ? 'open' : 'resolved',
        priority: 'medium',
        createdAt: FakeTimestamp.fromMillis(baseMs + i * 1000),
      });
    }

    const res = await call(adminGetMetrics, {}, ctx);
    const meta = res.meta as Record<string, unknown>;
    const totals = res.totals as Record<string, number>;

    expect(meta.currency).toBe('BRL');
    expect(meta.timezone).toBe('America/Sao_Paulo');
    expect(meta.truncated).toBe(false);

    // Todos os registros contabilizados sem corte em 200/250/300
    expect(totals.totalOrders).toBe(220);
    expect(totals.totalCustomersCount).toBe(260);
    expect(totals.totalProductsCount).toBe(310);
    expect(totals.activeProductsCount).toBe(310);
    expect(totals.lowStockCount).toBe(15);
    expect(totals.openTicketsCount).toBe(205);
    expect(totals.recognizedSalesCount).toBe(200); // 220 - 20 cancelados (múltiplos de 11)
    expect(totals.grossRevenue).toBe(3000); // 100*10 + 100*20

    // Filtro por condomínio
    const solar = await call(adminGetMetrics, { condominio: 'Solar' }, ctx);
    const solarTotals = solar.totals as Record<string, number>;
    expect(solarTotals.totalOrders).toBe(110);
    expect(solarTotals.recognizedSalesCount).toBe(100);
    expect(solarTotals.grossRevenue).toBe(1000);

    // Paginação por cursor percorre todos os 220 pedidos sem perda
    const collectedOrders: unknown[] = [];
    let cursor: number | null = null;
    do {
      const page = await call(adminListOrders, { limit: 100, startAfterMillis: cursor ?? undefined }, adminCtx);
      collectedOrders.push(...(page.orders as unknown[]));
      cursor = (page.nextCursor as number | null) ?? null;
    } while (cursor !== null);
    expect(collectedOrders.length).toBe(220);

    // Paginação de clientes > 250 e produtos > 300
    const collectedCustomers: unknown[] = [];
    let custCursor: string | null = null;
    do {
      const page = await call(adminListCustomers, { limit: 100, startAfterId: custCursor ?? undefined }, adminCtx);
      collectedCustomers.push(...(page.customers as unknown[]));
      custCursor = (page.nextCursor as string | null) ?? null;
    } while (custCursor !== null);
    expect(collectedCustomers.length).toBe(260);

    const collectedProducts: unknown[] = [];
    let prodCursor: string | null = null;
    do {
      const page = await call(adminListProducts, { limit: 200, startAfterId: prodCursor ?? undefined }, adminCtx);
      collectedProducts.push(...(page.products as unknown[]));
      prodCursor = (page.nextCursor as string | null) ?? null;
    } while (prodCursor !== null);
    expect(collectedProducts.length).toBe(310);
  });
});

