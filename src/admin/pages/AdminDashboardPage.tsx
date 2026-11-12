import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Clock,
  DollarSign,
  Headphones,
  Plus,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../../hooks/useAuth';
import { useAdminData } from '../AdminDataContext';
import { useServerMetrics } from '../useServerMetrics';
import {
  formatCurrency,
  formatDateTime,
  MetricCard,
  OrderStatusBadge,
  PageHeader,
  PaymentStatusBadge,
  PriorityBadge,
  TicketStatusBadge,
} from '../components/AdminUi';

export const AdminDashboardPage: React.FC = () => {
  const { can } = useAuth();
  const { orders, products, tickets } = useAdminData();
  const [condominio, setCondominio] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const { metrics: serverMetrics, loading: metricsLoading, error: metricsError, reload } = useServerMetrics({
    startDate,
    endDate,
    condominio,
  });

  const metrics = useMemo(() => {
    const pendingOrders = orders.filter(
      (o) => o.status === 'pending' || o.status === 'confirmed' || o.status === 'preparing',
    );
    const awaitingPix = orders.filter(
      (o) => o.status !== 'cancelled' && o.paymentStatus === 'awaiting_confirmation',
    );
    const lowStockProducts = products.filter(
      (p) => p.active !== false && Number(p.stock ?? 0) <= Number(p.minStock ?? 5),
    );
    const openTickets = tickets.filter(
      (t) => t.status === 'open' || t.status === 'in_progress',
    );

    const t = serverMetrics?.totals;
    return {
      totalRevenue: t?.grossRevenue ?? 0,
      validSalesCount: t?.recognizedSalesCount ?? 0,
      avgTicket: t?.averageTicket ?? 0,
      totalCustomersCount: t?.totalCustomersCount ?? 0,
      pendingCount: t?.pendingOrdersCount ?? pendingOrders.length,
      awaitingPixCount: t?.awaitingPixCount ?? awaitingPix.length,
      lowStockCount: t?.lowStockCount ?? lowStockProducts.length,
      openTicketsCount: t?.openTicketsCount ?? openTickets.length,
      pendingOrders,
      awaitingPix,
      lowStockProducts,
      openTickets,
    };
  }, [orders, products, tickets, serverMetrics]);

  const weeklySalesData = useMemo(
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão Geral da Operação"
        subtitle="Totais consolidados no servidor (sem truncamento), conciliação Pix, estoque e atendimento do condomínio."
        badge="Server-Side"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={condominio}
              onChange={(e) => setCondominio(e.target.value)}
              className="adm-input px-3 py-2 text-xs"
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
              className="adm-input px-2.5 py-1.5 text-xs tabular-nums"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="adm-input px-2.5 py-1.5 text-xs tabular-nums"
            />
            <button
              type="button"
              onClick={() => void reload()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text)] border border-[var(--adm-border)] text-xs font-semibold"
            >
              <RefreshCw size={14} className={metricsLoading ? 'animate-spin' : ''} />
              Atualizar
            </button>
            {can('produtos:create') && (
              <Link
                to="/admin/products/new"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold text-xs transition-colors"
              >
                <Plus size={15} />
                Novo Produto
              </Link>
            )}
            {can('pedidos:view') && (
              <Link
                to="/admin/orders"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text)] font-semibold text-xs border border-[var(--adm-border)] transition-colors"
              >
                <ShoppingBag size={15} />
                Fila de Pedidos ({metrics.pendingOrders.length})
              </Link>
            )}
          </div>
        }
      />

      {metricsError && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-xs text-rose-200 flex items-center justify-between gap-3">
          <span>{metricsError}</span>
          <button
            type="button"
            onClick={() => void reload()}
            className="px-3 py-1 rounded-md bg-rose-500/20 hover:bg-rose-500/30 font-bold"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {metricsLoading && !serverMetrics && (
        <div className="rounded-lg border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 py-3 text-xs text-[var(--adm-text-muted)]">
          Calculando totais consolidados no servidor...
        </div>
      )}

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Receita Conciliada"
          value={formatCurrency(metrics.totalRevenue)}
          subtitle={`${metrics.validSalesCount} pedidos pagos`}
          icon={<DollarSign size={18} />}
          tone="emerald"
          to="/admin/finance"
        />
        <MetricCard
          label="Pedidos em Operação"
          value={metrics.pendingCount}
          subtitle={`${metrics.awaitingPixCount} aguardando Pix`}
          icon={<ShoppingBag size={18} />}
          tone="amber"
          to="/admin/orders"
        />
        <MetricCard
          label="Ticket Médio"
          value={formatCurrency(metrics.avgTicket)}
          subtitle={`${metrics.totalCustomersCount} moradores cadastrados`}
          icon={<TrendingUp size={18} />}
          tone="indigo"
          to="/admin/customers"
        />
        <MetricCard
          label="Chamados em Aberto"
          value={metrics.openTicketsCount}
          subtitle={`Total consolidado no servidor`}
          icon={<Headphones size={18} />}
          tone="sky"
          to="/admin/support"
        />
        <MetricCard
          label="Alertas de Estoque"
          value={metrics.lowStockCount}
          subtitle={`De ${serverMetrics?.totals.totalProductsCount ?? products.length} itens no catálogo`}
          icon={<Boxes size={18} />}
          tone={metrics.lowStockCount > 0 ? 'rose' : 'emerald'}
          to="/admin/inventory"
        />
      </div>

      {serverMetrics && (
        <div className="text-[11px] text-[var(--adm-text-dim)] px-1">
          Critério: Moeda {serverMetrics.meta.currency} • Fuso {serverMetrics.meta.timezone} • Receita considera pedidos não cancelados com pagamento aprovado.
        </div>
      )}

      {/* Priority Operational Action Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Pending Orders & Pix Reconciliation */}
        <div className="lg:col-span-2 bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-bold text-[var(--adm-text)] flex items-center gap-2">
                  <Clock size={17} className="text-[var(--adm-gold)]" />
                  Fila Operacional de Pedidos
                </h2>
                <p className="text-xs text-[var(--adm-text-muted)]">
                  Pedidos pendentes de conciliação Pix, separação ou entrega imediata
                </p>
              </div>
              <Link
                to="/admin/orders"
                className="text-xs font-semibold text-[var(--adm-gold)] hover:underline inline-flex items-center gap-1"
              >
                Ver todos <ArrowRight size={13} />
              </Link>
            </div>

            {metrics.pendingOrders.length === 0 ? (
              <div className="py-10 text-center text-xs text-[var(--adm-text-muted)] bg-[var(--adm-bg-subtle)] rounded-lg border border-[var(--adm-border)]">
                Nenhum pedido pendente na fila no momento. Operação em dia!
              </div>
            ) : (
              <div className="divide-y divide-[var(--adm-border)]">
                {metrics.pendingOrders.slice(0, 6).map((order) => (
                  <div
                    key={order.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/admin/orders/${order.id}`}
                          className="text-xs font-bold text-[var(--adm-gold)] hover:underline font-mono tabular-nums"
                        >
                          #{(order.orderNumber || order.id).slice(0, 8).toUpperCase()}
                        </Link>
                        <span className="text-xs font-semibold text-[var(--adm-text)] truncate">
                          {order.userName || 'Morador'}
                        </span>
                        <OrderStatusBadge status={order.status} />
                        <PaymentStatusBadge status={order.paymentStatus} />
                      </div>
                      <div className="text-[11px] text-[var(--adm-text-dim)] mt-1 flex flex-wrap items-center gap-2">
                        <span className="tabular-nums">{formatDateTime(order.createdAt)}</span>
                        {order.address?.condominio && (
                          <span>
                            • {order.address.condominio}
                            {order.address.apartamento ? ` (Apto ${order.address.apartamento})` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <span className="text-sm font-bold text-emerald-300 tabular-nums">
                        {formatCurrency(order.total)}
                      </span>
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="px-3 py-1.5 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-xs font-semibold text-[var(--adm-text)] border border-[var(--adm-border)] transition-colors"
                      >
                        Atender
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Low Stock & Open Support Tickets */}
        <div className="space-y-5">
          {/* Open Tickets */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-bold text-[var(--adm-text)] flex items-center gap-2">
                <Headphones size={16} className="text-sky-300" />
                Chamados de Moradores
              </h2>
              <Link
                to="/admin/support"
                className="text-xs font-semibold text-sky-300 hover:underline inline-flex items-center gap-1"
              >
                Fila <ArrowRight size={12} />
              </Link>
            </div>
            {metrics.openTickets.length === 0 ? (
              <p className="text-xs text-[var(--adm-text-muted)] py-4 text-center bg-[var(--adm-bg-subtle)] rounded-lg border border-[var(--adm-border)]">
                Nenhum chamado pendente de resposta.
              </p>
            ) : (
              <div className="space-y-2">
                {metrics.openTickets.slice(0, 4).map((t) => (
                  <Link
                    key={t.id}
                    to={`/admin/support/${t.id}`}
                    className="block p-3 rounded-lg bg-[var(--adm-bg-subtle)] hover:bg-[var(--adm-surface-elevated)] border border-[var(--adm-border)] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-[var(--adm-text)] truncate">
                        {t.subject}
                      </span>
                      <PriorityBadge priority={t.priority} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--adm-text-muted)]">
                      <span className="truncate">{t.customerName}</span>
                      <TicketStatusBadge status={t.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Low Stock Alerts */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-sm font-bold text-[var(--adm-text)] flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-300" />
                Estoque Crítico / Ruptura
              </h2>
              <Link
                to="/admin/inventory"
                className="text-xs font-semibold text-rose-300 hover:underline inline-flex items-center gap-1"
              >
                Repor <ArrowRight size={12} />
              </Link>
            </div>
            {metrics.lowStockProducts.length === 0 ? (
              <p className="text-xs text-[var(--adm-text-muted)] py-4 text-center bg-[var(--adm-bg-subtle)] rounded-lg border border-[var(--adm-border)]">
                Todos os produtos ativos estão acima do estoque mínimo.
              </p>
            ) : (
              <div className="space-y-2">
                {metrics.lowStockProducts.slice(0, 5).map((p) => (
                  <Link
                    key={p.id}
                    to="/admin/inventory"
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[var(--adm-bg-subtle)] hover:bg-[var(--adm-surface-elevated)] border border-[var(--adm-border)] transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[var(--adm-text)] truncate">
                        {p.title}
                      </div>
                      <div className="text-[11px] text-[var(--adm-text-dim)]">{p.category}</div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-bold shrink-0 tabular-nums ${
                        Number(p.stock ?? 0) === 0
                          ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40'
                          : 'bg-amber-500/15 text-amber-200 border border-amber-500/30'
                      }`}
                    >
                      {Number(p.stock ?? 0)} un.
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-[var(--adm-text)]">
                Vendas Conciliadas (Últimos 7 Dias)
              </h2>
              <p className="text-xs text-[var(--adm-text-muted)]">
                Considera apenas pedidos não cancelados com pagamento aprovado
              </p>
            </div>
            <Link
              to="/admin/reports"
              className="text-xs font-semibold text-[var(--adm-gold)] hover:underline"
            >
              Relatório completo
            </Link>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklySalesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,184,161,0.14)" />
                <XAxis dataKey="day" stroke="#9ab0a3" fontSize={12} />
                <YAxis stroke="#9ab0a3" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0b1811',
                    borderColor: 'rgba(148,184,161,0.28)',
                    borderRadius: '8px',
                    color: '#f1f5f2',
                  }}
                />
                <Bar dataKey="vendas" name="Receita (R$)" fill="#22c55e" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5">
          <h2 className="text-base font-bold text-[var(--adm-text)] mb-1">
            Mix de Categorias Ativas
          </h2>
          <p className="text-xs text-[var(--adm-text-muted)] mb-4">
            Distribuição do catálogo disponível na vitrine
          </p>
          {categoryData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-[var(--adm-text-muted)]">
              Sem produtos ativos cadastrados.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={3}
                  >
                    {categoryData.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0b1811',
                      borderColor: 'rgba(148,184,161,0.28)',
                      borderRadius: '8px',
                      color: '#f1f5f2',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {categoryData.slice(0, 6).map((c) => (
              <span
                key={c.name}
                className="inline-flex items-center gap-1.5 text-[11px] text-[var(--adm-text-muted)] bg-[var(--adm-bg-subtle)] px-2 py-0.5 rounded-md border border-[var(--adm-border)]"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name} ({c.value})
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Quick CRM Links */}
      <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--adm-brand-soft)] text-emerald-300 border border-[var(--adm-brand-border)] flex items-center justify-center">
            <Users size={18} />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-[var(--adm-text)]">
              Atendimento e CRM Integrado por Rotas
            </div>
            <div className="text-xs text-[var(--adm-text-muted)]">
              Clique em qualquer morador, pedido ou chamado para abrir a ficha 360° com trilha de auditoria.
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/customers"
            className="px-3.5 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-xs font-semibold text-[var(--adm-text)] border border-[var(--adm-border)]"
          >
            Base de Clientes
          </Link>
          <Link
            to="/admin/audit"
            className="px-3.5 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-xs font-semibold text-[var(--adm-text)] border border-[var(--adm-border)]"
          >
            Trilha de Auditoria
          </Link>
        </div>
      </div>
    </div>
  );
};

