import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Edit,
  ExternalLink,
  FileText,
  Headphones,
  MapPin,
  MessageCircle,
  Package,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  Truck,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { db, functions } from '../../firebase';
import { useAuth } from '../../hooks/useAuth';
import { useAdminData, type AdminOrder, type OrderItemSummary, type OrderTimelineEvent } from '../AdminDataContext';
import {
  formatCurrency,
  OrderStatusBadge,
  PaymentStatusBadge,
  ReasonConfirmModal,
} from '../components/AdminUi';
import {
  COURIER_PICKUP_STATUS_LABELS,
  resolveOrderFulfillmentPlan,
  SUPPLY_ORIGIN_SHORT_LABELS,
  type CourierPickupStatus,
  type OrderPickupTaskRecord,
  type ProductOfferRecord,
} from '../../utils/purchasingEngine';
import {
  listOrderPickupTasks,
  listProductOffers,
  upsertOrderPickupTask,
} from '../../services/purchasingService';
import { cleanImageUrl, handleImageError } from '../../utils/imageUrl';

// ──────────────────────────────────────────────────────────────
// Robust Date & Time Helpers (with seconds and relative time)
// ──────────────────────────────────────────────────────────────
function parseToDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') return new Date(val);
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'object' && val !== null) {
    const o = val as { seconds?: number; _seconds?: number; toDate?: () => Date; toMillis?: () => number };
    if (typeof o.toDate === 'function') return o.toDate();
    if (typeof o.toMillis === 'function') return new Date(o.toMillis());
    const secs = o.seconds ?? o._seconds;
    if (typeof secs === 'number') return new Date(secs * 1000);
  }
  return null;
}

function formatFullDateTime(ts: unknown): string {
  const d = parseToDate(ts);
  if (!d) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatRelativeTime(ts: unknown): string {
  const d = parseToDate(ts);
  if (!d) return '';
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return 'agora mesmo';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `há ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `há ${diffDays} dias`;
}

function mapDocToAdminOrder(docId: string, data: Record<string, unknown>): AdminOrder {
  const addr = (data.address as Record<string, unknown> | undefined) ?? undefined;
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const items: OrderItemSummary[] = rawItems.map((it: Record<string, unknown>, idx: number) => ({
    id: String(it.id || it.productId || `item_${idx}`),
    title: String(it.title || 'Produto sem título'),
    quantity: Number(it.quantity || 1),
    price: Number(it.price || 0),
    image: typeof it.image === 'string' ? it.image : undefined,
  }));

  const rawTimeline = Array.isArray(data.timeline) ? data.timeline : [];
  const timeline: OrderTimelineEvent[] = rawTimeline.map((ev: Record<string, unknown>) => ({
    status: String(ev.status || ''),
    label: String(ev.label || ''),
    timestamp: ev.timestamp,
    actor: typeof ev.actor === 'string' ? ev.actor : undefined,
    details: typeof ev.details === 'string' ? ev.details : undefined,
  }));

  return {
    id: docId,
    orderNumber: typeof data.orderNumber === 'string' ? data.orderNumber : undefined,
    uid: String(data.uid || ''),
    userName: typeof data.userName === 'string' ? data.userName : undefined,
    userEmail: typeof data.userEmail === 'string' ? data.userEmail : undefined,
    userPhone: typeof data.userPhone === 'string' ? data.userPhone : undefined,
    status: (data.status as AdminOrder['status']) || 'pending',
    paymentStatus: (data.paymentStatus as AdminOrder['paymentStatus']) || 'pending',
    paymentMethod: typeof data.paymentMethod === 'string' ? data.paymentMethod : undefined,
    paymentReference: typeof data.paymentReference === 'string' ? data.paymentReference : null,
    paymentNote: typeof data.paymentNote === 'string' ? data.paymentNote : undefined,
    subtotal: Number(data.subtotal ?? (data.subTotal ?? 0)),
    shippingFee: Number(data.shippingFee ?? (data.deliveryFee ?? 0)),
    discountValue: Number(data.discountValue ?? (data.discount ?? 0)),
    couponCode: typeof data.couponCode === 'string' ? data.couponCode : (typeof data.coupon === 'string' ? data.coupon : null),
    total: Number(data.total ?? 0),
    deliveryMethod: typeof data.deliveryMethod === 'string' ? data.deliveryMethod : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    paidAt: data.paidAt,
    confirmedBy: typeof data.confirmedBy === 'string' ? data.confirmedBy : undefined,
    cancelledBy: typeof data.cancelledBy === 'string' ? data.cancelledBy : undefined,
    cancellationReason: typeof data.cancellationReason === 'string' ? data.cancellationReason : null,
    items,
    timeline,
    address: addr ? {
      street: typeof addr.street === 'string' ? addr.street : undefined,
      number: typeof addr.number === 'string' ? addr.number : undefined,
      complement: typeof addr.complement === 'string' ? addr.complement : undefined,
      neighborhood: typeof addr.neighborhood === 'string' ? addr.neighborhood : undefined,
      city: typeof addr.city === 'string' ? addr.city : undefined,
      state: typeof addr.state === 'string' ? addr.state : undefined,
      zipCode: typeof addr.zipCode === 'string' ? addr.zipCode : undefined,
      condominio: typeof addr.condominio === 'string' ? addr.condominio : undefined,
      bloco: typeof addr.bloco === 'string' ? addr.bloco : undefined,
      apartamento: typeof addr.apartamento === 'string' ? addr.apartamento : undefined,
      referencia: typeof addr.referencia === 'string' ? addr.referencia : undefined,
      apelido: typeof addr.apelido === 'string' ? addr.apelido : undefined,
    } : undefined,
    adminNotes: typeof data.adminNotes === 'string' ? data.adminNotes : (typeof data.internalNotes === 'string' ? data.internalNotes : ''),
  };
}

const ORDER_STAGES = [
  { key: 'pending', label: 'Recebido', description: 'Aguardando confirmação comercial' },
  { key: 'confirmed', label: 'Confirmado', description: 'Pagamento aprovado / Pedido aceito' },
  { key: 'preparing', label: 'Em Preparo', description: 'Separação e conferência no estoque' },
  { key: 'delivering', label: 'Saiu p/ Entrega', description: 'Em rota com o entregador' },
  { key: 'delivered', label: 'Entregue', description: 'Finalizado com o morador' },
] as const;

export const AdminOrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { user, userProfile, canAny } = useAuth();
  const {
    orders,
    products,
    actionLoading,
    showToast,
    handleConfirmPayment,
    handleUpdateOrderStatus,
    handleCancelOrder,
  } = useAdminData();

  // Local state
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Operational states
  const [pixRef, setPixRef] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [statusActor, setStatusActor] = useState('');
  const [adminNotesText, setAdminNotesText] = useState('');
  const [assignedCourier, setAssignedCourier] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingCourier, setSavingCourier] = useState(false);

  // Modals
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [editItemsModalOpen, setEditItemsModalOpen] = useState(false);
  const [editAddressModalOpen, setEditAddressModalOpen] = useState(false);
  const [addTimelineModalOpen, setAddTimelineModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Purchasing & Multiorigin
  const [offers, setOffers] = useState<ProductOfferRecord[]>([]);
  const [pickupTasks, setPickupTasks] = useState<OrderPickupTaskRecord[]>([]);
  const [courierInputByProd, setCourierInputByProd] = useState<Record<string, string>>({});

  const actorName = useMemo(
    () => userProfile?.name || user?.email || 'Administrador',
    [userProfile, user],
  );

  // ──────────────────────────────────────────────────────────────
  // 1. Data Loading: Multi-tier, Resilient, 0 Infinite Spinners
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orderId) {
      setFetching(false);
      setFetchError('ID de pedido não fornecido.');
      return;
    }

    let active = true;
    setFetching(true);
    setFetchError(null);

    // Initial check from context
    const cached = orders.find((o) => o.id === orderId || o.orderNumber === orderId);
    if (cached) {
      setOrder(cached);
      setAdminNotesText(cached.adminNotes || '');
      setFetching(false);
    }

    // Direct Firestore Real-time Listener (doc ID or orderNumber lookup)
    const orderDocRef = doc(db, 'orders', orderId);
    const unsubscribe = onSnapshot(
      orderDocRef,
      async (snap) => {
        if (!active) return;
        if (snap.exists()) {
          const mapped = mapDocToAdminOrder(snap.id, snap.data());
          setOrder(mapped);
          setAdminNotesText(mapped.adminNotes || '');
          setFetching(false);
          setFetchError(null);
        } else {
          // If not found by Doc ID, attempt query by orderNumber
          try {
            const cleanNumber = orderId.startsWith('#') ? orderId : `#${orderId}`;
            const q = query(
              collection(db, 'orders'),
              where('orderNumber', 'in', [orderId, cleanNumber]),
              limit(1),
            );
            const querySnap = await getDocs(q);
            if (!active) return;
            if (!querySnap.empty) {
              const firstDoc = querySnap.docs[0];
              const mapped = mapDocToAdminOrder(firstDoc.id, firstDoc.data());
              setOrder(mapped);
              setAdminNotesText(mapped.adminNotes || '');
              setFetching(false);
              setFetchError(null);
              return;
            }
          } catch {
            // fallback below
          }

          // Fallback to Cloud Function adminGetOrder if not cached
          try {
            const fn = httpsCallable<{ orderId: string }, { order: AdminOrder }>(
              functions,
              'adminGetOrder',
            );
            const res = await fn({ orderId });
            if (!active) return;
            if (res.data?.order) {
              setOrder(res.data.order);
              setAdminNotesText(res.data.order.adminNotes || '');
              setFetching(false);
              setFetchError(null);
              return;
            }
          } catch (cfErr: unknown) {
            if (!cached) {
              setFetchError(
                (cfErr as { message?: string })?.message ||
                  'Pedido não localizado na base de dados.',
              );
            }
          }

          if (!cached) {
            setFetching(false);
          }
        }
      },
      (err) => {
        if (!active) return;
        // If snapshot listener fails with permission, fallback to callable or cached
        if (cached) {
          setFetching(false);
          return;
        }
        const fn = httpsCallable<{ orderId: string }, { order: AdminOrder }>(
          functions,
          'adminGetOrder',
        );
        fn({ orderId })
          .then((res) => {
            if (!active) return;
            if (res.data?.order) {
              setOrder(res.data.order);
              setAdminNotesText(res.data.order.adminNotes || '');
            } else {
              setFetchError('Pedido não encontrado.');
            }
          })
          .catch((cfErr) => {
            if (!active) return;
            setFetchError(cfErr?.message || err.message || 'Erro ao carregar o pedido.');
          })
          .finally(() => {
            if (active) setFetching(false);
          });
      },
    );

    // Safety timeout: 4.5 seconds maximum loading time
    const safetyTimer = setTimeout(() => {
      if (active) {
        setFetching(false);
      }
    }, 4500);

    return () => {
      active = false;
      unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, [orderId, orders]);

  // Load purchasing & multi-origin offers
  useEffect(() => {
    Promise.all([listProductOffers(), listOrderPickupTasks()])
      .then(([offList, taskList]) => {
        setOffers(offList);
        setPickupTasks(taskList);
      })
      .catch(() => {});
  }, []);

  const fulfillmentPlan = useMemo(
    () => (order ? resolveOrderFulfillmentPlan(order, offers) : null),
    [order, offers],
  );

  const canApprovePayment = canAny(['financeiro:approve', 'pedidos:approve']);
  const canEditOrder = canAny(['pedidos:edit', 'pedidos:approve']);

  // Copy order ID helper
  const handleCopyOrderId = () => {
    if (!order) return;
    navigator.clipboard.writeText(order.id);
    setCopiedId(true);
    showToast('ID do pedido copiado para a área de transferência!', 'ok');
    setTimeout(() => setCopiedId(false), 2500);
  };

  // WhatsApp link generator
  const getWhatsAppLink = () => {
    if (!order?.userPhone) return null;
    const digits = order.userPhone.replace(/\D/g, '');
    const phoneWithCountry = digits.length <= 11 ? `55${digits}` : digits;
    const text = encodeURIComponent(
      `Olá ${order.userName || 'Cliente'}! Somos da equipe do Mercado Nosso Jeito referente ao seu pedido #${
        order.orderNumber || order.id.slice(0, 8)
      }.\n\nTotal: ${formatCurrency(order.total)} • Status atual: ${
        order.status === 'preparing'
          ? 'Em Separação'
          : order.status === 'delivering'
          ? 'Saiu para Entrega'
          : order.status === 'delivered'
          ? 'Entregue'
          : 'Confirmado'
      }.\n\nComo podemos te ajudar?`,
    );
    return `https://wa.me/${phoneWithCountry}?text=${text}`;
  };

  // ──────────────────────────────────────────────────────────────
  // Direct Mutations with Complete Audit Trail
  // ──────────────────────────────────────────────────────────────
  const handleDirectStatusChange = async (newStatus: AdminOrder['status'], note?: string) => {
    if (!order) return;
    const noteText = note?.trim() || statusNote.trim() || undefined;
    const responsible = statusActor.trim() || actorName;

    // First attempt transactional Cloud Function
    const ok = await handleUpdateOrderStatus(order.id, newStatus, noteText);
    if (!ok) {
      // Direct Firestore update fallback if admin has direct rules permission
      try {
        const orderRef = doc(db, 'orders', order.id);
        const existingTimeline = order.timeline || [];
        const statusLabels: Record<string, string> = {
          pending: 'Pendente',
          confirmed: 'Confirmado',
          preparing: 'Em preparo',
          delivering: 'Saiu para Entrega',
          delivered: 'Entregue ao Morador',
          cancelled: 'Cancelado',
        };
        const newEvent: OrderTimelineEvent = {
          status: newStatus,
          label: `${statusLabels[newStatus] || newStatus}${noteText ? ` - ${noteText}` : ''}`,
          timestamp: new Date().toISOString(),
          actor: responsible,
          details: noteText,
        };

        const patch: Record<string, unknown> = {
          status: newStatus,
          updatedAt: serverTimestamp(),
          timeline: [...existingTimeline, newEvent],
        };

        if (newStatus === 'delivered' && order.paymentStatus === 'on_delivery') {
          patch.paymentStatus = 'approved';
          patch.paidAt = serverTimestamp();
          patch.confirmedBy = responsible;
        }

        await updateDoc(orderRef, patch);
        showToast(`Status atualizado para "${statusLabels[newStatus] || newStatus}" com sucesso!`, 'ok');
      } catch (err: unknown) {
        showToast((err as { message?: string })?.message || 'Falha ao atualizar status.', 'err');
        return;
      }
    }
    setStatusNote('');
  };

  const handleSaveInternalNotes = async () => {
    if (!order) return;
    setSavingNotes(true);
    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        adminNotes: adminNotesText.trim(),
        updatedAt: serverTimestamp(),
      });
      showToast('Notas internas salvas com sucesso!', 'ok');
    } catch (err: unknown) {
      showToast((err as { message?: string })?.message || 'Erro ao salvar notas.', 'err');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleSaveCourier = async () => {
    if (!order) return;
    setSavingCourier(true);
    try {
      const orderRef = doc(db, 'orders', order.id);
      const courier = assignedCourier.trim();
      const existingTimeline = order.timeline || [];
      const newEvent: OrderTimelineEvent = {
        status: order.status,
        label: `Entregador atribuído: ${courier}`,
        timestamp: new Date().toISOString(),
        actor: actorName,
        details: `Entregador designado para entrega ao morador`,
      };
      await updateDoc(orderRef, {
        assignedCourier: courier,
        timeline: [...existingTimeline, newEvent],
        updatedAt: serverTimestamp(),
      });
      showToast(`Entregador "${courier}" atribuído ao pedido!`, 'ok');
    } catch (err: unknown) {
      showToast((err as { message?: string })?.message || 'Erro ao atribuir entregador.', 'err');
    } finally {
      setSavingCourier(false);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // Loading & Error States (Resilient & Non-blocking)
  // ──────────────────────────────────────────────────────────────
  if (fetching && !order) {
    return (
      <div className="p-12 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--adm-brand-soft)] text-[var(--adm-brand)] animate-pulse">
          <RefreshCw size={24} className="animate-spin" />
        </div>
        <div className="text-base font-bold text-[var(--adm-text)]">
          Carregando ficha completa do pedido...
        </div>
        <p className="text-xs text-[var(--adm-text-muted)] max-w-sm mx-auto">
          Consultando Firestore em tempo real e validando permissões operacionais.
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-xl bg-[var(--adm-surface)] border border-[var(--adm-border)] text-center space-y-4 shadow-xl">
        <div className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center mx-auto">
          <AlertTriangle size={28} />
        </div>
        <h2 className="text-xl font-extrabold text-[var(--adm-text)]">Pedido não localizado</h2>
        <p className="text-xs text-[var(--adm-text-muted)] leading-relaxed">
          {fetchError || `Não localizamos o pedido com identificador "${orderId}" na base de dados.`}
        </p>
        <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] border border-[var(--adm-border)] text-xs font-bold text-[var(--adm-text)] inline-flex items-center gap-1.5"
          >
            <RefreshCw size={14} />
            Tentar Novamente
          </button>
          <Link
            to="/admin/orders"
            className="px-4 py-2 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-bold text-xs inline-flex items-center gap-1.5"
          >
            <ArrowLeft size={14} />
            Voltar para Fila de Pedidos
          </Link>
        </div>
      </div>
    );
  }

  const isPaidOrOnDelivery =
    order.paymentStatus === 'approved' || order.paymentStatus === 'on_delivery';
  const whatsappUrl = getWhatsAppLink();

  // Find stage indexes
  const currentStageIdx = ORDER_STAGES.findIndex((s) => s.key === order.status);

  return (
    <div className="space-y-6 pb-12">
      {/* ──────────────────────────────────────────────────────────
          HEADER & TOP BAR ACTIONS
          ────────────────────────────────────────────────────────── */}
      <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link
              to="/admin/orders"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--adm-text-muted)] hover:text-[var(--adm-gold)] transition-colors mb-1"
            >
              <ArrowLeft size={13} />
              Voltar para Fila de Pedidos
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--adm-text)] tracking-tight">
                Pedido #{order.orderNumber || order.id.slice(0, 8).toUpperCase()}
              </h1>
              <div className="flex items-center gap-2">
                <OrderStatusBadge status={order.status} />
                <PaymentStatusBadge status={order.paymentStatus} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--adm-text-muted)] pt-0.5">
              <span className="font-mono text-[var(--adm-text-dim)] flex items-center gap-1">
                ID: {order.id}
                <button
                  type="button"
                  onClick={handleCopyOrderId}
                  title="Copiar ID do pedido"
                  className="hover:text-[var(--adm-text)] p-0.5 rounded transition-colors"
                >
                  {copiedId ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-[var(--adm-text)] font-medium">
                <Clock size={13} className="text-sky-300" />
                Criado em {formatFullDateTime(order.createdAt)} ({formatRelativeTime(order.createdAt)})
              </span>
              {Boolean(order.updatedAt) && (
                <>
                  <span>•</span>
                  <span className="text-[var(--adm-text-dim)]">
                    Atualizado em {formatFullDateTime(order.updatedAt)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-colors"
              >
                <MessageCircle size={15} />
                WhatsApp do Cliente
              </a>
            )}
            <button
              type="button"
              onClick={() => setPrintModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-xs font-bold text-[var(--adm-text)] border border-[var(--adm-border)] transition-colors"
            >
              <Printer size={15} />
              Imprimir Romaneio / Cupom
            </button>
            <Link
              to={`/admin/support?orderId=${encodeURIComponent(order.id)}&uid=${encodeURIComponent(order.uid || '')}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] text-xs font-semibold text-sky-200 border border-[var(--adm-border)] transition-colors"
            >
              <Headphones size={15} />
              Suporte
            </Link>
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────
            STATUS STEPPER / PIPELINE (with visible dates & actors)
            ────────────────────────────────────────────────────────── */}
        <div className="pt-3 border-t border-[var(--adm-border)]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--adm-text-muted)] mb-3 flex items-center justify-between">
            <span>Fluxo Operacional de Status</span>
            {order.status === 'cancelled' && (
              <span className="text-rose-400 font-bold bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded text-[11px]">
                Pedido Cancelado {order.cancellationReason ? `— Motivo: ${order.cancellationReason}` : ''}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {ORDER_STAGES.map((stg, idx) => {
              const isPast = currentStageIdx > idx;
              const isCurrent = currentStageIdx === idx && order.status !== 'cancelled';
              // Find matching event from timeline
              const timelineEv = (order.timeline || [])
                .filter((ev) => ev.status === stg.key)
                .slice(-1)[0];

              return (
                <div
                  key={stg.key}
                  className={`p-3 rounded-lg border transition-all ${
                    isCurrent
                      ? 'bg-emerald-950/40 border-emerald-500/60 shadow-sm'
                      : isPast
                      ? 'bg-[var(--adm-surface-elevated)] border-emerald-500/25 opacity-90'
                      : 'bg-[var(--adm-bg-subtle)] border-[var(--adm-border)] opacity-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className={`text-xs font-extrabold flex items-center gap-1.5 ${
                        isCurrent
                          ? 'text-emerald-300'
                          : isPast
                          ? 'text-emerald-400'
                          : 'text-[var(--adm-text-muted)]'
                      }`}
                    >
                      {isPast ? (
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      ) : isCurrent ? (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-[var(--adm-text-dim)] shrink-0" />
                      )}
                      {stg.label}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--adm-text-dim)]">
                      {idx + 1}/5
                    </span>
                  </div>

                  {timelineEv ? (
                    <div className="text-[10px] text-[var(--adm-text-muted)] space-y-0.5">
                      <div className="font-semibold text-[var(--adm-text)] flex items-center gap-1">
                        <Clock size={10} className="text-[var(--adm-gold)]" />
                        {formatFullDateTime(timelineEv.timestamp)}
                      </div>
                      {timelineEv.actor && (
                        <div className="truncate text-emerald-200">Por: {timelineEv.actor}</div>
                      )}
                    </div>
                  ) : isCurrent ? (
                    <div className="text-[10px] text-emerald-300 font-medium">
                      Em andamento agora
                    </div>
                  ) : (
                    <div className="text-[10px] text-[var(--adm-text-dim)]">{stg.description}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          MAIN 3-COLUMN CONTENT GRID
          ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Items + Financial Breakdown + Audit Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* ──────────────────────────────────────────────────────────
              ORDER ITEMS & MULTI-ORIGIN FULFILLMENT
              ────────────────────────────────────────────────────────── */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--adm-border)]">
              <div>
                <h2 className="text-base font-bold text-[var(--adm-text)] flex items-center gap-2">
                  <Package size={18} className="text-[var(--adm-gold)]" />
                  Itens do Pedido ({order.items?.length || 0})
                </h2>
                <p className="text-xs text-[var(--adm-text-muted)]">
                  Separação física, conferência de estoque e canais de fornecimento.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canEditOrder && order.status !== 'cancelled' && (
                  <button
                    type="button"
                    onClick={() => setEditItemsModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-[var(--adm-brand-soft)] hover:bg-emerald-500/20 text-emerald-300 border border-[var(--adm-brand-border)] text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Edit size={13} />
                    Editar Itens / Adicionar Produto
                  </button>
                )}
                {fulfillmentPlan?.hasExternalPickupItems && (
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-sky-500/15 text-sky-200 border border-sky-500/30">
                    Contém Coleta Externa
                  </span>
                )}
              </div>
            </div>

            {/* Warning for multiple partner pickups */}
            {fulfillmentPlan?.hasMultiPartnerPickupWarning && (
              <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2.5">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <strong>Alerta Operacional de Múltiplas Coletas:</strong> Este pedido contém itens com
                  retirada em {fulfillmentPlan.externalPartnersCount} parceiros diferentes.
                  Verifique os roteiros ou envie as ordens de coleta abaixo.
                </div>
              </div>
            )}

            {/* Items Table */}
            <div className="divide-y divide-[var(--adm-border)]">
              {(order.items || []).map((item, idx) => {
                const resolved = fulfillmentPlan?.items[idx];
                const pid = item.id || `idx_${idx}`;
                const task = pickupTasks.find(
                  (t) => t.orderId === order.id && t.productId === pid,
                );
                const isExternalPickup =
                  resolved?.originChannel === 'parceiro_retirada_estabelecimento';
                const isConsigned =
                  resolved?.originChannel === 'parceiro_consignado_mercado';

                return (
                  <div key={`${item.id || idx}-${idx}`} className="py-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        {item.image ? (
                          <img
                            src={cleanImageUrl(item.image)}
                            onError={handleImageError}
                            alt={item.title}
                            className="w-12 h-12 rounded-lg object-cover bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-[var(--adm-bg-subtle)] border border-[var(--adm-border)] flex items-center justify-center text-[var(--adm-text-dim)] shrink-0">
                            <Package size={18} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {item.id ? (
                              <Link
                                to={`/admin/products/${item.id}`}
                                className="text-sm font-bold text-[var(--adm-text)] hover:text-[var(--adm-gold)] transition-colors truncate block"
                              >
                                {item.title}
                              </Link>
                            ) : (
                              <div className="text-sm font-bold text-[var(--adm-text)] truncate">
                                {item.title}
                              </div>
                            )}
                            {resolved && (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  isExternalPickup
                                    ? 'bg-sky-500/15 text-sky-200 border-sky-500/30'
                                    : isConsigned
                                    ? 'bg-amber-500/15 text-amber-200 border-amber-500/30'
                                    : 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'
                                }`}
                              >
                                {SUPPLY_ORIGIN_SHORT_LABELS[resolved.originChannel]}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[var(--adm-text-muted)] tabular-nums pt-0.5">
                            <span className="font-semibold text-[var(--adm-text)]">
                              {item.quantity}x
                            </span>{' '}
                            {formatCurrency(item.price)} cada
                            {isConsigned &&
                              ` • Separar da Custódia (${resolved?.partnerName || 'Parceiro'})`}
                            {isExternalPickup &&
                              ` • Coleta no Parceiro (${resolved?.partnerName || 'Parceiro'})`}
                          </div>
                        </div>
                      </div>

                      <div className="text-sm font-extrabold text-[var(--adm-text)] shrink-0 tabular-nums text-right">
                        <div>
                          {formatCurrency(Number(item.price || 0) * Number(item.quantity || 1))}
                        </div>
                        <div className="text-[10px] text-[var(--adm-text-dim)] font-normal">
                          {item.quantity} un.
                        </div>
                      </div>
                    </div>

                    {/* External Pickup Action Box */}
                    {isExternalPickup && resolved && (
                      <div className="ml-14 p-3 rounded-lg bg-[var(--adm-bg)] border border-sky-500/30 space-y-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sky-200 font-semibold">
                            Coleta no Parceiro: <strong>{resolved.partnerName}</strong> —{' '}
                            {resolved.pickupAddress} ({resolved.pickupInstructions})
                          </div>
                          <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-200 font-bold text-[10px]">
                            {COURIER_PICKUP_STATUS_LABELS[
                              task?.pickupStatus || 'aguardando_coleta'
                            ]}
                          </span>
                        </div>
                        {canEditOrder && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <input
                              type="text"
                              value={
                                courierInputByProd[pid] ?? task?.assignedCourierName ?? ''
                              }
                              onChange={(e) =>
                                setCourierInputByProd((prev) => ({
                                  ...prev,
                                  [pid]: e.target.value,
                                }))
                              }
                              placeholder="Nome do entregador p/ coleta..."
                              className="px-2.5 py-1 rounded bg-[var(--adm-surface)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)]"
                            />
                            {(
                              [
                                {
                                  status: 'aguardando_coleta' as CourierPickupStatus,
                                  label: 'Atribuir / Aguardar',
                                },
                                {
                                  status: 'coletado_no_parceiro' as CourierPickupStatus,
                                  label: 'Marcar Coletado',
                                },
                                {
                                  status: 'entregue_ao_cliente' as CourierPickupStatus,
                                  label: 'Marcar Entregue',
                                },
                              ] as const
                            ).map((act) => (
                              <button
                                key={act.status}
                                type="button"
                                onClick={async () => {
                                  const saved = await upsertOrderPickupTask(
                                    {
                                      orderId: order.id,
                                      orderNumber: order.orderNumber,
                                      productId: pid,
                                      productTitle: item.title,
                                      quantity: item.quantity,
                                      originChannel: resolved.originChannel,
                                      partnerId: resolved.partnerId,
                                      partnerName: resolved.partnerName,
                                      pickupAddress: resolved.pickupAddress,
                                      pickupInstructions: resolved.pickupInstructions,
                                      assignedCourierName:
                                        courierInputByProd[pid] ??
                                        task?.assignedCourierName ??
                                        null,
                                      pickupStatus: act.status,
                                    },
                                    {
                                      uid: user?.uid || 'staff',
                                      name: actorName,
                                    },
                                  );
                                  setPickupTasks((prev) => [
                                    saved,
                                    ...prev.filter((t) => t.id !== saved.id),
                                  ]);
                                  showToast(
                                    `Status de coleta atualizado: ${COURIER_PICKUP_STATUS_LABELS[act.status]}`,
                                    'ok',
                                  );
                                }}
                                className="px-2.5 py-1 rounded bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 border border-sky-500/30 font-bold text-[11px]"
                              >
                                {act.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Totals Breakdown */}
            <div className="pt-4 border-t border-[var(--adm-border)] space-y-2 text-xs">
              <div className="flex justify-between text-[var(--adm-text-muted)]">
                <span>Subtotal dos itens ({order.items?.length || 0})</span>
                <span className="font-semibold tabular-nums text-[var(--adm-text)]">
                  {formatCurrency(order.subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-[var(--adm-text-muted)]">
                <span>Taxa de Entrega ({order.deliveryMethod || 'Condomínio'})</span>
                <span className="font-semibold tabular-nums text-[var(--adm-text)]">
                  {Number(order.shippingFee) === 0 ? 'Grátis' : formatCurrency(order.shippingFee)}
                </span>
              </div>
              {Number(order.discountValue || 0) > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>
                    Desconto aplicado {order.couponCode ? `(Cupom: ${order.couponCode})` : ''}
                  </span>
                  <span className="font-bold tabular-nums">
                    - {formatCurrency(order.discountValue)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center text-base sm:text-lg font-extrabold text-[var(--adm-text)] pt-2.5 border-t border-[var(--adm-border)]">
                <span>Total Geral do Pedido</span>
                <span className="text-emerald-400 text-xl tabular-nums">
                  {formatCurrency(order.total)}
                </span>
              </div>
            </div>
          </div>

          {/* ──────────────────────────────────────────────────────────
              COMPLETE AUDIT TRAIL & DETAILED MODIFICATION TIMELINE
              ────────────────────────────────────────────────────────── */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--adm-border)]">
              <div>
                <h2 className="text-base font-bold text-[var(--adm-text)] flex items-center gap-2">
                  <Clock size={18} className="text-sky-300" />
                  Linha do Tempo & Histórico Completo de Modificações
                </h2>
                <p className="text-xs text-[var(--adm-text-muted)]">
                  Todos os horários, responsáveis e apontamentos registrados neste pedido.
                </p>
              </div>

              {canEditOrder && (
                <button
                  type="button"
                  onClick={() => setAddTimelineModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] border border-[var(--adm-border)] text-xs font-bold text-sky-200 inline-flex items-center gap-1.5 transition-colors"
                >
                  <Plus size={13} />
                  Adicionar Apontamento Manual
                </button>
              )}
            </div>

            {!order.timeline || order.timeline.length === 0 ? (
              <div className="p-4 rounded-lg bg-[var(--adm-bg-subtle)] text-xs text-[var(--adm-text-muted)] text-center">
                Sem eventos de auditoria registrados na timeline até o momento.
              </div>
            ) : (
              <div className="relative border-l-2 border-[var(--adm-border)] ml-3 pl-5 space-y-5 py-2">
                {order.timeline.map((ev, i) => (
                  <div key={i} className="relative group">
                    <span className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full bg-[var(--adm-brand)] border-2 border-[var(--adm-surface)] shadow-sm" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs sm:text-sm font-bold text-[var(--adm-text)]">
                        {ev.label}
                      </div>
                      <div className="text-[11px] font-mono text-[var(--adm-gold)] font-semibold flex items-center gap-1">
                        <Clock size={12} />
                        {formatFullDateTime(ev.timestamp)}
                      </div>
                    </div>
                    <div className="text-xs text-[var(--adm-text-muted)] flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="px-2 py-0.5 rounded bg-[var(--adm-surface-elevated)] text-[var(--adm-text)] font-semibold text-[10px] border border-[var(--adm-border)]">
                        Responsável: {ev.actor || 'Sistema'}
                      </span>
                      {ev.status && (
                        <span className="text-[10px] font-mono text-[var(--adm-text-dim)] uppercase">
                          [{ev.status}]
                        </span>
                      )}
                    </div>
                    {ev.details && (
                      <div className="mt-1.5 p-2.5 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs text-[var(--adm-text)] whitespace-pre-wrap leading-relaxed">
                        {ev.details}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ──────────────────────────────────────────────────────────
            RIGHT COLUMN: OPERATIONAL CONTROLS & DETAILS
            ────────────────────────────────────────────────────────── */}
        <div className="space-y-6">
          {/* Operational Control & Status Action Card */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl p-5 space-y-4 shadow-sm">
            <h2 className="text-base font-bold text-[var(--adm-text)] flex items-center gap-2">
              <CreditCard size={18} className="text-emerald-300" />
              Controle Operacional & Ações
            </h2>

            {/* Financial Reconciliation Box */}
            {order.status !== 'cancelled' && order.paymentStatus !== 'approved' && (
              <div className="p-4 rounded-lg bg-emerald-950/30 border border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-200">
                    Conciliação Pix / Pagamento
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase">
                    {order.paymentMethod || 'Pix'}
                  </span>
                </div>
                <input
                  type="text"
                  value={pixRef}
                  onChange={(e) => setPixRef(e.target.value)}
                  placeholder="ID E2E / Código de autorização Pix..."
                  className="adm-input w-full px-3 py-2 text-xs placeholder-[var(--adm-text-dim)]"
                />
                <button
                  type="button"
                  disabled={!canApprovePayment || actionLoading === `pay-${order.id}`}
                  onClick={() => handleConfirmPayment(order.id, pixRef.trim() || undefined)}
                  className="w-full py-2.5 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] disabled:opacity-50 text-emerald-950 font-extrabold text-xs inline-flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <CheckCircle2 size={16} />
                  Confirmar Recebimento Financeiro
                </button>
              </div>
            )}

            {/* Status Step Transitions */}
            {order.status !== 'cancelled' && canEditOrder && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-[var(--adm-text-muted)]">
                    Avançar Etapa Operacional
                  </label>
                  <span className="text-[10px] text-[var(--adm-text-dim)]">
                    Operador: {actorName}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="Observação da etapa (ex: Separado por João)"
                      className="adm-input w-full px-3 py-2 text-xs placeholder-[var(--adm-text-dim)]"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={statusActor}
                      onChange={(e) => setStatusActor(e.target.value)}
                      placeholder={actorName}
                      title="Responsável pela ação"
                      className="adm-input w-full px-2.5 py-2 text-xs placeholder-[var(--adm-text-dim)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={
                      !isPaidOrOnDelivery ||
                      order.status === 'confirmed' ||
                      actionLoading === `status-${order.id}`
                    }
                    onClick={() => handleDirectStatusChange('confirmed')}
                    className="px-3 py-2 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 disabled:opacity-40 text-sky-200 border border-sky-500/30 font-bold text-xs transition-colors"
                  >
                    1. Confirmar
                  </button>
                  <button
                    type="button"
                    disabled={
                      !isPaidOrOnDelivery ||
                      order.status === 'preparing' ||
                      actionLoading === `status-${order.id}`
                    }
                    onClick={() => handleDirectStatusChange('preparing')}
                    className="px-3 py-2 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 disabled:opacity-40 text-teal-200 border border-teal-500/30 font-bold text-xs transition-colors"
                  >
                    2. Em Preparo
                  </button>
                </div>

                <button
                  type="button"
                  disabled={
                    !isPaidOrOnDelivery ||
                    order.status === 'delivering' ||
                    actionLoading === `status-${order.id}`
                  }
                  onClick={() => handleDirectStatusChange('delivering')}
                  className="w-full py-2.5 rounded-lg bg-lime-500/15 hover:bg-lime-500/25 disabled:opacity-40 text-lime-200 border border-lime-500/30 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Truck size={14} />
                  3. Despachar / Saiu para Entrega
                </button>

                <button
                  type="button"
                  disabled={order.status === 'delivered' || actionLoading === `status-${order.id}`}
                  onClick={() => handleDirectStatusChange('delivered')}
                  className="w-full py-2.5 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] disabled:opacity-40 text-emerald-950 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <CheckCircle2 size={16} />
                  4. Marcar como Entregue ao Morador
                </button>

                {!isPaidOrOnDelivery && (
                  <p className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-lg p-2.5 leading-relaxed">
                    <strong>Regra Operacional:</strong> Confirme o recebimento Pix ou marque como
                    pagamento na entrega antes de avançar para separação.
                  </p>
                )}
              </div>
            )}

            {/* Cancel Button */}
            {order.status !== 'cancelled' && order.status !== 'delivered' && canEditOrder && (
              <div className="pt-3 border-t border-[var(--adm-border)]">
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(true)}
                  className="w-full py-2.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-500/30 font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <XCircle size={15} />
                  Cancelar Pedido e Estornar Estoque
                </button>
              </div>
            )}
          </div>

          {/* ──────────────────────────────────────────────────────────
              CUSTOMER & DELIVERY ADDRESS CARD
              ────────────────────────────────────────────────────────── */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--adm-border)]">
              <h2 className="text-sm font-bold text-[var(--adm-text)] flex items-center gap-2">
                <User size={16} className="text-emerald-300" />
                Dados do Morador
              </h2>
              {order.uid && (
                <Link
                  to={`/admin/customers/${order.uid}`}
                  className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1"
                >
                  Ficha 360°
                  <ExternalLink size={12} />
                </Link>
              )}
            </div>

            <div className="text-xs space-y-2">
              <div className="font-extrabold text-[var(--adm-text)] text-base">
                {order.userName || 'Cliente'}
              </div>
              {order.userPhone && (
                <div className="text-[var(--adm-text-muted)] flex items-center gap-2">
                  <span className="text-[var(--adm-text-dim)]">Telefone:</span>
                  <span className="font-semibold text-[var(--adm-text)]">{order.userPhone}</span>
                </div>
              )}
              {order.userEmail && (
                <div className="text-[var(--adm-text-muted)] flex items-center gap-2">
                  <span className="text-[var(--adm-text-dim)]">E-mail:</span>
                  <span className="text-[var(--adm-text)]">{order.userEmail}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[var(--adm-border)] space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--adm-text-muted)] flex items-center gap-1.5">
                  <MapPin size={14} className="text-[var(--adm-gold)]" />
                  Local de Entrega
                </h3>
                {canEditOrder && (
                  <button
                    type="button"
                    onClick={() => setEditAddressModalOpen(true)}
                    className="text-[11px] font-bold text-sky-300 hover:text-sky-200 inline-flex items-center gap-1"
                  >
                    <Edit size={12} />
                    Editar Endereço
                  </button>
                )}
              </div>

              {order.address ? (
                <div className="p-3 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] text-xs space-y-1.5 leading-relaxed">
                  {order.address.condominio && (
                    <div className="font-bold text-[var(--adm-gold)] text-sm">
                      {order.address.condominio}
                    </div>
                  )}
                  {(order.address.bloco || order.address.apartamento) && (
                    <div className="font-extrabold text-[var(--adm-text)]">
                      {order.address.bloco ? `Bloco ${order.address.bloco} ` : ''}
                      {order.address.apartamento ? `• Apto ${order.address.apartamento}` : ''}
                    </div>
                  )}
                  {order.address.street && (
                    <div className="text-[var(--adm-text-muted)]">
                      {order.address.street}, {order.address.number}{' '}
                      {order.address.complement ? `- ${order.address.complement}` : ''}
                    </div>
                  )}
                  {order.address.neighborhood && (
                    <div className="text-[var(--adm-text-dim)]">
                      {order.address.neighborhood} • {order.address.city}/{order.address.state}
                      {order.address.zipCode ? ` • CEP ${order.address.zipCode}` : ''}
                    </div>
                  )}
                  {order.address.referencia && (
                    <div className="text-[var(--adm-text-dim)] italic pt-1 border-t border-[var(--adm-border)]">
                      Ponto de Ref: {order.address.referencia}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-[var(--adm-text-muted)]">
                  Modalidade: {order.deliveryMethod || 'Entrega no condomínio'}
                </p>
              )}
            </div>

            {/* Courier Assignment */}
            <div className="pt-3 border-t border-[var(--adm-border)] space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--adm-text-muted)] flex items-center gap-1.5">
                <Truck size={14} className="text-lime-400" />
                Entregador Responsável
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={assignedCourier}
                  onChange={(e) => setAssignedCourier(e.target.value)}
                  placeholder="Nome do entregador (ex: Carlos / Moto 02)"
                  className="adm-input flex-1 px-3 py-1.5 text-xs placeholder-[var(--adm-text-dim)]"
                />
                <button
                  type="button"
                  disabled={savingCourier || !assignedCourier.trim()}
                  onClick={handleSaveCourier}
                  className="px-3 py-1.5 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] border border-[var(--adm-border)] text-xs font-bold text-[var(--adm-text)] disabled:opacity-40 transition-colors"
                >
                  {savingCourier ? 'Salvando...' : 'Atribuir'}
                </button>
              </div>
            </div>
          </div>

          {/* ──────────────────────────────────────────────────────────
              INTERNAL NOTES CARD (AUDITABLE)
              ────────────────────────────────────────────────────────── */}
          <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-xl p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--adm-border)]">
              <h2 className="text-sm font-bold text-[var(--adm-text)] flex items-center gap-2">
                <FileText size={16} className="text-[var(--adm-gold)]" />
                Notas Internas da Equipe
              </h2>
              <span className="text-[10px] text-[var(--adm-text-dim)]">Visível apenas no painel</span>
            </div>
            <textarea
              rows={4}
              value={adminNotesText}
              onChange={(e) => setAdminNotesText(e.target.value)}
              placeholder="Instruções da portaria, recados sobre trocas ou preferências do cliente..."
              className="adm-input w-full p-3 text-xs placeholder-[var(--adm-text-dim)] resize-none"
            />
            <button
              type="button"
              disabled={savingNotes}
              onClick={handleSaveInternalNotes}
              className="w-full py-2 rounded-lg bg-[var(--adm-surface-elevated)] hover:bg-[var(--adm-surface-hover)] border border-[var(--adm-border)] text-xs font-bold text-[var(--adm-text)] disabled:opacity-40 transition-colors"
            >
              {savingNotes ? 'Salvando Notas...' : 'Salvar Notas Internas'}
            </button>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
          MODAL: EDIT ORDER ITEMS & ADD PRODUCTS
          ────────────────────────────────────────────────────────── */}
      {editItemsModalOpen && (
        <EditItemsModal
          order={order}
          products={products}
          actorName={actorName}
          onClose={() => setEditItemsModalOpen(false)}
          onSuccess={() => {
            setEditItemsModalOpen(false);
            showToast('Itens do pedido e totais atualizados com sucesso!', 'ok');
          }}
        />
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: EDIT DELIVERY ADDRESS
          ────────────────────────────────────────────────────────── */}
      {editAddressModalOpen && (
        <EditAddressModal
          order={order}
          actorName={actorName}
          onClose={() => setEditAddressModalOpen(false)}
          onSuccess={() => {
            setEditAddressModalOpen(false);
            showToast('Endereço de entrega atualizado com sucesso!', 'ok');
          }}
        />
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: ADD MANUAL TIMELINE NOTE
          ────────────────────────────────────────────────────────── */}
      {addTimelineModalOpen && (
        <AddTimelineNoteModal
          order={order}
          actorName={actorName}
          onClose={() => setAddTimelineModalOpen(false)}
          onSuccess={() => {
            setAddTimelineModalOpen(false);
            showToast('Apontamento adicionado à linha do tempo!', 'ok');
          }}
        />
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: PRINT / PACKING SLIP
          ────────────────────────────────────────────────────────── */}
      {printModalOpen && (
        <PrintOrderModal order={order} onClose={() => setPrintModalOpen(false)} />
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: CANCEL ORDER WITH REASON
          ────────────────────────────────────────────────────────── */}
      <ReasonConfirmModal
        open={cancelModalOpen}
        title="Confirmar Cancelamento do Pedido"
        description="Informe o motivo detalhado do cancelamento. O estoque dos itens será estornado e registrado na auditoria."
        confirmLabel="Confirmar Cancelamento & Estorno"
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

// ──────────────────────────────────────────────────────────────
// SUBCOMPONENT: MODAL EDIT ITEMS & ADD PRODUCTS
// ──────────────────────────────────────────────────────────────
interface EditItemsModalProps {
  order: AdminOrder;
  products: Array<{ id: string; title: string; price: number; image?: string; category?: string }>;
  actorName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const EditItemsModal: React.FC<EditItemsModalProps> = ({
  order,
  products,
  actorName,
  onClose,
  onSuccess,
}) => {
  const [items, setItems] = useState<OrderItemSummary[]>(order.items || []);
  const [searchCatalog, setSearchCatalog] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredCatalog = useMemo(() => {
    if (!searchCatalog.trim()) return [];
    const term = searchCatalog.toLowerCase();
    return products
      .filter((p) => p.title.toLowerCase().includes(term) || (p.category || '').toLowerCase().includes(term))
      .slice(0, 6);
  }, [searchCatalog, products]);

  const updateQuantity = (idx: number, delta: number) => {
    setItems((prev) =>
      prev
        .map((it, i) => {
          if (i !== idx) return it;
          const nextQtd = Math.max(1, it.quantity + delta);
          return { ...it, quantity: nextQtd };
        })
        .filter(Boolean),
    );
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const addCatalogProduct = (prod: { id: string; title: string; price: number; image?: string }) => {
    setItems((prev) => {
      const existingIdx = prev.findIndex((it) => it.id === prod.id);
      if (existingIdx >= 0) {
        return prev.map((it, i) => (i === existingIdx ? { ...it, quantity: it.quantity + 1 } : it));
      }
      return [
        ...prev,
        {
          id: prod.id,
          title: prod.title,
          price: Number(prod.price || 0),
          quantity: 1,
          image: prod.image,
        },
      ];
    });
    setSearchCatalog('');
  };

  // Recalculate totals
  const subtotal = useMemo(
    () => items.reduce((acc, it) => acc + Number(it.price || 0) * Number(it.quantity || 1), 0),
    [items],
  );
  const shippingFee = Number(order.shippingFee || 0);
  const discountValue = Number(order.discountValue || 0);
  const newTotal = Math.max(0, subtotal + shippingFee - discountValue);

  const handleSave = async () => {
    if (items.length === 0) {
      setError('O pedido não pode ficar sem itens.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const orderRef = doc(db, 'orders', order.id);
      const existingTimeline = order.timeline || [];
      const newEvent: OrderTimelineEvent = {
        status: order.status,
        label: `Itens do pedido editados por ${actorName}`,
        timestamp: new Date().toISOString(),
        actor: actorName,
        details: `Novo subtotal: ${formatCurrency(subtotal)} • Total: ${formatCurrency(newTotal)} (${items.length} itens)`,
      };

      await updateDoc(orderRef, {
        items,
        subtotal,
        total: newTotal,
        timeline: [...existingTimeline, newEvent],
        updatedAt: serverTimestamp(),
      });
      onSuccess();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Falha ao salvar itens do pedido.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-[var(--adm-border)] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-[var(--adm-text)] flex items-center gap-2">
              <Package size={20} className="text-[var(--adm-gold)]" />
              Editar Itens do Pedido
            </h3>
            <p className="text-xs text-[var(--adm-text-muted)]">
              Adicione produtos, ajuste quantidades ou remova itens. O total será recalculado atomicamente.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--adm-text-muted)] hover:text-[var(--adm-text)] hover:bg-[var(--adm-surface-elevated)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 divide-y divide-[var(--adm-border)]">
          {/* Add product from catalog search */}
          <div className="space-y-2 pb-3">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--adm-text-muted)] flex items-center gap-1.5">
              <Search size={14} className="text-[var(--adm-brand)]" />
              Adicionar Produto do Catálogo ao Pedido
            </label>
            <input
              type="text"
              value={searchCatalog}
              onChange={(e) => setSearchCatalog(e.target.value)}
              placeholder="Digite o nome ou categoria do produto para buscar..."
              className="adm-input w-full px-3 py-2 text-xs placeholder-[var(--adm-text-dim)]"
            />

            {filteredCatalog.length > 0 && (
              <div className="p-2 rounded-lg bg-[var(--adm-bg)] border border-[var(--adm-border)] space-y-1">
                {filteredCatalog.map((prod) => (
                  <div
                    key={prod.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-[var(--adm-surface-elevated)] transition-colors text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-[var(--adm-text)] truncate">{prod.title}</div>
                      <div className="text-[11px] text-[var(--adm-gold)]">{formatCurrency(prod.price)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addCatalogProduct(prod)}
                      className="px-2.5 py-1 rounded bg-[var(--adm-brand)] text-emerald-950 font-extrabold text-[11px] shrink-0 inline-flex items-center gap-1"
                    >
                      <Plus size={12} />
                      Incluir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Current Items List */}
          <div className="space-y-3 pt-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--adm-text-muted)]">
              Itens Atuais ({items.length})
            </div>

            <div className="space-y-2">
              {items.map((it, idx) => (
                <div
                  key={`${it.id}-${idx}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[var(--adm-surface-elevated)] border border-[var(--adm-border)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-[var(--adm-text)] truncate">{it.title}</div>
                    <div className="text-[11px] text-[var(--adm-text-muted)]">
                      {formatCurrency(it.price)} unitário
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateQuantity(idx, -1)}
                      className="w-7 h-7 rounded bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)] font-extrabold flex items-center justify-center hover:bg-[var(--adm-surface-hover)]"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-[var(--adm-text)] tabular-nums">
                      {it.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(idx, 1)}
                      className="w-7 h-7 rounded bg-[var(--adm-bg)] border border-[var(--adm-border)] text-[var(--adm-text)] font-extrabold flex items-center justify-center hover:bg-[var(--adm-surface-hover)]"
                    >
                      +
                    </button>
                  </div>

                  <div className="w-20 text-right text-xs font-bold text-[var(--adm-text)] tabular-nums shrink-0">
                    {formatCurrency(Number(it.price || 0) * Number(it.quantity || 1))}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    title="Remover item"
                    className="p-1.5 rounded text-rose-400 hover:bg-rose-500/20 shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* New Totals Preview */}
          <div className="pt-3 space-y-1.5 text-xs">
            <div className="flex justify-between text-[var(--adm-text-muted)]">
              <span>Novo Subtotal:</span>
              <span className="font-bold text-[var(--adm-text)]">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-[var(--adm-text-muted)]">
              <span>Taxa de Entrega:</span>
              <span>{formatCurrency(shippingFee)}</span>
            </div>
            {discountValue > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Desconto:</span>
                <span>- {formatCurrency(discountValue)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-extrabold text-[var(--adm-text)] pt-2 border-t border-[var(--adm-border)]">
              <span>Novo Total Geral:</span>
              <span className="text-emerald-400 text-base">{formatCurrency(newTotal)}</span>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200">
              {error}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-[var(--adm-border)] flex items-center justify-end gap-3 bg-[var(--adm-bg-subtle)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-5 py-2.5 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-extrabold text-xs disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Alterações nos Itens'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// SUBCOMPONENT: MODAL EDIT DELIVERY ADDRESS
// ──────────────────────────────────────────────────────────────
interface EditAddressModalProps {
  order: AdminOrder;
  actorName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const EditAddressModal: React.FC<EditAddressModalProps> = ({
  order,
  actorName,
  onClose,
  onSuccess,
}) => {
  const currentAddr = order.address || {};
  const [condominio, setCondominio] = useState(currentAddr.condominio || '');
  const [bloco, setBloco] = useState(currentAddr.bloco || '');
  const [apartamento, setApartamento] = useState(currentAddr.apartamento || '');
  const [street, setStreet] = useState(currentAddr.street || '');
  const [number, setNumber] = useState(currentAddr.number || '');
  const [complement, setComplement] = useState(currentAddr.complement || '');
  const [neighborhood, setNeighborhood] = useState(currentAddr.neighborhood || '');
  const [city, setCity] = useState(currentAddr.city || '');
  const [referencia, setReferencia] = useState(currentAddr.referencia || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const orderRef = doc(db, 'orders', order.id);
      const existingTimeline = order.timeline || [];
      const updatedAddress = {
        ...currentAddr,
        condominio: condominio.trim() || undefined,
        bloco: bloco.trim() || undefined,
        apartamento: apartamento.trim() || undefined,
        street: street.trim() || undefined,
        number: number.trim() || undefined,
        complement: complement.trim() || undefined,
        neighborhood: neighborhood.trim() || undefined,
        city: city.trim() || undefined,
        referencia: referencia.trim() || undefined,
      };

      const newEvent: OrderTimelineEvent = {
        status: order.status,
        label: `Endereço de entrega alterado por ${actorName}`,
        timestamp: new Date().toISOString(),
        actor: actorName,
        details: `Condomínio: ${condominio || '—'} • Bloco: ${bloco || '—'} • Apto: ${apartamento || '—'}`,
      };

      await updateDoc(orderRef, {
        address: updatedAddress,
        timeline: [...existingTimeline, newEvent],
        updatedAt: serverTimestamp(),
      });
      onSuccess();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Erro ao salvar novo endereço.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-[var(--adm-border)] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-[var(--adm-text)] flex items-center gap-2">
              <MapPin size={20} className="text-[var(--adm-gold)]" />
              Editar Local de Entrega
            </h3>
            <p className="text-xs text-[var(--adm-text-muted)]">
              Ajuste condomínio, bloco, apartamento e pontos de referência do morador.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3.5 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-bold text-[var(--adm-text-muted)] mb-1">
              Nome do Condomínio
            </label>
            <input
              type="text"
              value={condominio}
              onChange={(e) => setCondominio(e.target.value)}
              placeholder="Ex: Condomínio Solar das Flores"
              className="adm-input w-full px-3 py-2 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[var(--adm-text-muted)] mb-1">
                Bloco / Torre
              </label>
              <input
                type="text"
                value={bloco}
                onChange={(e) => setBloco(e.target.value)}
                placeholder="Ex: Bloco B"
                className="adm-input w-full px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--adm-text-muted)] mb-1">
                Apartamento
              </label>
              <input
                type="text"
                value={apartamento}
                onChange={(e) => setApartamento(e.target.value)}
                placeholder="Ex: 402"
                className="adm-input w-full px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-[var(--adm-text-muted)] mb-1">
                Rua / Logradouro
              </label>
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className="adm-input w-full px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--adm-text-muted)] mb-1">
                Número
              </label>
              <input
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="adm-input w-full px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[var(--adm-text-muted)] mb-1">
                Complemento
              </label>
              <input
                type="text"
                value={complement}
                onChange={(e) => setComplement(e.target.value)}
                className="adm-input w-full px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--adm-text-muted)] mb-1">
                Bairro
              </label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                className="adm-input w-full px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--adm-text-muted)] mb-1">
                Cidade
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="adm-input w-full px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--adm-text-muted)] mb-1">
              Ponto de Referência / Instruções p/ Entrega
            </label>
            <input
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder="Ex: Deixar na portaria com o Seu José"
              className="adm-input w-full px-3 py-2 text-xs"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200">
              {error}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-[var(--adm-border)] flex items-center justify-end gap-3 bg-[var(--adm-bg-subtle)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold text-[var(--adm-text-muted)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-5 py-2.5 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-extrabold text-xs disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar Endereço'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// SUBCOMPONENT: MODAL ADD TIMELINE NOTE
// ──────────────────────────────────────────────────────────────
interface AddTimelineNoteModalProps {
  order: AdminOrder;
  actorName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const AddTimelineNoteModal: React.FC<AddTimelineNoteModalProps> = ({
  order,
  actorName,
  onClose,
  onSuccess,
}) => {
  const [noteTitle, setNoteTitle] = useState('Apontamento Operacional');
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!details.trim()) {
      setError('Informe a descrição do apontamento.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const orderRef = doc(db, 'orders', order.id);
      const existingTimeline = order.timeline || [];
      const newEvent: OrderTimelineEvent = {
        status: order.status,
        label: noteTitle.trim(),
        timestamp: new Date().toISOString(),
        actor: actorName,
        details: details.trim(),
      };

      await updateDoc(orderRef, {
        timeline: [...existingTimeline, newEvent],
        updatedAt: serverTimestamp(),
      });
      onSuccess();
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Erro ao registrar apontamento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-[var(--adm-border)] flex items-center justify-between">
          <h3 className="text-base font-extrabold text-[var(--adm-text)] flex items-center gap-2">
            <Clock size={18} className="text-sky-300" />
            Adicionar Registro na Linha do Tempo
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-[var(--adm-text-muted)] mb-1">
              Título do Registro
            </label>
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Ex: Contato telefônico com cliente"
              className="adm-input w-full px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--adm-text-muted)] mb-1">
              Detalhes / Descrição do Ocorrido
            </label>
            <textarea
              rows={4}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Descreva o que ocorreu, horários acordados ou avisos da portaria..."
              className="adm-input w-full p-3 text-xs resize-none"
            />
          </div>

          <div className="text-[11px] text-[var(--adm-text-dim)]">
            Registrado por: <strong>{actorName}</strong> com data e hora exata no momento do envio.
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200">
              {error}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-[var(--adm-border)] flex items-center justify-end gap-3 bg-[var(--adm-bg-subtle)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold text-[var(--adm-text-muted)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="px-5 py-2.5 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-extrabold text-xs disabled:opacity-50"
          >
            {saving ? 'Registrando...' : 'Gravar Apontamento'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// SUBCOMPONENT: PRINT / PACKING SLIP MODAL
// ──────────────────────────────────────────────────────────────
const PrintOrderModal: React.FC<{ order: AdminOrder; onClose: () => void }> = ({
  order,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white">
      <div className="bg-[var(--adm-surface)] border border-[var(--adm-border)] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden print:border-none print:shadow-none print:max-w-none print:max-h-none print:bg-white print:text-black">
        {/* Modal Controls (hidden on print) */}
        <div className="p-4 border-b border-[var(--adm-border)] flex items-center justify-between print:hidden">
          <div className="text-sm font-bold text-[var(--adm-text)] flex items-center gap-2">
            <Printer size={16} className="text-[var(--adm-gold)]" />
            Visualização de Romaneio de Separação & Entrega
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-lg bg-[var(--adm-brand)] hover:bg-[var(--adm-brand-hover)] text-emerald-950 font-extrabold text-xs inline-flex items-center gap-1.5"
            >
              <Printer size={14} />
              Imprimir Agora
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-[var(--adm-text-muted)] hover:text-[var(--adm-text)]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Sheet */}
        <div className="p-6 overflow-y-auto flex-1 font-mono text-xs space-y-4 print:p-2 print:overflow-visible text-slate-100 print:text-black">
          {/* Header */}
          <div className="border-b-2 border-dashed border-slate-600 pb-3 text-center space-y-1">
            <div className="text-base font-extrabold uppercase tracking-wider">
              MERCADO NOSSO JEITO
            </div>
            <div className="text-[11px]">Romaneio Operacional de Separação e Entrega</div>
            <div className="text-sm font-bold pt-1">
              PEDIDO #{order.orderNumber || order.id.slice(0, 8).toUpperCase()}
            </div>
            <div className="text-[10px]">
              Emitido em {formatFullDateTime(new Date())} • ID: {order.id}
            </div>
          </div>

          {/* Customer & Address */}
          <div className="border-b-2 border-dashed border-slate-600 pb-3 space-y-1 text-[11px]">
            <div>
              <strong>CLIENTE:</strong> {order.userName || 'Cliente'}
            </div>
            <div>
              <strong>CONTATO:</strong> {order.userPhone || '—'}
            </div>
            <div>
              <strong>CONDOMÍNIO:</strong> {order.address?.condominio || '—'}
            </div>
            <div>
              <strong>BLOCO / APTO:</strong> {order.address?.bloco ? `Bloco ${order.address.bloco} ` : ''}
              {order.address?.apartamento ? `• Apto ${order.address.apartamento}` : ''}
            </div>
            {order.address?.street && (
              <div>
                <strong>ENDEREÇO:</strong> {order.address.street}, {order.address.number}{' '}
                {order.address.complement ? `- ${order.address.complement}` : ''}
              </div>
            )}
            {order.address?.referencia && (
              <div>
                <strong>REF:</strong> {order.address.referencia}
              </div>
            )}
          </div>

          {/* Items Separation Check-list */}
          <div className="border-b-2 border-dashed border-slate-600 pb-3 space-y-2">
            <div className="font-bold uppercase tracking-wider text-[11px]">
              ITENS A SEPARAR ({order.items?.length || 0}):
            </div>
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="py-1 w-6">[ ]</th>
                  <th className="py-1">QTD</th>
                  <th className="py-1">PRODUTO</th>
                  <th className="py-1 text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(order.items || []).map((it, idx) => (
                  <tr key={idx} className="py-1">
                    <td className="py-1.5">[ ]</td>
                    <td className="py-1.5 font-bold">{it.quantity}x</td>
                    <td className="py-1.5">{it.title}</td>
                    <td className="py-1.5 text-right font-bold">
                      {formatCurrency(Number(it.price || 0) * Number(it.quantity || 1))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Payment */}
          <div className="space-y-1 text-right text-[11px] pt-1">
            <div>Subtotal: {formatCurrency(order.subtotal)}</div>
            <div>Taxa de Entrega: {formatCurrency(order.shippingFee)}</div>
            {Number(order.discountValue || 0) > 0 && (
              <div>Desconto: - {formatCurrency(order.discountValue)}</div>
            )}
            <div className="text-sm font-extrabold pt-1">TOTAL: {formatCurrency(order.total)}</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase pt-1">
              PAGAMENTO: {order.paymentMethod || 'Pix'} ({order.paymentStatus})
            </div>
          </div>

          {/* Signatures */}
          <div className="pt-6 border-t-2 border-dashed border-slate-600 text-center space-y-6 text-[10px]">
            <div className="space-y-1">
              <div className="w-48 mx-auto border-b border-slate-500" />
              <div>Assinatura do Recebedor / Portaria</div>
            </div>
            <div>Obrigado por comprar no Mercado Nosso Jeito!</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOrderDetailPage;
