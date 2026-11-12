import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, CheckCircle2, RefreshCw, ShoppingBag, TrendingUp, XCircle } from 'lucide-react';
import { useServerMetrics } from '../useServerMetrics';
import { formatCurrency, MetricCard, PageHeader } from '../components/AdminUi';

export const AdminReportsPage: React.FC = () => {
  const [condominio, setCondominio] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const { metrics: serverMetrics, loading, error, reload } = useServerMetrics({
    startDate,
    endDate,
    condominio,
  });

  const monthlyData = useMemo(
    () =>
      (serverMetrics?.monthlySeries ?? []).map((m) => ({
        month: m.label,
        receita: m.revenue,
        pedidos: m.orders,
      })),
    [serverMetrics],
  );
  const weeklyData = useMemo(
    () =>
      (serverMetrics?.weeklySeries ?? []).map((d) => ({
        day: d.label,
        total: d.revenue,
        pedidos: d.orders,
      })),
    [serverMetrics],
  );
  const categoryData = useMemo(() => {
    const COLORS = ['#10b981', '#f59e0b', '#38bdf8', '#a855f7', '#ec4899', '#64748b'];
    return (serverMetrics?.categoryCounts ?? []).map((c, idx) => ({
      name: c.category,
      value: c.count,
      color: COLORS[idx % COLORS.length],
    }));
  }, [serverMetrics]);

  const summary = useMemo(() => {
    const t = serverMetrics?.totals;
    const total = t?.totalOrders ?? 0;
    const validCount = t?.recognizedSalesCount ?? 0;
    const revenue = t?.grossRevenue ?? 0;
    const completionRate = total > 0 ? Math.round((validCount / total) * 100) : 0;

    return {
      revenue,
      validCount,
      totalOrders: total,
      completionRate,
      averageTicket: t?.averageTicket ?? 0,
    };
  }, [serverMetrics]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios & Business Intelligence"
        subtitle="Totais agregados no servidor por período e condomínio (sem truncamento)."
        badge="Server-Side Analytics"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={condominio}
              onChange={(e) => setCondominio(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
            >
              <option value="all">Todos os condomínios</option>
              {(serverMetrics?.availableCondominios ?? []).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200"
            />
            <button
              type="button"
              onClick={() => void reload()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
        }
      />

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-xs text-rose-200 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void reload()}
            className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 font-bold"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {loading && !serverMetrics && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 text-xs text-slate-400">
          Carregando agregações consolidadas do servidor...
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Faturamento Acumulado"
          value={formatCurrency(summary.revenue)}
          subtitle={`${summary.validCount} pedidos aprovados`}
          icon={<TrendingUp size={18} />}
          tone="emerald"
        />
        <MetricCard
          label="Taxa de Aprovação"
          value={`${summary.completionRate}%`}
          subtitle={`${summary.validCount} de ${summary.totalOrders} pedidos`}
          icon={<CheckCircle2 size={18} />}
          tone="indigo"
        />
        <MetricCard
          label="Ticket Médio"
          value={formatCurrency(summary.averageTicket)}
          subtitle={`Moeda ${serverMetrics?.meta.currency || 'BRL'} • ${serverMetrics?.meta.timezone || 'America/Sao_Paulo'}`}
          icon={<XCircle size={18} />}
          tone="amber"
        />
        <MetricCard
          label="Categorias Ativas"
          value={categoryData.length}
          subtitle={`${serverMetrics?.totals.activeProductsCount ?? 0} SKUs em linha`}
          icon={<ShoppingBag size={18} />}
          tone="sky"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg">
          <h2 className="text-base font-extrabold text-white mb-1 flex items-center gap-2">
            <BarChart3 size={17} className="text-emerald-400" />
            Evolução de Receita (Últimos 6 Meses)
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Receita mensal reconhecida (pedidos pagos e não cancelados)
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#f8fafc',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="receita"
                  name="Receita (R$)"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly Volume */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg">
          <h2 className="text-base font-extrabold text-white mb-1 flex items-center gap-2">
            <ShoppingBag size={17} className="text-amber-400" />
            Volume de Pedidos & Receita (7 Dias)
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            Desempenho diário de vendas aprovadas na última semana
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    color: '#f8fafc',
                  }}
                />
                <Bar dataKey="vendas" name="Receita (R$)" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                <Bar dataKey="pedidos" name="Qtd Pedidos" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

