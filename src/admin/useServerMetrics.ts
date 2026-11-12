import { useCallback, useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export interface ServerMetricsResponse {
  meta: {
    currency: string;
    timezone: string;
    includedOrderStatuses: string[];
    excludedOrderStatuses: string[];
    revenueRule: string;
    truncated: boolean;
    generatedAtMillis: number;
  };
  totals: {
    totalOrders: number;
    recognizedSalesCount: number;
    grossRevenue: number;
    averageTicket: number;
    pendingOrdersCount: number;
    awaitingPixCount: number;
    totalCustomersCount: number;
    totalProductsCount: number;
    activeProductsCount: number;
    lowStockCount: number;
    openTicketsCount: number;
  };
  weeklySeries: Array<{ dateKey: string; label: string; revenue: number; orders: number }>;
  monthlySeries: Array<{ monthKey: string; label: string; revenue: number; orders: number }>;
  categoryCounts: Array<{ category: string; count: number }>;
  condominioBreakdown: Array<{ condominio: string; orders: number; revenue: number }>;
  availableCondominios: string[];
}

export function useServerMetrics(filters: {
  startDate?: string;
  endDate?: string;
  condominio?: string;
}) {
  const [data, setData] = useState<ServerMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fn = httpsCallable<
        { startDate?: string; endDate?: string; condominio?: string },
        ServerMetricsResponse
      >(functions, 'adminGetMetrics');
      const res = await fn({
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        condominio: filters.condominio && filters.condominio !== 'all' ? filters.condominio : undefined,
      });
      setData(res.data);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Erro ao carregar métricas consolidadas do servidor.');
    } finally {
      setLoading(false);
    }
  }, [filters.startDate, filters.endDate, filters.condominio]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) void load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  return { metrics: data, loading, error, reload: load };
}

