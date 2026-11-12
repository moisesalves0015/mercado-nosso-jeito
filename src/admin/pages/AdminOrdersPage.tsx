import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  Eye,
  Filter,
  Search,
  ShoppingBag,
  Truck,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useAdminData, type AdminOrder } from '../AdminDataContext';
import {
  EmptyState,
  formatCurrency,
  formatDateTime,
  OrderStatusBadge,
  PageHeader,
  PaymentStatusBadge,
  ReasonConfirmModal,
} from '../components/AdminUi';

const STATUS_TABS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'pending', label: 'Pendentes' },
  { id: 'confirmed', label: 'Confirmados' },
  { id: 'preparing', label: 'Em Preparo' },
  { id: 'delivering', label: 'Em Rota' },
  { id: 'delivered', label: 'Entregues' },
  { id: 'cancelled', label: 'Cancelados' },
];

export const AdminOrdersPage: React.FC = () => {
  const { canAny } = useAuth();
  const {
    orders,
    actionLoading,
    handleConfirmPayment,
    handleUpdateOrderStatus,
    handleCancelOrder,
  } = useAdminData();

  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || 'all';
  const paymentFilter = searchParams.get('payment') || 'all';
  const searchQuery = searchParams.get('q') || '';

  const [cancelTarget, setCancelTarget] = useState<AdminOrder | null>(null);

  const canApprovePayment = canAny(['financeiro:approve', 'pedidos:approve']);
  const canEditOrder = canAny(['pedidos:edit', 'pedidos:approve']);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (paymentFilter !== 'all' && o.paymentStatus !== paymentFilter) return false;
      if (q) {
        const matchId = o.id.toLowerCase().includes(q);
        const matchNumber = o.orderNumber?.toLowerCase().includes(q);
        const matchName = o.userName?.toLowerCase().includes(q);
        const matchCondo = o.address?.condominio?.toLowerCase().includes(q);
        const matchApt = o.address?.apartamento?.toLowerCase().includes(q);
        if (!matchId && !matchNumber && !matchName && !matchCondo && !matchApt) return false;
      }
      return true;
    });
  }, [orders, statusFilter, paymentFilter, searchQuery]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    for (const o of orders) {
      c[o.status] = (c[o.status] || 0) + 1;
    }
    return c;
  }, [orders]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Gestão de Pedidos"
        subtitle="Acompanhe a fila de separação, confirme pagamentos Pix e gerencie entregas no condomínio."
        badge={`${filteredOrders.length} pedidos`}
      />

      {/* Filter Bar */}
      <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-4 space-y-3.5">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--adm-text-dim)] pointer-events-none"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => updateParam('q', e.target.value)}
              placeholder="Buscar por #código, morador, condomínio ou apartamento..."
              aria-label="Filtrar pedidos por texto"
              className="adm-input w-full pl-9 pr-4 py-2 text-xs sm:text-sm placeholder-[var(--adm-text-dim)]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={15} className="text-[var(--adm-text-dim)] shrink-0" />
            <select
              value={paymentFilter}
              onChange={(e) => updateParam('payment', e.target.value)}
              aria-label="Filtrar por status de pagamento"
              className="adm-input px-3 py-2 text-xs font-semibold"
            >
              <option value="all">Todos os Pagamentos</option>
              <option value="awaiting_confirmation">Aguardando Conciliação Pix</option>
              <option value="approved">Pagos / Conciliados</option>
              <option value="on_delivery">Pagar na Entrega</option>
              <option value="rejected">Rejeitados / Cancelados</option>
            </select>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.id;
            const count = counts[tab.id] ?? 0;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => updateParam('status', tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  active
                    ? 'bg-[var(--adm-brand)] text-emerald-950 font-bold'
                    : 'bg-[var(--adm-bg-subtle)] text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] border border-[var(--adm-border)]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] tabular-nums ${
                    active ? 'bg-black/20 text-emerald-950' : 'bg-[var(--adm-surface-elevated)] text-[var(--adm-text-dim)]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={22} />}
          title="Nenhum pedido encontrado"
          description="Não há pedidos correspondentes aos filtros atuais. Tente limpar a busca ou selecionar outra aba."
          action={
            (statusFilter !== 'all' || paymentFilter !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={() => setSearchParams({}, { replace: true })}
                className="px-4 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-xs font-semibold text-[var(--adm-text)] border border-[var(--adm-border)]"
              >
                Limpar Filtros
              </button>
            )
          }
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--adm-border)] bg-[var(--adm-bg-subtle)] text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)]">
                    <th scope="col" className="py-3 px-4">Pedido</th>
                    <th scope="col" className="py-3 px-4">Morador / Destino</th>
                    <th scope="col" className="py-3 px-4">Status Operacional</th>
                    <th scope="col" className="py-3 px-4">Pagamento</th>
                    <th scope="col" className="py-3 px-4">Total</th>
                    <th scope="col" className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--adm-border)] text-xs">
                  {filteredOrders.map((order) => {
                    const canConfirmPix =
                      canApprovePayment &&
                      order.status !== 'cancelled' &&
                      order.paymentStatus !== 'approved';
                    const isPaidOrOnDelivery =
                      order.paymentStatus === 'approved' || order.paymentStatus === 'on_delivery';

                    return (
                      <tr key={order.id} className="hover:bg-[var(--adm-surface-elevated)]/60 transition-colors">
                        <td className="py-3 px-4 align-top">
                          <Link
                            to={`/admin/orders/${order.id}`}
                            className="font-mono font-bold text-[var(--adm-gold)] hover:underline text-sm tabular-nums"
                          >
                            #{(order.orderNumber || order.id).slice(0, 8).toUpperCase()}
                          </Link>
                          <div className="text-[11px] text-[var(--adm-text-dim)] mt-0.5 tabular-nums">
                            {formatDateTime(order.createdAt)}
                          </div>
                          <div className="text-[11px] text-[var(--adm-text-dim)] tabular-nums">
                            {order.items?.length || 0} {(order.items?.length || 0) === 1 ? 'item' : 'itens'}
                          </div>
                        </td>

                        <td className="py-3 px-4 align-top">
                          {order.uid ? (
                            <Link
                              to={`/admin/customers/${order.uid}`}
                              className="font-semibold text-[var(--adm-text)] hover:text-[var(--adm-gold)] transition-colors"
                            >
                              {order.userName || 'Morador'}
                            </Link>
                          ) : (
                            <span className="font-semibold text-[var(--adm-text)]">
                              {order.userName || 'Morador'}
                            </span>
                          )}
                          <div className="text-[11px] text-[var(--adm-text-muted)] mt-0.5">
                            {order.address?.condominio
                              ? `${order.address.condominio}${
                                  order.address.bloco ? ` • Bl. ${order.address.bloco}` : ''
                                }${order.address.apartamento ? ` • Apto ${order.address.apartamento}` : ''}`
                              : order.address?.street
                              ? `${order.address.street}, ${order.address.number || ''}`
                              : 'Retirada / Condomínio'}
                          </div>
                        </td>

                        <td className="py-3 px-4 align-top">
                          <OrderStatusBadge status={order.status} />
                        </td>

                        <td className="py-3 px-4 align-top">
                          <PaymentStatusBadge status={order.paymentStatus} />
                          {order.paymentMethod && (
                            <div className="text-[11px] text-[var(--adm-text-dim)] mt-1">
                              {order.paymentMethod}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 align-top font-bold text-emerald-300 text-sm tabular-nums">
                          {formatCurrency(order.total)}
                        </td>

                        <td className="py-3 px-4 align-top text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {canConfirmPix && (
                              <button
                                type="button"
                                disabled={actionLoading === `pay-${order.id}`}
                                onClick={() => handleConfirmPayment(order.id)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-500/30 font-semibold text-[11px] inline-flex items-center gap-1"
                                title="Confirmar recebimento Pix"
                              >
                                <CheckCircle2 size={12} />
                                Confirmar Pix
                              </button>
                            )}

                            {canEditOrder &&
                              order.status === 'confirmed' &&
                              isPaidOrOnDelivery && (
                                <button
                                  type="button"
                                  disabled={actionLoading === `status-${order.id}`}
                                  onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
                                  className="px-2.5 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-200 border border-teal-500/30 font-semibold text-[11px]"
                                >
                                  Separar
                                </button>
                              )}

                            {canEditOrder && order.status === 'preparing' && (
                              <button
                                type="button"
                                disabled={actionLoading === `status-${order.id}`}
                                onClick={() => handleUpdateOrderStatus(order.id, 'delivering')}
                                className="px-2.5 py-1.5 rounded-lg bg-lime-500/15 hover:bg-lime-500/25 text-lime-200 border border-lime-500/30 font-semibold text-[11px] inline-flex items-center gap-1"
                              >
                                <Truck size={12} />
                                Expedir
                              </button>
                            )}

                            {canEditOrder && order.status === 'delivering' && (
                              <button
                                type="button"
                                disabled={actionLoading === `status-${order.id}`}
                                onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-500/30 font-semibold text-[11px]"
                              >
                                Entregue
                              </button>
                            )}

                            {canEditOrder &&
                              order.status !== 'cancelled' &&
                              order.status !== 'delivered' && (
                                <button
                                  type="button"
                                  onClick={() => setCancelTarget(order)}
                                  className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/30"
                                  title="Cancelar pedido com estorno de estoque"
                                  aria-label="Cancelar pedido"
                                >
                                  <XCircle size={14} />
                                </button>
                              )}

                            <Link
                              to={`/admin/orders/${order.id}`}
                              className="px-2.5 py-1.5 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-[var(--adm-text)] border border-[var(--adm-border)] font-semibold text-[11px] inline-flex items-center gap-1"
                            >
                              <Eye size={12} />
                              Detalhes
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile & Tablet Cards */}
          <div className="lg:hidden space-y-2.5">
            {filteredOrders.map((order) => {
              const canConfirmPix =
                canApprovePayment &&
                order.status !== 'cancelled' &&
                order.paymentStatus !== 'approved';
              return (
                <div
                  key={order.id}
                  className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-[10px] p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="font-mono font-bold text-[var(--adm-gold)] text-sm tabular-nums"
                      >
                        #{(order.orderNumber || order.id).slice(0, 8).toUpperCase()}
                      </Link>
                      <div className="text-xs font-semibold text-[var(--adm-text)] mt-0.5 truncate">
                        {order.userName || 'Morador'}
                      </div>
                      <div className="text-[11px] text-[var(--adm-text-dim)] tabular-nums">
                        {formatDateTime(order.createdAt)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-bold text-emerald-300 tabular-nums">
                        {formatCurrency(order.total)}
                      </div>
                      <div className="text-[11px] text-[var(--adm-text-dim)] tabular-nums">
                        {order.items?.length || 0} itens
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <OrderStatusBadge status={order.status} />
                    <PaymentStatusBadge status={order.paymentStatus} />
                  </div>

                  <div className="pt-2.5 border-t border-[var(--adm-border)] flex flex-wrap items-center justify-between gap-2">
                    {canConfirmPix ? (
                      <button
                        type="button"
                        disabled={actionLoading === `pay-${order.id}`}
                        onClick={() => handleConfirmPayment(order.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-200 border border-emerald-500/30 font-semibold text-xs inline-flex items-center gap-1"
                      >
                        <CheckCircle2 size={13} />
                        Confirmar Pix
                      </button>
                    ) : (
                      <span />
                    )}

                    <Link
                      to={`/admin/orders/${order.id}`}
                      className="px-3.5 py-1.5 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold text-xs inline-flex items-center gap-1.5"
                    >
                      <Eye size={13} />
                      Abrir Pedido
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Cancel Order Modal */}
      <ReasonConfirmModal
        open={Boolean(cancelTarget)}
        title={`Cancelar Pedido #${(cancelTarget?.orderNumber || cancelTarget?.id || '').slice(0, 8).toUpperCase()}`}
        description="O cancelamento estornará automaticamente as quantidades de todos os itens para o estoque da loja e registrará um evento na linha do tempo do pedido e na auditoria."
        confirmLabel="Confirmar Cancelamento"
        danger
        loading={ Boolean(cancelTarget && actionLoading === `cancel-${cancelTarget.id}`) }
        onClose={() => setCancelTarget(null)}
        onConfirm={async (reason) => {
          if (!cancelTarget) return;
          const ok = await handleCancelOrder(cancelTarget.id, reason);
          if (ok) setCancelTarget(null);
        }}
      />
    </div>
  );
};

