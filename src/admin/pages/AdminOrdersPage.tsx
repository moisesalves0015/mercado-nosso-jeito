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
    <div className="space-y-6">
      <PageHeader
        title="Gestão de Pedidos"
        subtitle="Acompanhe a fila de separação, confirme pagamentos Pix e gerencie entregas no condomínio."
        badge={`${filteredOrders.length} pedidos`}
      />

      {/* Filter Bar */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 space-y-4 shadow-lg">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => updateParam('q', e.target.value)}
              placeholder="Buscar por #código, morador, condomínio ou apartamento..."
              aria-label="Filtrar pedidos por texto"
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-400 focus:outline-none text-xs sm:text-sm text-white placeholder-slate-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={15} className="text-slate-400 shrink-0" />
            <select
              value={paymentFilter}
              onChange={(e) => updateParam('payment', e.target.value)}
              aria-label="Filtrar por status de pagamento"
              className="rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-400 focus:outline-none px-3 py-2 text-xs font-bold text-slate-200"
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  active
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-950/80 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    active ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-slate-400'
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
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white"
              >
                Limpar Filtros
              </button>
            )
          }
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-slate-900/90 border border-slate-800/90 rounded-2xl overflow-hidden shadow-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Pedido</th>
                  <th className="py-3.5 px-4">Morador / Destino</th>
                  <th className="py-3.5 px-4">Status Operacional</th>
                  <th className="py-3.5 px-4">Pagamento</th>
                  <th className="py-3.5 px-4">Total</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs">
                {filteredOrders.map((order) => {
                  const canConfirmPix =
                    canApprovePayment &&
                    order.status !== 'cancelled' &&
                    order.paymentStatus !== 'approved';
                  const isPaidOrOnDelivery =
                    order.paymentStatus === 'approved' || order.paymentStatus === 'on_delivery';

                  return (
                    <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 align-top">
                        <Link
                          to={`/admin/orders/${order.id}`}
                          className="font-mono font-extrabold text-amber-400 hover:underline text-sm"
                        >
                          #{(order.orderNumber || order.id).slice(0, 8).toUpperCase()}
                        </Link>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {formatDateTime(order.createdAt)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {order.items?.length || 0} {(order.items?.length || 0) === 1 ? 'item' : 'itens'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        {order.uid ? (
                          <Link
                            to={`/admin/customers/${order.uid}`}
                            className="font-bold text-white hover:text-amber-300 transition-colors"
                          >
                            {order.userName || 'Morador'}
                          </Link>
                        ) : (
                          <span className="font-bold text-white">{order.userName || 'Morador'}</span>
                        )}
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {order.address?.condominio
                            ? `${order.address.condominio}${
                                order.address.bloco ? ` • Bl. ${order.address.bloco}` : ''
                              }${order.address.apartamento ? ` • Apto ${order.address.apartamento}` : ''}`
                            : order.address?.street
                            ? `${order.address.street}, ${order.address.number || ''}`
                            : 'Retirada / Condomínio'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <OrderStatusBadge status={order.status} />
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <PaymentStatusBadge status={order.paymentStatus} />
                        {order.paymentMethod && (
                          <div className="text-[11px] text-slate-400 mt-1">{order.paymentMethod}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top font-black text-emerald-400 text-sm">
                        {formatCurrency(order.total)}
                      </td>

                      <td className="py-3.5 px-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {canConfirmPix && (
                            <button
                              type="button"
                              disabled={actionLoading === `pay-${order.id}`}
                              onClick={() => handleConfirmPayment(order.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold text-[11px] inline-flex items-center gap-1"
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
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 font-bold text-[11px]"
                              >
                                Separar
                              </button>
                            )}

                          {canEditOrder && order.status === 'preparing' && (
                            <button
                              type="button"
                              disabled={actionLoading === `status-${order.id}`}
                              onClick={() => handleUpdateOrderStatus(order.id, 'delivering')}
                              className="px-2.5 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 font-bold text-[11px] inline-flex items-center gap-1"
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
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-bold text-[11px]"
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
                                className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30"
                                title="Cancelar pedido com estorno de estoque"
                                aria-label="Cancelar pedido"
                              >
                                <XCircle size={14} />
                              </button>
                            )}

                          <Link
                            to={`/admin/orders/${order.id}`}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold text-[11px] inline-flex items-center gap-1"
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

          {/* Mobile & Tablet Cards */}
          <div className="lg:hidden space-y-3">
            {filteredOrders.map((order) => {
              const canConfirmPix =
                canApprovePayment &&
                order.status !== 'cancelled' &&
                order.paymentStatus !== 'approved';
              return (
                <div
                  key={order.id}
                  className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 space-y-3 shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="font-mono font-extrabold text-amber-400 text-sm"
                      >
                        #{(order.orderNumber || order.id).slice(0, 8).toUpperCase()}
                      </Link>
                      <div className="text-xs font-bold text-white mt-0.5">
                        {order.userName || 'Morador'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {formatDateTime(order.createdAt)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black text-emerald-400">
                        {formatCurrency(order.total)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {order.items?.length || 0} itens
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <OrderStatusBadge status={order.status} />
                    <PaymentStatusBadge status={order.paymentStatus} />
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                    {canConfirmPix ? (
                      <button
                        type="button"
                        disabled={actionLoading === `pay-${order.id}`}
                        onClick={() => handleConfirmPayment(order.id)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-xs inline-flex items-center gap-1"
                      >
                        <CheckCircle2 size={13} />
                        Confirmar Pix
                      </button>
                    ) : (
                      <span />
                    )}

                    <Link
                      to={`/admin/orders/${order.id}`}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5"
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

