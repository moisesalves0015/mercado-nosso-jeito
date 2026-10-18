export interface AnalyticsOrder {
  status?: string;
  paymentStatus?: string;
  total?: number;
  createdAt?: unknown;
}

export interface AnalyticsProduct {
  category?: string;
  active?: boolean;
}

export interface SalesPoint {
  day: string;
  vendas: number;
  pedidos: number;
}

export interface MonthlyRevenuePoint {
  mes: string;
  receita: number;
}

export interface CategoryCount {
  name: string;
  value: number;
  color: string;
}

const CATEGORY_COLORS = ['#818cf8', '#f59e0b', '#10b981', '#ec4899', '#0ea5e9', '#8b5cf6', '#14b8a6'];

export function timestampToDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value && typeof value === 'object') {
    const timestamp = value as { toDate?: () => Date; seconds?: number };
    if (typeof timestamp.toDate === 'function') {
      try {
        const parsed = timestamp.toDate();
        return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
      } catch {
        return null;
      }
    }
    if (typeof timestamp.seconds === 'number') {
      const parsed = new Date(timestamp.seconds * 1000);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  return null;
}

export function isRecognizedSale(order: AnalyticsOrder): boolean {
  return order.status !== 'cancelled' && order.paymentStatus === 'approved';
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function buildWeeklySalesData(orders: AnalyticsOrder[], now = new Date()): SalesPoint[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const points = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() - (6 - index));
    return {
      key: dateKey(date),
      day: date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
      vendas: 0,
      pedidos: 0,
    };
  });
  const byDate = new Map(points.map(point => [point.key, point]));

  for (const order of orders) {
    if (!isRecognizedSale(order)) continue;
    const date = timestampToDate(order.createdAt);
    if (!date) continue;
    const point = byDate.get(dateKey(date));
    if (!point) continue;
    point.vendas += Number.isFinite(order.total) ? Number(order.total) : 0;
    point.pedidos += 1;
  }

  return points.map(({ day, vendas, pedidos }) => ({ day, vendas, pedidos }));
}

export function buildMonthlyRevenueData(orders: AnalyticsOrder[], now = new Date(), monthCount = 6): MonthlyRevenuePoint[] {
  const firstMonth = new Date(now.getFullYear(), now.getMonth() - monthCount + 1, 1);
  const points = Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      mes: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      receita: 0,
    };
  });
  const byMonth = new Map(points.map(point => [point.key, point]));

  for (const order of orders) {
    if (!isRecognizedSale(order)) continue;
    const date = timestampToDate(order.createdAt);
    if (!date) continue;
    const point = byMonth.get(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    if (point) point.receita += Number.isFinite(order.total) ? Number(order.total) : 0;
  }

  return points.map(({ mes, receita }) => ({ mes, receita }));
}

export function buildCatalogCategoryData(products: AnalyticsProduct[]): CategoryCount[] {
  const counts = new Map<string, number>();
  for (const product of products) {
    if (product.active === false) continue;
    const category = product.category?.trim() || 'Sem categoria';
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }

  return Array.from(counts, ([name, value], index) => ({
    name,
    value,
    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
  })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'pt-BR'));
}
