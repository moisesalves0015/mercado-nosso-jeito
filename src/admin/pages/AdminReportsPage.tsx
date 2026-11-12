import React, { useMemo } from 'react';
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
import { BarChart3, CheckCircle2, ShoppingBag, TrendingUp, XCircle } from 'lucide-react';
import {
  buildCatalogCategoryData,
  buildMonthlyRevenueData,
  buildWeeklySalesData,
  isRecognizedSale,
} from '../../utils/adminAnalytics';
import { useAdminData } from '../AdminDataContext';
import { formatCurrency, MetricCard, PageHeader } from '../components/AdminUi';

export const AdminReportsPage: React.FC = () => {
  const { orders, products } = useAdminData();

  const monthlyData = useMemo(() => buildMonthlyRevenueData(orders), [orders]);
  const weeklyData = useMemo(() => buildWeeklySalesData(orders), [orders]);
  const categoryData = useMemo(() => buildCatalogCategoryData(products), [products]);

  const summary = useMemo(() => {
    const valid = orders.filter((o) => isRecognizedSale(o));
    const delivered = orders.filter((o) => o.status === 'delivered');
    const cancelled = orders.filter((o) => o.status === 'cancelled');
    const revenue = valid.reduce((s, o) => s + Number(o.total || 0), 0);
    const completionRate =
      orders.length > 0 ? Math.round((delivered.length / orders.length) * 100) : 0;
    const cancelRate =
      orders.length > 0 ? Math.round((cancelled.length / orders.length) * 100) : 0;

    return {
      revenue,
      validCount: valid.length,
      deliveredCount: delivered.length,
      cancelledCount: cancelled.length,
      completionRate,
      cancelRate,
    };
  }, [orders]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios & Business Intelligence"
        subtitle="Indicadores de evolução mensal de receita, taxa de entrega concluída e desempenho por categoria."
        badge="Analytics"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Faturamento Acumulado"
          value={formatCurrency(summary.revenue)}
          subtitle={`${summary.validCount} pedidos aprovados`}
          icon={<TrendingUp size={18} />}
          tone="emerald"
        />
        <MetricCard
          label="Taxa de Conclusão (Entrega)"
          value={`${summary.completionRate}%`}
          subtitle={`${summary.deliveredCount} pedidos entregues`}
          icon={<CheckCircle2 size={18} />}
          tone="indigo"
        />
        <MetricCard
          label="Taxa de Cancelamento"
          value={`${summary.cancelRate}%`}
          subtitle={`${summary.cancelledCount} pedidos cancelados`}
          icon={<XCircle size={18} />}
          tone={summary.cancelRate > 15 ? 'rose' : 'amber'}
        />
        <MetricCard
          label="Categorias Ativas"
          value={categoryData.length}
          subtitle={`${products.filter((p) => p.active !== false).length} SKUs em linha`}
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
                <XAxis dataKey="mes" stroke="#94a3b8" fontSize={12} />
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

