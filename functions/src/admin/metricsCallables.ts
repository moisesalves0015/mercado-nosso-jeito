import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { publicCallable } from '../invoker';
import { requireAnyPermission } from './rbac';

const db = () => admin.firestore();
const HttpsError = functions.https.HttpsError;

const BATCH_SIZE = 200;
const TIMEZONE = 'America/Sao_Paulo';
const RECOGNIZED_EXCLUDED_STATUS = 'cancelled';

function toMillis(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const ms = Date.parse(val);
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof val === 'object' && typeof (val as { toMillis?: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return null;
}

function parseDateBound(isoDate: unknown, endOfDay: boolean): number | null {
  if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate.trim())) return null;
  // America/Sao_Paulo is UTC-03:00 year-round (no DST since 2019)
  const suffix = endOfDay ? 'T23:59:59.999-03:00' : 'T00:00:00.000-03:00';
  const ms = Date.parse(`${isoDate.trim()}${suffix}`);
  return Number.isNaN(ms) ? null : ms;
}

function getSaoPauloDateKey(ms: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms));
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

function getSaoPauloMonthKey(ms: number): string {
  return getSaoPauloDateKey(ms).slice(0, 7);
}

/** Iterates an entire collection in cursor batches so totals are never truncated at 200/250/300. */
async function scanCollectionInBatches(
  collectionName: string,
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const out: Array<{ id: string; data: Record<string, unknown> }> = [];
  let lastId: string | null = null;
  // Safety cap at 50k docs per invocation to prevent runaway memory in extreme scenarios
  for (let page = 0; page < 250; page++) {
    let q: FirebaseFirestore.Query = db()
      .collection(collectionName)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(BATCH_SIZE);
    if (lastId) q = q.startAfter(lastId);
    const snap = await q.get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      out.push({ id: d.id, data: d.data() as Record<string, unknown> });
    }
    if (snap.docs.length < BATCH_SIZE) break;
    lastId = snap.docs[snap.docs.length - 1].id;
  }
  return out;
}

export const adminGetMetrics = publicCallable.https.onCall(async (data, context) => {
  await requireAnyPermission(context.auth, ['dashboard:view', 'relatorios:view', 'financeiro:view']);
  const req = (data ?? {}) as {
    startDate?: unknown;
    endDate?: unknown;
    condominio?: unknown;
  };

  const startMs = req.startDate ? parseDateBound(req.startDate, false) : null;
  const endMs = req.endDate ? parseDateBound(req.endDate, true) : null;
  if (req.startDate && startMs === null) {
    throw new HttpsError('invalid-argument', 'startDate deve estar no formato YYYY-MM-DD.');
  }
  if (req.endDate && endMs === null) {
    throw new HttpsError('invalid-argument', 'endDate deve estar no formato YYYY-MM-DD.');
  }
  const condominioFilter =
    typeof req.condominio === 'string' && req.condominio.trim() && req.condominio.trim() !== 'all'
      ? req.condominio.trim()
      : null;

  const [orderDocs, productDocs, userDocs, ticketDocs] = await Promise.all([
    scanCollectionInBatches('orders'),
    scanCollectionInBatches('products'),
    scanCollectionInBatches('users'),
    scanCollectionInBatches('support_tickets'),
  ]);

  const condominioSet = new Set<string>();
  const condoAgg = new Map<string, { orders: number; revenue: number }>();

  let totalOrders = 0;
  let recognizedSalesCount = 0;
  let grossRevenue = 0;
  let pendingOrdersCount = 0;
  let awaitingPixCount = 0;

  const dayRevenue = new Map<string, { revenue: number; orders: number }>();
  const monthRevenue = new Map<string, { revenue: number; orders: number }>();

  for (const { data: o } of orderDocs) {
    const addr = (o.address as Record<string, unknown> | undefined) ?? undefined;
    const condoName =
      typeof addr?.condominio === 'string' && addr.condominio.trim()
        ? addr.condominio.trim()
        : 'Não informado';
    condominioSet.add(condoName);

    const createdMs = toMillis(o.createdAt);
    if (startMs !== null && (createdMs === null || createdMs < startMs)) continue;
    if (endMs !== null && (createdMs === null || createdMs > endMs)) continue;
    if (condominioFilter && condoName !== condominioFilter) continue;

    totalOrders += 1;
    const status = String(o.status ?? 'pending');
    const paymentStatus = String(o.paymentStatus ?? 'pending');
    const total = Number(o.total ?? 0);

    if (status === 'pending' || paymentStatus === 'awaiting_confirmation') {
      pendingOrdersCount += 1;
    }
    if (status !== RECOGNIZED_EXCLUDED_STATUS && paymentStatus === 'awaiting_confirmation') {
      awaitingPixCount += 1;
    }

    const isRecognized = status !== RECOGNIZED_EXCLUDED_STATUS && paymentStatus === 'approved';
    const currentCondo = condoAgg.get(condoName) ?? { orders: 0, revenue: 0 };
    currentCondo.orders += 1;
    if (isRecognized && Number.isFinite(total)) {
      recognizedSalesCount += 1;
      grossRevenue += total;
      currentCondo.revenue += total;

      if (createdMs !== null) {
        const dayKey = getSaoPauloDateKey(createdMs);
        const dayCur = dayRevenue.get(dayKey) ?? { revenue: 0, orders: 0 };
        dayCur.revenue += total;
        dayCur.orders += 1;
        dayRevenue.set(dayKey, dayCur);

        const monthKey = getSaoPauloMonthKey(createdMs);
        const monthCur = monthRevenue.get(monthKey) ?? { revenue: 0, orders: 0 };
        monthCur.revenue += total;
        monthCur.orders += 1;
        monthRevenue.set(monthKey, monthCur);
      }
    }
    condoAgg.set(condoName, currentCondo);
  }

  let activeProductsCount = 0;
  let lowStockCount = 0;
  const catMap = new Map<string, number>();
  for (const { data: p } of productDocs) {
    const active = p.active !== false;
    if (active) {
      activeProductsCount += 1;
      const cat = typeof p.category === 'string' && p.category.trim() ? p.category.trim() : 'Outros';
      catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
      if (Number(p.stock ?? 0) <= Number(p.minStock ?? 5)) {
        lowStockCount += 1;
      }
    }
  }

  let openTicketsCount = 0;
  for (const { data: t } of ticketDocs) {
    const st = String(t.status ?? 'open');
    if (st === 'open' || st === 'in_progress') {
      openTicketsCount += 1;
    }
  }

  const nowMs = Date.now();
  const weeklySeries: Array<{ dateKey: string; label: string; revenue: number; orders: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const dMs = nowMs - i * 86_400_000;
    const key = getSaoPauloDateKey(dMs);
    const label = new Intl.DateTimeFormat('pt-BR', {
      timeZone: TIMEZONE,
      weekday: 'short',
    }).format(new Date(dMs));
    const entry = dayRevenue.get(key) ?? { revenue: 0, orders: 0 };
    weeklySeries.push({ dateKey: key, label, revenue: Number(entry.revenue.toFixed(2)), orders: entry.orders });
  }

  const monthlySeries: Array<{ monthKey: string; label: string; revenue: number; orders: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(nowMs);
    d.setUTCMonth(d.getUTCMonth() - i, 15);
    const key = getSaoPauloMonthKey(d.getTime());
    const label = new Intl.DateTimeFormat('pt-BR', {
      timeZone: TIMEZONE,
      month: 'short',
    }).format(d);
    const entry = monthRevenue.get(key) ?? { revenue: 0, orders: 0 };
    monthlySeries.push({ monthKey: key, label, revenue: Number(entry.revenue.toFixed(2)), orders: entry.orders });
  }

  const averageTicket = recognizedSalesCount > 0 ? Number((grossRevenue / recognizedSalesCount).toFixed(2)) : 0;

  return {
    meta: {
      currency: 'BRL',
      timezone: TIMEZONE,
      includedOrderStatuses: ['pending', 'confirmed', 'preparing', 'delivering', 'delivered'],
      excludedOrderStatuses: [RECOGNIZED_EXCLUDED_STATUS],
      revenueRule: "status !== 'cancelled' && paymentStatus === 'approved'",
      truncated: false,
      generatedAtMillis: nowMs,
    },
    totals: {
      totalOrders,
      recognizedSalesCount,
      grossRevenue: Number(grossRevenue.toFixed(2)),
      averageTicket,
      pendingOrdersCount,
      awaitingPixCount,
      totalCustomersCount: userDocs.length,
      totalProductsCount: productDocs.length,
      activeProductsCount,
      lowStockCount,
      openTicketsCount,
    },
    weeklySeries,
    monthlySeries,
    categoryCounts: Array.from(catMap.entries()).map(([category, count]) => ({ category, count })),
    condominioBreakdown: Array.from(condoAgg.entries())
      .map(([condominio, v]) => ({ condominio, orders: v.orders, revenue: Number(v.revenue.toFixed(2)) }))
      .sort((a, b) => b.revenue - a.revenue),
    availableCondominios: Array.from(condominioSet).sort((a, b) => a.localeCompare(b)),
  };
});

