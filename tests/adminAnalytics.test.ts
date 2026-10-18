import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getEffectiveProductPrice } from '../src/utils/productPricing';
import {
  buildCatalogCategoryData,
  buildMonthlyRevenueData,
  buildWeeklySalesData,
  isRecognizedSale,
  timestampToDate,
} from '../src/utils/adminAnalytics';

describe('admin analytics', () => {
  it('usa preço promocional somente quando ativo e dentro da validade', () => {
    const now = new Date('2026-10-18T12:00:00.000Z');
    assert.equal(getEffectiveProductPrice({ price: 10, promoActive: true, promoPrice: 8 }, now), 8);
    assert.equal(getEffectiveProductPrice({ price: 'R$ 10,00', promoActive: true, promoPrice: 'R$ 8,00', promoExpiry: '2026-10-19T12:00:00.000Z' }, now), 8);
    assert.equal(getEffectiveProductPrice({ price: '10.00', promoActive: true, promoPrice: 8, promoExpiry: '2026-10-17T12:00:00.000Z' }, now), 10);
    assert.equal(getEffectiveProductPrice({ price: 10, promoActive: true, promoPrice: 10 }, now), 10);
  });

  it('converte datas comuns e timestamps do Firestore e rejeita valores inválidos', () => {
    const date = new Date('2026-10-18T12:00:00.000Z');
    assert.equal(timestampToDate(date)?.toISOString(), date.toISOString());
    assert.equal(timestampToDate(date.toISOString())?.toISOString(), date.toISOString());
    assert.equal(timestampToDate({ seconds: date.getTime() / 1000 })?.toISOString(), date.toISOString());
    assert.equal(timestampToDate({ toDate: () => date })?.toISOString(), date.toISOString());
    assert.equal(timestampToDate('não é data'), null);
    assert.equal(timestampToDate(null), null);
  });

  it('reconhece apenas pedidos pagos não cancelados como vendas realizadas', () => {
    assert.equal(isRecognizedSale({ status: 'delivered', paymentStatus: 'approved' }), true);
    assert.equal(isRecognizedSale({ status: 'cancelled', paymentStatus: 'approved' }), false);
    assert.equal(isRecognizedSale({ status: 'pending', paymentStatus: 'awaiting_confirmation' }), false);
  });

  it('agrega a semana somente a partir de pedidos aprovados e com data válida', () => {
    const now = new Date(2026, 9, 18, 12);
    const data = buildWeeklySalesData([
      { status: 'confirmed', paymentStatus: 'approved', total: 25, createdAt: new Date(2026, 9, 18, 9) },
      { status: 'pending', paymentStatus: 'awaiting_confirmation', total: 1000, createdAt: new Date(2026, 9, 18, 10) },
      { status: 'cancelled', paymentStatus: 'approved', total: 50, createdAt: new Date(2026, 9, 18, 11) },
      { status: 'delivered', paymentStatus: 'approved', total: 10, createdAt: { seconds: new Date(2026, 9, 17, 15).getTime() / 1000 } },
      { status: 'delivered', paymentStatus: 'approved', total: 99, createdAt: 'invalid' },
    ], now);

    assert.equal(data.length, 7);
    assert.equal(data[6].vendas, 25);
    assert.equal(data[6].pedidos, 1);
    assert.equal(data[5].vendas, 10);
    assert.equal(data.reduce((sum, point) => sum + point.vendas, 0), 35);
  });

  it('agrega receita por mês nos últimos seis meses com base em pedidos aprovados', () => {
    const now = new Date(2026, 9, 18, 12);
    const data = buildMonthlyRevenueData([
      { status: 'delivered', paymentStatus: 'approved', total: 40, createdAt: new Date(2026, 9, 3) },
      { status: 'confirmed', paymentStatus: 'approved', total: 10, createdAt: new Date(2026, 5, 22) },
      { status: 'pending', paymentStatus: 'awaiting_confirmation', total: 999, createdAt: new Date(2026, 9, 4) },
      { status: 'delivered', paymentStatus: 'approved', total: 20, createdAt: new Date(2026, 3, 30) },
    ], now);

    assert.equal(data.length, 6);
    assert.equal(data[1].receita, 10);
    assert.equal(data[4].receita, 0);
    assert.equal(data[5].receita, 40);
  });

  it('conta produtos ativos por categoria e não representa isso como percentual de vendas', () => {
    const data = buildCatalogCategoryData([
      { category: 'Bebidas' },
      { category: 'Bebidas', active: true },
      { category: 'Padaria', active: false },
      { active: true },
    ]);

    assert.deepEqual(data.map(({ name, value }) => ({ name, value })), [
      { name: 'Bebidas', value: 2 },
      { name: 'Sem categoria', value: 1 },
    ]);
    assert.equal(data.every(item => item.color.startsWith('#')), true);
  });
});
