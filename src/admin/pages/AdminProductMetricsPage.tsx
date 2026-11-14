import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  DollarSign,
  Edit3,
  Eye,
  Package,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { db } from '../../firebase';
import { useAdminData, type AdminOrder, type AdminProduct } from '../AdminDataContext';
import {
  EmptyState,
  formatCurrency,
  MetricCard,
  PageHeader,
} from '../components/AdminUi';

export const AdminProductMetricsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orders, products, loading: contextLoading } = useAdminData();

  const [product, setProduct] = useState<AdminProduct | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    // Check context products first
    const found = products.find((p) => p.id === id);
    if (found) {
      setProduct(found);
      setLoading(false);
      return;
    }

    // Otherwise fetch directly
    getDoc(doc(db, 'products', id))
      .then((snap) => {
        if (snap.exists()) {
          setProduct({ id: snap.id, ...snap.data() } as AdminProduct);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [id, products]);

  // Compute real order metrics for this product
  const metrics = useMemo(() => {
    if (!product) {
      return {
        totalUnits: 0,
        totalRevenue: 0,
        distinctOrders: 0,
        averageUnitsPerOrder: 0,
        estimatedProfit: 0,
        profitMargin: 0,
        relevantOrders: [] as Array<{
          order: AdminOrder;
          quantity: number;
          revenue: number;
          date: string;
        }>,
      };
    }

    const relevantOrders: Array<{
      order: AdminOrder;
      quantity: number;
      revenue: number;
      date: string;
    }> = [];

    let totalUnits = 0;
    let totalRevenue = 0;

    for (const order of orders) {
      // Exclude cancelled orders
      if (order.status === 'cancelled') continue;

      const items = Array.isArray(order.items) ? order.items : [];
      let orderQty = 0;
      let orderRev = 0;

      for (const item of items) {
        if (item.id === product.id || (item.title && item.title === product.title)) {
          const qty = Number(item.quantity || 1);
          const price = Number(item.price || product.price || 0);
          orderQty += qty;
          orderRev += qty * price;
        }
      }

      if (orderQty > 0) {
        totalUnits += orderQty;
        totalRevenue += orderRev;
        const dateStr = order.createdAt
          ? typeof (order.createdAt as { toDate?: () => Date }).toDate === 'function'
            ? (order.createdAt as { toDate: () => Date }).toDate().toISOString()
            : String(order.createdAt)
          : '';

        relevantOrders.push({
          order,
          quantity: orderQty,
          revenue: orderRev,
          date: dateStr,
        });
      }
    }

    const distinctOrders = relevantOrders.length;
    const averageUnitsPerOrder = distinctOrders > 0 ? totalUnits / distinctOrders : 0;

    const cost = Number(product.costPrice || 0);
    const totalCost = cost * totalUnits;
    const estimatedProfit = cost > 0 ? totalRevenue - totalCost : 0;
    const profitMargin =
      totalRevenue > 0 && cost > 0 ? (estimatedProfit / totalRevenue) * 100 : 0;

    return {
      totalUnits,
      totalRevenue,
      distinctOrders,
      averageUnitsPerOrder,
      estimatedProfit,
      profitMargin,
      relevantOrders,
    };
  }, [product, orders]);

  if (loading || contextLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-[var(--adm-text-muted)] space-y-3">
        <RefreshCw size={24} className="animate-spin text-[var(--adm-brand)]" />
        <p className="text-xs font-semibold">Calculando métricas em tempo real...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate('/admin/products')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
        >
          <ArrowLeft size={14} /> Voltar ao catálogo
        </button>
        <div className="p-8 text-center bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px]">
          <Package size={36} className="mx-auto text-[var(--adm-text-dim)] mb-2" />
          <h2 className="text-base font-bold text-[var(--adm-text)]">Produto não localizado</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Métricas — ${product.title}`}
        subtitle="Desempenho comercial e histórico de pedidos consolidados exclusivamente de vendas reais da plataforma."
        badge={`${metrics.distinctOrders} pedidos registrados`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/admin/products')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] font-semibold text-xs border border-[var(--adm-border)] transition-colors"
            >
              <ArrowLeft size={14} /> Voltar
            </button>
            <Link
              to={`/admin/products/${product.id}/view`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text)] font-bold text-xs border border-[var(--adm-border)] transition-colors"
            >
              <Eye size={14} />
              Visualizar Ficha
            </Link>
            <Link
              to={`/admin/products/${product.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold text-xs transition-colors"
            >
              <Edit3 size={14} />
              Editar Produto
            </Link>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <MetricCard
          label="Unidades Vendidas"
          value={`${metrics.totalUnits} un.`}
          icon={<ShoppingBag size={16} />}
        />
        <MetricCard
          label="Receita Bruta Gerada"
          value={formatCurrency(metrics.totalRevenue)}
          icon={<DollarSign size={16} />}
        />
        <MetricCard
          label="Pedidos com este Item"
          value={metrics.distinctOrders}
          icon={<BarChart3 size={16} />}
        />
        <MetricCard
          label="Média por Pedido"
          value={`${metrics.averageUnitsPerOrder.toFixed(1)} un.`}
          icon={<Boxes size={16} />}
        />
      </div>

      {/* Profit & Margin Breakdown (if cost price provided) */}
      {Number(product.costPrice || 0) > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-[10px] bg-[var(--adm-surface)] border border-[var(--adm-border)]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--adm-text-dim)]">
              Lucro Bruto Acumulado
            </div>
            <div className="text-xl font-bold text-emerald-400 mt-1 tabular-nums">
              {formatCurrency(metrics.estimatedProfit)}
            </div>
          </div>
          <div className="p-4 rounded-[10px] bg-[var(--adm-surface)] border border-[var(--adm-border)]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--adm-text-dim)]">
              Margem Média Efetiva
            </div>
            <div className="text-xl font-bold text-cyan-400 mt-1 tabular-nums">
              {metrics.profitMargin.toFixed(1)}%
            </div>
          </div>
          <div className="p-4 rounded-[10px] bg-[var(--adm-surface)] border border-[var(--adm-border)]">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--adm-text-dim)]">
              Saldo Físico em Estoque
            </div>
            <div className="text-xl font-bold text-[var(--adm-text)] mt-1 tabular-nums">
              {product.stock ?? 0} un.
            </div>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--adm-text)] flex items-center gap-2">
            <ShoppingBag size={16} className="text-[var(--adm-gold)]" />
            Histórico Detalhado de Vendas
          </h2>
          <span className="text-xs text-[var(--adm-text-dim)] font-mono">
            {metrics.relevantOrders.length} ocorrências
          </span>
        </div>

        {metrics.relevantOrders.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag size={24} />}
            title="Nenhuma venda registrada ainda"
            description="Este produto ainda não teve pedidos confirmados ou entregues na plataforma. Quando moradores realizarem pedidos contendo este item, os dados serão consolidados aqui."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--adm-surface-elevated)] text-[var(--adm-text-dim)] font-bold uppercase tracking-wider text-[10px] border-b border-[var(--adm-border)]">
                <tr>
                  <th className="py-3 px-4">Pedido</th>
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4">Morador / Cliente</th>
                  <th className="py-3 px-4 text-center">Qtd. Item</th>
                  <th className="py-3 px-4 text-right">Subtotal do Item</th>
                  <th className="py-3 px-4 text-center">Status Pedido</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--adm-border)] text-[var(--adm-text)]">
                {metrics.relevantOrders.map(({ order, quantity, revenue, date }) => {
                  const formattedDate = date
                    ? new Date(date).toLocaleString('pt-BR')
                    : '—';

                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-[var(--adm-surface-elevated)]/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                        #{order.orderNumber || order.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="py-3 px-4 text-[var(--adm-text-dim)]">
                        {formattedDate}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[var(--adm-text)]">
                          {order.userName || 'Morador'}
                        </div>
                        {order.address?.condominio && (
                          <div className="text-[11px] text-[var(--adm-text-dim)]">
                            {order.address.condominio}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-bold tabular-nums">
                        {quantity} un.
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 tabular-nums">
                        {formatCurrency(revenue)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/admin/orders/${order.id}`}
                          className="text-[11px] font-bold text-[var(--adm-brand)] hover:underline"
                        >
                          Ver Pedido →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
