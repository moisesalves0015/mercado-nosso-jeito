import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Headphones,
  MapPin,
  Package,
  Truck,
  User,
  XCircle,
} from 'lucide-react';
import { db } from '../../firebase';
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

export const AdminOrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { canAny } = useAuth();
  const {
    orders,
    actionLoading,
    handleConfirmPayment,
    handleUpdateOrderStatus,
    handleCancelOrder,
  } = useAdminData();

  const [fetchedOrder, setFetchedOrder] = useState<AdminOrder | null>(null);
  const [fetching, setFetching] = useState(false);
  const [pixRef, setPixRef] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const liveOrder = orders.find((o) => o.id === orderId);
  const order = liveOrder || fetchedOrder;

  useEffect(() => {
    if (liveOrder || !orderId) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFetching(true);
    getDoc(doc(db, 'orders', orderId))
      .then((snap) => {
        if (active && snap.exists()) {
          setFetchedOrder({ id: snap.id, ...snap.data() } as AdminOrder);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setFetching(false);
      });
    return () => {
      active = false;
    };
  }, [orderId, liveOrder]);

  const canApprovePayment = canAny(['financeiro:approve', 'pedidos:approve']);
  const canEditOrder = canAny(['pedidos:edit', 'pedidos:approve']);

  if (fetching) {
    return (
      <div className="p-12 text-center text-sm text-slate-400">
        Carregando ficha completa do pedido...
      </div>
    );
  }

  if (!order) {
    return (
      <EmptyState
        icon={<Package size={24} />}
        title="Pedido não encontrado"
        description={`Não localizamos o pedido #${orderId} na base de dados.`}
        action={
          <Link
            to="/admin/orders"
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
          >
            Voltar para Fila de Pedidos
          </Link>
        }
      />
    );
  }

  const isPaidOrOnDelivery =
    order.paymentStatus === 'approved' || order.paymentStatus === 'on_delivery';

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Pedido #${(order.orderNumber || order.id).slice(0, 10).toUpperCase()}`}
        subtitle={`Criado em ${formatDateTime(order.createdAt)} • ID: ${order.id}`}
        backTo="/admin/orders"
        backLabel="Voltar para Pedidos"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
            <Link
              to={`/admin/support?orderId=${encodeURIComponent(order.id)}&uid=${encodeURIComponent(order.uid || '')}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-sky-300 border border-slate-700"
            >
              <Headphones size={14} />
              Abrir Chamado deste Pedido
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Items + Financial Breakdown + Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg">
            <h2 className="text-base font-extrabold text-white mb-4 flex items-center gap-2">
              <Package size={17} className="text-amber-400" />
              Itens para Separação ({order.items?.length || 0})
            </h2>

            <div className="divide-y divide-slate-800/80">
              {(order.items || []).map((item, idx) => (
                <div
                  key={`${item.id || idx}-${idx}`}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-11 h-11 rounded-xl object-cover bg-slate-950 border border-slate-800 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                        <Package size={16} />
                      </div>
                    )}
                    <div className="min-w-0">
                      {item.id ? (
                        <Link
                          to={`/admin/products/${item.id}`}
                          className="text-xs sm:text-sm font-bold text-white hover:text-amber-400 truncate block"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        <div className="text-xs sm:text-sm font-bold text-white truncate">
                          {item.title}
                        </div>
                      )}
                      <div className="text-xs text-slate-400">
                        {item.quantity}x {formatCurrency(item.price)}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-extrabold text-white shrink-0">
                    {formatCurrency(Number(item.price || 0) * Number(item.quantity || 1))}
                  </div>
                </div>
              ))}
            </div>

            {/* Totals Breakdown */}
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-2 text-xs">
              {order.subtotal !== undefined && (
                <div className="flex justify-between text-slate-300">
                  <span>Subtotal dos itens</span>
                  <span className="font-bold">{formatCurrency(order.subtotal)}</span>
                </div>
              )}
              {order.shippingFee !== undefined && (
                <div className="flex justify-between text-slate-300">
                  <span>Taxa de entrega</span>
                  <span className="font-bold">
                    {Number(order.shippingFee) === 0 ? 'Grátis' : formatCurrency(order.shippingFee)}
                  </span>
                </div>
              )}
              {Number(order.discountValue || 0) > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>
                    Desconto aplicado {order.couponCode ? `(${order.couponCode})` : ''}
                  </span>
                  <span className="font-bold">- {formatCurrency(order.discountValue)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm sm:text-base font-black text-white pt-2 border-t border-slate-800/80">
                <span>Total Calculado no Servidor</span>
                <span className="text-emerald-400 text-lg">{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Order Timeline */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg">
            <h2 className="text-base font-extrabold text-white mb-4 flex items-center gap-2">
              <Clock size={17} className="text-sky-400" />
              Linha do Tempo & Auditoria do Pedido
            </h2>
            {!order.timeline || order.timeline.length === 0 ? (
              <p className="text-xs text-slate-400">Sem eventos detalhados registrados.</p>
            ) : (
              <ol className="relative border-l border-slate-800 ml-3 space-y-4">
                {order.timeline.map((ev, i) => (
                  <li key={i} className="ml-4">
                    <span className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-slate-900" />
                    <div className="text-xs font-bold text-white">{ev.label}</div>
                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                      <span>{formatDateTime(ev.timestamp)}</span>
                      {ev.actor && <span>• Ator: {ev.actor}</span>}
                      {ev.details && <span className="text-amber-300">• {ev.details}</span>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Right Column: Actions + Customer + Address */}
        <div className="space-y-6">
          {/* Operational Control Card */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg space-y-4">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <CreditCard size={17} className="text-emerald-400" />
              Ações de Conciliação & Status
            </h2>

            {/* Pix Confirmation Box */}
            {order.status !== 'cancelled' && order.paymentStatus !== 'approved' && (
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-2.5">
                <div className="text-xs font-bold text-emerald-300">
                  Conciliação Financeira (Pix / Entrega)
                </div>
                <input
                  type="text"
                  value={pixRef}
                  onChange={(e) => setPixRef(e.target.value)}
                  placeholder="ID E2E / Comprovante Pix (opcional)"
                  className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-xs text-white placeholder-slate-400"
                />
                <button
                  type="button"
                  disabled={!canApprovePayment || actionLoading === `pay-${order.id}`}
                  onClick={() => handleConfirmPayment(order.id, pixRef.trim() || undefined)}
                  className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <CheckCircle2 size={15} />
                  Confirmar Recebimento Agora
                </button>
              </div>
            )}

            {/* Status Transitions */}
            {order.status !== 'cancelled' && canEditOrder && (
              <div className="space-y-2.5 pt-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Avançar Etapa Operacional
                </label>
                <input
                  type="text"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Observação na timeline (ex: Entregue na portaria)"
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-400"
                />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={
                      !isPaidOrOnDelivery ||
                      order.status === 'preparing' ||
                      actionLoading === `status-${order.id}`
                    }
                    onClick={() =>
                      handleUpdateOrderStatus(order.id, 'preparing', statusNote.trim() || undefined)
                    }
                    className="px-3 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 disabled:opacity-40 text-indigo-200 border border-indigo-500/30 font-bold text-xs"
                  >
                    1. Em Preparo
                  </button>
                  <button
                    type="button"
                    disabled={
                      !isPaidOrOnDelivery ||
                      order.status === 'delivering' ||
                      actionLoading === `status-${order.id}`
                    }
                    onClick={() =>
                      handleUpdateOrderStatus(order.id, 'delivering', statusNote.trim() || undefined)
                    }
                    className="px-3 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-40 text-purple-200 border border-purple-500/30 font-bold text-xs inline-flex items-center justify-center gap-1"
                  >
                    <Truck size={13} />
                    2. Saiu p/ Entrega
                  </button>
                </div>

                <button
                  type="button"
                  disabled={
                    order.status === 'delivered' || actionLoading === `status-${order.id}`
                  }
                  onClick={() =>
                    handleUpdateOrderStatus(order.id, 'delivered', statusNote.trim() || undefined)
                  }
                  className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-extrabold text-xs"
                >
                  3. Marcar como Entregue ao Morador
                </button>

                {!isPaidOrOnDelivery && (
                  <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                    Regra Comercial: confirme o recebimento Pix antes de avançar para separação ou rota.
                  </p>
                )}
              </div>
            )}

            {/* Cancel Button */}
            {order.status !== 'cancelled' && order.status !== 'delivered' && canEditOrder && (
              <div className="pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(true)}
                  className="w-full py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold text-xs inline-flex items-center justify-center gap-1.5"
                >
                  <XCircle size={14} />
                  Cancelar Pedido e Estornar Estoque
                </button>
              </div>
            )}
          </div>

          {/* Customer Info */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg space-y-3">
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              <User size={16} className="text-indigo-400" />
              Dados do Morador
            </h2>
            <div className="text-xs space-y-1.5">
              <div className="font-bold text-white text-sm">{order.userName || 'Cliente'}</div>
              {order.userEmail && <div className="text-slate-400">{order.userEmail}</div>}
              {order.userPhone && <div className="text-slate-300">{order.userPhone}</div>}
              {order.uid && (
                <div className="pt-2">
                  <Link
                    to={`/admin/customers/${order.uid}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 font-bold text-xs"
                  >
                    Abrir Ficha 360° do Morador
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Address */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg space-y-2">
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              <MapPin size={16} className="text-amber-400" />
              Endereço de Entrega
            </h2>
            {order.address ? (
              <div className="text-xs text-slate-300 space-y-1 leading-relaxed">
                {order.address.condominio && (
                  <div className="font-bold text-amber-300">{order.address.condominio}</div>
                )}
                {(order.address.bloco || order.address.apartamento) && (
                  <div className="font-semibold text-white">
                    {order.address.bloco ? `Bloco ${order.address.bloco} ` : ''}
                    {order.address.apartamento ? `• Apto ${order.address.apartamento}` : ''}
                  </div>
                )}
                {order.address.street && (
                  <div>
                    {order.address.street}, {order.address.number}{' '}
                    {order.address.complement ? `- ${order.address.complement}` : ''}
                  </div>
                )}
                {order.address.neighborhood && (
                  <div className="text-slate-400">
                    {order.address.neighborhood} • {order.address.city}/{order.address.state}
                  </div>
                )}
                {order.address.referencia && (
                  <div className="text-slate-400 italic">Ref: {order.address.referencia}</div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Modalidade: {order.deliveryMethod || 'Entrega no condomínio'}
              </p>
            )}
          </div>
        </div>
      </div>

      <ReasonConfirmModal
        open={cancelModalOpen}
        title="Confirmar Cancelamento do Pedido"
        description="Informe o motivo do cancelamento. O estoque dos itens será estornado atomicamente."
        confirmLabel="Cancelar Pedido"
        danger
        loading={actionLoading === `cancel-${order.id}`}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={async (reason) => {
          const ok = await handleCancelOrder(order.id, reason);
          if (ok) setCancelModalOpen(false);
        }}
      />
    </div>
  );
};
