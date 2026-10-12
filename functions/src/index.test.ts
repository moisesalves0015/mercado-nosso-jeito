import { describe, it, expect, beforeEach, beforeAll, jest } from '@jest/globals';
import * as functions from 'firebase-functions';

import type { buildAdminMock } from './__fakes__/fakeAdmin';

jest.mock('firebase-admin', () =>
  (jest.requireActual('./__fakes__/fakeAdmin') as { buildAdminMock: typeof buildAdminMock }).buildAdminMock(),
);

import { fakeDb, FakeTimestamp } from './__fakes__/fakeAdmin';
import { createOrder, cancelOrder, confirmPayment, updateOrderStatus } from './index';

/**
 * Behavioural tests: every case invokes the REAL callable handler from index.ts
 * against an in-memory Firestore (see __fakes__/fakeAdmin.ts).
 */

type Callable = { run: (data: unknown, ctx: unknown) => Promise<Record<string, unknown>> };
const call = (fn: unknown, data: unknown, ctx: unknown) => (fn as Callable).run(data, ctx);

const CUSTOMER = 'cust1';
const OTHER = 'cust2';
const ADMIN = 'adm1';

const asUser = (uid: string) => ({ auth: { uid, token: {} } });
const asAdmin = (uid = ADMIN) => ({ auth: { uid, token: { admin: true } } });
const anonymous = { auth: undefined };

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toMatchObject({ code });
}

function seedProduct(id: string, over: Record<string, unknown> = {}) {
  fakeDb.seed(`products/${id}`, {
    title: `Produto ${id}`,
    price: 10,
    stock: 10,
    active: true,
    image: 'https://example.com/x.png',
    ...over,
  });
}

function seedAddress(uid: string, over: Record<string, unknown> = {}) {
  fakeDb.seed(`users/${uid}/addresses/addr1`, {
    street: 'Rua das Flores',
    number: '10',
    neighborhood: 'Centro',
    city: 'Cidade',
    state: 'SP',
    zipCode: '00000-000',
    label: 'Casa',
    ...over,
  });
}

function seedShipping(over: Record<string, unknown> = {}) {
  fakeDb.seed('settings/shipping', {
    freeShippingThreshold: 60,
    baseShippingFee: 5,
    condos: {},
    ...over,
  });
}

let keyCounter = 0;
const newKey = () => `idem-key-${++keyCounter}-abcdefgh`;

function orderPayload(over: Record<string, unknown> = {}) {
  return {
    productItems: [{ productId: 'p1', quantity: 2 }],
    addressId: 'addr1',
    deliveryMethod: 'apartment',
    paymentMethod: 'pix',
    idempotencyKey: newKey(),
    ...over,
  };
}

const stockOf = (id: string) => fakeDb.read(`products/${id}`)?.stock;
const orderPaths = () => fakeDb.listPaths('orders/').filter((p) => p.split('/').length === 2);

function seedOrder(id: string, over: Record<string, unknown> = {}) {
  fakeDb.seed(`orders/${id}`, {
    uid: CUSTOMER,
    status: 'pending',
    paymentStatus: 'awaiting_confirmation',
    paymentMethod: 'Pix',
    items: [{ id: 'p1', title: 'Produto p1', price: 10, quantity: 2 }],
    timeline: [{ status: 'pending', label: 'Pedido criado' }],
    ...over,
  });
}

beforeAll(() => {
  // Keep test output readable.
  jest.spyOn(functions.logger, 'info').mockImplementation(() => undefined);
  jest.spyOn(functions.logger, 'warn').mockImplementation(() => undefined);
  jest.spyOn(functions.logger, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

beforeEach(() => {
  fakeDb.reset();
  seedProduct('p1');
  seedAddress(CUSTOMER);
  seedShipping();
});

describe('createOrder', () => {
  it('rejeita cliente não autenticado e não cria pedido', async () => {
    await expectCode(call(createOrder, orderPayload(), anonymous), 'unauthenticated');
    expect(orderPaths()).toHaveLength(0);
    expect(stockOf('p1')).toBe(10);
  });

  it('só aceita endereço do próprio usuário', async () => {
    // Address exists only under OTHER; CUSTOMER must not be able to use it.
    fakeDb.reset();
    seedProduct('p1');
    seedShipping();
    seedAddress(OTHER);
    await expectCode(call(createOrder, orderPayload(), asUser(CUSTOMER)), 'not-found');
    expect(orderPaths()).toHaveLength(0);
    expect(stockOf('p1')).toBe(10);
  });

  it('calcula preço e frete no servidor, grava pagamento aguardando conferência e baixa o estoque', async () => {
    const res = await call(createOrder, orderPayload(), asUser(CUSTOMER));
    expect(res).toMatchObject({ subtotal: 20, deliveryFee: 5, discount: 0, total: 25, status: 'pending' });

    const order = fakeDb.read(`orders/${res.orderId}`)!;
    expect(order.uid).toBe(CUSTOMER);
    expect(order.status).toBe('pending');
    expect(order.paymentStatus).toBe('awaiting_confirmation');
    expect(order.paymentMethod).toBe('Pix');
    expect(stockOf('p1')).toBe(8);
  });

  it('ignora preço e total enviados pelo cliente', async () => {
    const res = await call(
      createOrder,
      { ...orderPayload(), price: 0.01, total: 0.01, deliveryFee: 0, productItems: [{ productId: 'p1', quantity: 2, price: 0.01 }] },
      asUser(CUSTOMER),
    );
    expect(res.total).toBe(25);
  });

  it('usa preço promocional ativo do servidor', async () => {
    seedProduct('p1', { promoActive: true, promoPrice: 8 });
    const res = await call(createOrder, orderPayload(), asUser(CUSTOMER));
    expect(res.subtotal).toBe(16);
  });

  it('frete grátis quando o subtotal atinge o limite configurado', async () => {
    seedProduct('p1', { price: 40, stock: 5 });
    const res = await call(createOrder, orderPayload(), asUser(CUSTOMER));
    expect(res).toMatchObject({ subtotal: 80, deliveryFee: 0, total: 80 });
  });

  it('aplica taxa específica do condomínio quando o endereço corresponde', async () => {
    seedShipping({ condos: { 'Residencial Sol': 3 } });
    seedAddress(CUSTOMER, { street: 'Residencial Sol - Bloco A' });
    const res = await call(createOrder, orderPayload(), asUser(CUSTOMER));
    expect(res.deliveryFee).toBe(3);
  });

  it('recusa o pedido quando o frete não está configurado (sem cobrar valores padrão)', async () => {
    fakeDb.reset();
    seedProduct('p1');
    seedAddress(CUSTOMER);
    // intentionally NO /settings/shipping and NO /configs/shipping
    await expectCode(call(createOrder, orderPayload(), asUser(CUSTOMER)), 'failed-precondition');
    expect(orderPaths()).toHaveLength(0);
    expect(stockOf('p1')).toBe(10);
  });

  it('rejeita produto inexistente', async () => {
    await expectCode(
      call(createOrder, orderPayload({ productItems: [{ productId: 'nao-existe', quantity: 1 }] }), asUser(CUSTOMER)),
      'not-found',
    );
    expect(orderPaths()).toHaveLength(0);
  });

  it('rejeita produto inativo sem alterar estoque', async () => {
    seedProduct('p1', { active: false });
    await expectCode(call(createOrder, orderPayload(), asUser(CUSTOMER)), 'failed-precondition');
    expect(orderPaths()).toHaveLength(0);
    expect(stockOf('p1')).toBe(10);
  });

  it('rejeita estoque insuficiente sem alterar estoque', async () => {
    seedProduct('p1', { stock: 1 });
    await expectCode(call(createOrder, orderPayload(), asUser(CUSTOMER)), 'failed-precondition');
    expect(orderPaths()).toHaveLength(0);
    expect(stockOf('p1')).toBe(1);
  });

  it('rejeita produto sem estoque definido e preço não positivo', async () => {
    seedProduct('p1', { stock: undefined });
    await expectCode(call(createOrder, orderPayload(), asUser(CUSTOMER)), 'failed-precondition');
    seedProduct('p1', { price: 0 });
    await expectCode(call(createOrder, orderPayload(), asUser(CUSTOMER)), 'failed-precondition');
    expect(orderPaths()).toHaveLength(0);
  });

  it('rejeita cartão de crédito (sem gateway) e métodos desconhecidos', async () => {
    await expectCode(call(createOrder, orderPayload({ paymentMethod: 'credit_card' }), asUser(CUSTOMER)), 'invalid-argument');
    await expectCode(call(createOrder, orderPayload({ paymentMethod: 'bitcoin' }), asUser(CUSTOMER)), 'invalid-argument');
    expect(orderPaths()).toHaveLength(0);
  });

  it('pagamento na entrega nasce com paymentStatus on_delivery (não como Pix pago)', async () => {
    const res = await call(createOrder, orderPayload({ paymentMethod: 'on_delivery' }), asUser(CUSTOMER));
    const order = fakeDb.read(`orders/${res.orderId}`)!;
    expect(order.paymentStatus).toBe('on_delivery');
    expect(order.paymentMethod).toBe('Pagamento na Entrega');
  });

  describe('cupons', () => {
    it('aplica desconto percentual calculado no servidor e conta o uso', async () => {
      fakeDb.seed('coupons/DEZ', { active: true, type: 'percentage', value: 0.1, usesCount: 0, maxUses: 5 });
      const res = await call(createOrder, orderPayload({ couponCode: 'dez' }), asUser(CUSTOMER));
      expect(res).toMatchObject({ discount: 2, total: 23, couponApplied: true });
      expect(fakeDb.read('coupons/DEZ')!.usesCount).toBe(1);
    });

    it('rejeita cupom expirado, inativo, inexistente e esgotado sem baixar estoque', async () => {
      fakeDb.seed('coupons/VELHO', {
        active: true, type: 'fixed', value: 5, expiresAt: FakeTimestamp.fromDate(new Date(Date.now() - 86_400_000)),
      });
      fakeDb.seed('coupons/OFF', { active: false, type: 'fixed', value: 5 });
      fakeDb.seed('coupons/ESGOTADO', { active: true, type: 'fixed', value: 5, maxUses: 3, usesCount: 3 });

      for (const code of ['VELHO', 'OFF', 'ESGOTADO']) {
        await expectCode(call(createOrder, orderPayload({ couponCode: code }), asUser(CUSTOMER)), 'failed-precondition');
      }
      await expectCode(call(createOrder, orderPayload({ couponCode: 'NAOEXISTE' }), asUser(CUSTOMER)), 'not-found');
      expect(orderPaths()).toHaveLength(0);
      expect(stockOf('p1')).toBe(10);
    });

    it('respeita pedido mínimo do cupom', async () => {
      fakeDb.seed('coupons/MIN', { active: true, type: 'fixed', value: 5, minOrderValue: 100 });
      await expectCode(call(createOrder, orderPayload({ couponCode: 'MIN' }), asUser(CUSTOMER)), 'failed-precondition');
    });

    it('desconto fixo nunca ultrapassa o subtotal', async () => {
      fakeDb.seed('coupons/GRANDE', { active: true, type: 'fixed', value: 9999 });
      const res = await call(createOrder, orderPayload({ couponCode: 'GRANDE' }), asUser(CUSTOMER));
      expect(res.discount).toBe(20);
      expect(Number(res.total)).toBeGreaterThan(0);
    });
  });

  describe('idempotência', () => {
    it('mesma chave não duplica pedido nem baixa estoque duas vezes', async () => {
      const payload = orderPayload();
      const first = await call(createOrder, payload, asUser(CUSTOMER));
      const second = await call(createOrder, payload, asUser(CUSTOMER));

      expect(second.orderId).toBe(first.orderId);
      expect(orderPaths()).toHaveLength(1);
      expect(stockOf('p1')).toBe(8);
    });

    it('requisições simultâneas com a mesma chave criam um único pedido e retornam o mesmo orderId', async () => {
      const payload = orderPayload();
      const results = await Promise.all([
        call(createOrder, payload, asUser(CUSTOMER)),
        call(createOrder, payload, asUser(CUSTOMER)),
        call(createOrder, payload, asUser(CUSTOMER)),
      ]);

      const firstId = results[0].orderId;
      for (const res of results) {
        expect(res.orderId).toBe(firstId);
      }
      expect(orderPaths()).toHaveLength(1);
      expect(stockOf('p1')).toBe(8);
    });

    it('retry idempotente (ex.: após timeout) devolve o estado REAL do pedido, não "pending" fixo', async () => {
      const payload = orderPayload();
      const first = await call(createOrder, payload, asUser(CUSTOMER));
      expect(first).toMatchObject({ status: 'pending', paymentStatus: 'awaiting_confirmation' });

      await call(confirmPayment, { orderId: first.orderId }, asAdmin());
      await call(updateOrderStatus, { orderId: first.orderId, status: 'preparing' }, asAdmin());

      const retry = await call(createOrder, payload, asUser(CUSTOMER));
      expect(retry.orderId).toBe(first.orderId);
      expect(retry).toMatchObject({ status: 'preparing', paymentStatus: 'approved' });
      expect(orderPaths()).toHaveLength(1);
      expect(stockOf('p1')).toBe(8);
    });

    it('mesma chave com conteúdo diferente é rejeitada e não devolve o pedido antigo', async () => {
      const key = newKey();
      await call(createOrder, orderPayload({ idempotencyKey: key }), asUser(CUSTOMER));

      await expectCode(
        call(createOrder, orderPayload({ idempotencyKey: key, productItems: [{ productId: 'p1', quantity: 5 }] }), asUser(CUSTOMER)),
        'already-exists',
      );
      expect(orderPaths()).toHaveLength(1);
      expect(stockOf('p1')).toBe(8);
    });

    it('a ordem dos itens e a consolidação de duplicados não alteram a identidade do pedido', async () => {
      seedProduct('p2');
      const key = newKey();
      const a = await call(
        createOrder,
        orderPayload({ idempotencyKey: key, productItems: [{ productId: 'p1', quantity: 1 }, { productId: 'p2', quantity: 1 }, { productId: 'p1', quantity: 1 }] }),
        asUser(CUSTOMER),
      );
      const b = await call(
        createOrder,
        orderPayload({ idempotencyKey: key, productItems: [{ productId: 'p2', quantity: 1 }, { productId: 'p1', quantity: 2 }] }),
        asUser(CUSTOMER),
      );
      expect(b.orderId).toBe(a.orderId);
      expect(orderPaths()).toHaveLength(1);
    });

    it('chaves diferentes criam pedidos diferentes', async () => {
      await call(createOrder, orderPayload(), asUser(CUSTOMER));
      await call(createOrder, orderPayload(), asUser(CUSTOMER));
      expect(orderPaths()).toHaveLength(2);
      expect(stockOf('p1')).toBe(6);
    });

    it('pedidos simultâneos não vendem mais do que o estoque', async () => {
      seedProduct('p1', { stock: 3 });
      const results = await Promise.allSettled([
        call(createOrder, orderPayload({ productItems: [{ productId: 'p1', quantity: 2 }] }), asUser(CUSTOMER)),
        call(createOrder, orderPayload({ productItems: [{ productId: 'p1', quantity: 2 }] }), asUser(CUSTOMER)),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(stockOf('p1')).toBe(1);
    });
  });
});

describe('cancelOrder', () => {
  beforeEach(() => {
    seedProduct('p1', { stock: 8 }); // 2 units already reserved by the seeded order
  });

  it('cliente cancela pedido pendente: devolve estoque, rejeita pagamento e registra evento', async () => {
    seedOrder('o1');
    await call(cancelOrder, { orderId: 'o1', reason: 'Desisti' }, asUser(CUSTOMER));

    const order = fakeDb.read('orders/o1')!;
    expect(order.status).toBe('cancelled');
    expect(order.paymentStatus).toBe('rejected');
    expect(order.cancelledBy).toBe(CUSTOMER);
    expect((order.timeline as unknown[]).length).toBe(2);
    expect(stockOf('p1')).toBe(10);
  });

  it('chamada repetida não devolve estoque de novo', async () => {
    seedOrder('o1');
    await call(cancelOrder, { orderId: 'o1' }, asUser(CUSTOMER));
    await expect(call(cancelOrder, { orderId: 'o1' }, asUser(CUSTOMER))).rejects.toBeDefined();
    expect(stockOf('p1')).toBe(10);
  });

  it('chamadas simultâneas devolvem estoque exatamente uma vez', async () => {
    seedOrder('o1');
    const results = await Promise.allSettled([
      call(cancelOrder, { orderId: 'o1' }, asUser(CUSTOMER)),
      call(cancelOrder, { orderId: 'o1' }, asUser(CUSTOMER)),
      call(cancelOrder, { orderId: 'o1' }, asAdmin()),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(stockOf('p1')).toBe(10);
    expect((fakeDb.read('orders/o1')!.timeline as unknown[]).length).toBe(2);
  });

  it('cliente não cancela pedido em preparo, entrega ou entregue', async () => {
    for (const status of ['preparing', 'delivering', 'delivered']) {
      seedOrder('o1', { status });
      await expectCode(call(cancelOrder, { orderId: 'o1' }, asUser(CUSTOMER)), 'failed-precondition');
    }
    expect(fakeDb.read('orders/o1')!.status).toBe('delivered');
    expect(stockOf('p1')).toBe(8);
  });

  it('cliente não cancela pedido de outro usuário', async () => {
    seedOrder('o1');
    await expectCode(call(cancelOrder, { orderId: 'o1' }, asUser(OTHER)), 'permission-denied');
    expect(fakeDb.read('orders/o1')!.status).toBe('pending');
    expect(stockOf('p1')).toBe(8);
  });

  it('exige autenticação', async () => {
    seedOrder('o1');
    await expectCode(call(cancelOrder, { orderId: 'o1' }, anonymous), 'unauthenticated');
  });

  it('admin pode cancelar pedido em entrega e o estoque é devolvido', async () => {
    seedOrder('o1', { status: 'delivering', paymentStatus: 'approved' });
    await call(cancelOrder, { orderId: 'o1', reason: 'Cliente ausente' }, asAdmin());
    expect(fakeDb.read('orders/o1')!.status).toBe('cancelled');
    expect(stockOf('p1')).toBe(10);
  });
});

describe('confirmPayment', () => {
  it('cliente (inclusive o dono do pedido) não confirma pagamento', async () => {
    seedOrder('o1');
    await expectCode(call(confirmPayment, { orderId: 'o1' }, asUser(CUSTOMER)), 'permission-denied');
    await expectCode(call(confirmPayment, { orderId: 'o1' }, anonymous), 'unauthenticated');
    const order = fakeDb.read('orders/o1')!;
    expect(order.paymentStatus).toBe('awaiting_confirmation');
    expect(order.paidAt).toBeUndefined();
  });

  it('usuário com role=admin apenas no perfil também é aceito (fallback documentado)', async () => {
    seedOrder('o1');
    fakeDb.seed(`users/${OTHER}`, { role: 'admin' });
    await call(confirmPayment, { orderId: 'o1' }, asUser(OTHER));
    expect(fakeDb.read('orders/o1')!.paymentStatus).toBe('approved');
  });

  it('admin confirma: grava paymentStatus, paidAt, confirmedBy, referência e timeline', async () => {
    seedOrder('o1');
    await call(confirmPayment, { orderId: 'o1', paymentReference: 'E2E123', note: 'Conferido no extrato' }, asAdmin());

    const order = fakeDb.read('orders/o1')!;
    expect(order.paymentStatus).toBe('approved');
    expect(order.status).toBe('confirmed');
    expect(order.confirmedBy).toBe(ADMIN);
    expect(order.paymentReference).toBe('E2E123');
    expect(order.paidAt).toBeDefined();
    expect((order.timeline as unknown[]).length).toBe(2);
  });

  it('chamada repetida (e simultânea) não duplica histórico', async () => {
    seedOrder('o1');
    await Promise.all([
      call(confirmPayment, { orderId: 'o1' }, asAdmin()),
      call(confirmPayment, { orderId: 'o1' }, asAdmin()),
    ]);
    await call(confirmPayment, { orderId: 'o1' }, asAdmin());

    expect((fakeDb.read('orders/o1')!.timeline as unknown[]).length).toBe(2);
    const updates = fakeDb.commits.filter((c) => c.op === 'update' && c.path === 'orders/o1');
    expect(updates).toHaveLength(1);
  });

  it('não confirma pagamento de pedido cancelado', async () => {
    seedOrder('o1', { status: 'cancelled' });
    await expectCode(call(confirmPayment, { orderId: 'o1' }, asAdmin()), 'failed-precondition');
    expect(fakeDb.read('orders/o1')!.paymentStatus).toBe('awaiting_confirmation');
  });

  it('pedido inexistente retorna not-found', async () => {
    await expectCode(call(confirmPayment, { orderId: 'fantasma' }, asAdmin()), 'not-found');
  });
});

describe('updateOrderStatus', () => {
  it('somente admin atualiza o status operacional', async () => {
    seedOrder('o1', { paymentStatus: 'approved' });
    await expectCode(call(updateOrderStatus, { orderId: 'o1', status: 'preparing' }, asUser(CUSTOMER)), 'permission-denied');
    await expectCode(call(updateOrderStatus, { orderId: 'o1', status: 'preparing' }, anonymous), 'unauthenticated');
    expect(fakeDb.read('orders/o1')!.status).toBe('pending');
  });

  it('bloqueia preparo/entrega enquanto o pagamento aguarda conferência', async () => {
    seedOrder('o1');
    await expectCode(call(updateOrderStatus, { orderId: 'o1', status: 'preparing' }, asAdmin()), 'failed-precondition');
    await expectCode(call(updateOrderStatus, { orderId: 'o1', status: 'delivering' }, asAdmin()), 'failed-precondition');
    expect(fakeDb.read('orders/o1')!.status).toBe('pending');
  });

  it('bloqueia preparo de pagamento rejeitado', async () => {
    seedOrder('o1', { paymentStatus: 'rejected' });
    await expectCode(call(updateOrderStatus, { orderId: 'o1', status: 'preparing' }, asAdmin()), 'failed-precondition');
  });

  it('percorre o ciclo completo após pagamento aprovado, registrando cada etapa', async () => {
    seedOrder('o1');
    await call(confirmPayment, { orderId: 'o1' }, asAdmin());
    for (const status of ['preparing', 'delivering', 'delivered']) {
      await call(updateOrderStatus, { orderId: 'o1', status }, asAdmin());
    }
    const order = fakeDb.read('orders/o1')!;
    expect(order.status).toBe('delivered');
    expect((order.timeline as unknown[]).length).toBe(5);
  });

  it('pagamento na entrega avança sem Pix e vira aprovado só ao entregar', async () => {
    seedOrder('o1', { paymentStatus: 'on_delivery', paymentMethod: 'Pagamento na Entrega' });
    await call(updateOrderStatus, { orderId: 'o1', status: 'preparing' }, asAdmin());
    expect(fakeDb.read('orders/o1')!.paymentStatus).toBe('on_delivery');
    await call(updateOrderStatus, { orderId: 'o1', status: 'delivered' }, asAdmin());
    expect(fakeDb.read('orders/o1')!.paymentStatus).toBe('approved');
  });

  it('rejeita status desconhecido', async () => {
    seedOrder('o1', { paymentStatus: 'approved' });
    await expectCode(call(updateOrderStatus, { orderId: 'o1', status: 'teleportado' }, asAdmin()), 'invalid-argument');
  });

  it('cancelar por aqui devolve estoque uma vez e depois bloqueia alterações', async () => {
    seedProduct('p1', { stock: 8 });
    seedOrder('o1');
    await call(updateOrderStatus, { orderId: 'o1', status: 'cancelled' }, asAdmin());
    await expectCode(call(updateOrderStatus, { orderId: 'o1', status: 'cancelled' }, asAdmin()), 'failed-precondition');
    expect(stockOf('p1')).toBe(10);
  });
});
