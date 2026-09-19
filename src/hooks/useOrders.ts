import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, fns } from '../firebase';


// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'delivering'
  | 'delivered'
  | 'cancelled';

export interface OrderItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
  image: string;
}

export interface TimelineEvent {
  status: OrderStatus;
  label: string;
  timestamp: Date | null;
  actor?: string;
}

export interface OrderAddress {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface Order {
  id: string;                  // Firestore doc ID
  uid: string;                 // Firebase Auth UID
  orderNumber: string;         // "#MJ-XXXX"
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  coupon?: string;
  paymentMethod: string;
  paymentStatus?: 'pending' | 'approved' | 'rejected';
  paymentDetails?: any;
  deliveryMethod?: string;
  address?: OrderAddress;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  timeline: TimelineEvent[];
}

export interface OrderMetrics {
  total: number;                // total de pedidos
  active: number;               // pendentes + preparo + entrega
  delivered: number;            // entregues
  cancelled: number;            // cancelados
  totalSpent: number;           // soma de totais (pedidos não cancelados)
  avgTicket: number;            // ticket médio
  lastOrderAt: Date | null;
}

export interface CreateOrderRequest {
  /** Only product IDs and quantities — prices are authoritative on the backend */
  productItems: Array<{ productId: string; quantity: number }>;
  /** Firestore document ID from users/{uid}/addresses/{addressId} */
  addressId: string;
  deliveryMethod: 'apartment' | 'lobby';
  paymentMethod: 'pix' | 'credit_card' | 'on_delivery';
  couponCode?: string;
  /** Client-generated UUID; prevents duplicate order submissions */
  idempotencyKey: string;
  notes?: string;
}

export interface CreateOrderResult {
  orderId: string;
  orderNumber: string;
  total: number;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  couponApplied: boolean;
  status: 'pending';
}


// ──────────────────────────────────────────────────────────────
// Status helpers
// ──────────────────────────────────────────────────────────────
export const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; border: string }> = {
  pending:    { label: 'Pendente',          color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)' },
  confirmed:  { label: 'Confirmado',        color: '#3B82F6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)' },
  preparing:  { label: 'Em preparo',        color: '#F97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)' },
  delivering: { label: 'Saiu p/ entrega',  color: '#8B5CF6', bg: 'rgba(139,92,246,0.1)',  border: 'rgba(139,92,246,0.3)' },
  delivered:  { label: 'Entregue',          color: '#10B981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)' },
  cancelled:  { label: 'Cancelado',         color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
};

export const TIMELINE_STEPS: OrderStatus[] = [
  'pending', 'confirmed', 'preparing', 'delivering', 'delivered',
];

const TIMELINE_LABELS: Record<OrderStatus, string> = {
  pending:    'Pedido criado',
  confirmed:  'Pedido confirmado',
  preparing:  'Em preparo',
  delivering: 'Saiu para entrega',
  delivered:  'Pedido entregue',
  cancelled:  'Pedido cancelado',
};

const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'delivering'];

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
function toDate(ts: any): Date {
  if (!ts) return new Date();
  if (ts instanceof Date) return ts;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
  if (typeof ts === 'string' || typeof ts === 'number') {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  return new Date();
}

function rawToOrder(id: string, data: Record<string, unknown>): Order {
  const rawItems = (data.items as OrderItem[] | undefined) ?? [];
  const rawTimeline = (data.timeline as Array<{ status: OrderStatus; label: string; timestamp: unknown; actor?: string }> | undefined) ?? [];

  let statusStr = String(data.status ?? 'pending');
  let status: OrderStatus = 'pending';
  
  if (statusStr === 'Pendente' || statusStr === 'pending') status = 'pending';
  else if (statusStr === 'Aprovado' || statusStr === 'confirmed') status = 'confirmed';
  else if (statusStr === 'Em preparo' || statusStr === 'preparing') status = 'preparing';
  else if (statusStr === 'Saiu para Entrega' || statusStr === 'delivering') status = 'delivering';
  else if (statusStr === 'Entregue' || statusStr === 'delivered') status = 'delivered';
  else if (statusStr === 'Cancelado' || statusStr === 'cancelled') status = 'cancelled';

  return {
    id,
    uid: String(data.uid ?? ''),
    orderNumber: String(data.orderNumber ?? id),
    status,
    items: rawItems,
    subtotal: Number(data.subtotal ?? 0),
    discount: Number(data.discount ?? 0),
    deliveryFee: Number(data.deliveryFee ?? 0),
    total: Number(data.total ?? 0),
    coupon: data.coupon ? String(data.coupon) : undefined,
    paymentMethod: String(data.paymentMethod ?? 'Não informado'),
    paymentStatus: (data.paymentStatus as Order['paymentStatus']) ?? undefined,
    paymentDetails: data.paymentDetails as Record<string, unknown> | undefined,
    deliveryMethod: data.deliveryMethod ? String(data.deliveryMethod) : undefined,
    address: data.address as OrderAddress | undefined,
    notes: data.notes ? String(data.notes) : undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    timeline: rawTimeline.map((t) => {
      let tStatusStr = String(t.status ?? 'pending');
      let tStatus: OrderStatus = 'pending';
      if (tStatusStr === 'Pendente' || tStatusStr === 'pending') tStatus = 'pending';
      else if (tStatusStr === 'Aprovado' || tStatusStr === 'confirmed') tStatus = 'confirmed';
      else if (tStatusStr === 'Em preparo' || tStatusStr === 'preparing') tStatus = 'preparing';
      else if (tStatusStr === 'Saiu para Entrega' || tStatusStr === 'delivering') tStatus = 'delivering';
      else if (tStatusStr === 'Entregue' || tStatusStr === 'delivered') tStatus = 'delivered';
      else if (tStatusStr === 'Cancelado' || tStatusStr === 'cancelled') tStatus = 'cancelled';
      return {
        status: tStatus,
        label: t.label,
        timestamp: t.timestamp ? toDate(t.timestamp) : null,
        actor: t.actor,
      };
    }),
  };
}

// ──────────────────────────────────────────────────────────────
// useOrders — real-time subscription
// ──────────────────────────────────────────────────────────────
export function useOrders(uid: string | null) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Simple single-field query — no composite index needed.
    // We sort client-side to avoid requiring a Firestore composite index
    // on (uid ASC, createdAt DESC) which would need manual creation.
    const q = query(
      collection(db, 'orders'),
      where('uid', '==', uid),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: Order[] = snap.docs
          .map((d) => rawToOrder(d.id, d.data() as Record<string, unknown>))
          // Sort by createdAt desc (most recent first) on the client
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setOrders(list);
        setLoading(false);
      },
      (err) => {
        console.error('useOrders snapshot error:', err);
        setError('Não foi possível carregar os pedidos.');
        setLoading(false);
      },
    );

    return () => unsub();
  }, [uid]);

  // Derived metrics
  const metrics = useMemo<OrderMetrics>(() => {
    const nonCancelled = orders.filter((o) => o.status !== 'cancelled');
    const totalSpent = nonCancelled.reduce((s, o) => s + o.total, 0);
    return {
      total: orders.length,
      active: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
      delivered: orders.filter((o) => o.status === 'delivered').length,
      cancelled: orders.filter((o) => o.status === 'cancelled').length,
      totalSpent,
      avgTicket: nonCancelled.length > 0 ? totalSpent / nonCancelled.length : 0,
      lastOrderAt: orders.length > 0 ? orders[0].createdAt : null,
    };
  }, [orders]);

  return { orders, metrics, loading, error };
}

// ──────────────────────────────────────────────────────────────
// createOrderViaFunction — calls the backend Callable Cloud Function
// The client sends ONLY identifiers (product IDs, address ID) and options.
// All price/stock/coupon/shipping computation happens on the server.
// ──────────────────────────────────────────────────────────────
export async function createOrderViaFunction(
  payload: CreateOrderRequest
): Promise<CreateOrderResult> {
  const callFn = httpsCallable<CreateOrderRequest, CreateOrderResult>(fns, 'createOrder');
  const result = await callFn(payload);
  return result.data;
}


// ──────────────────────────────────────────────────────────────
// updateOrderStatus — for admin / future use
// ──────────────────────────────────────────────────────────────
export async function updateOrderStatus(orderId: string, newStatus: OrderStatus): Promise<void> {
  const label = TIMELINE_LABELS[newStatus];
  const now = serverTimestamp();

  const orderRef = doc(db, 'orders', orderId);
  const snap = await getDoc(orderRef);
  if (!snap.exists()) throw new Error('Pedido não encontrado');

  const existing = (snap.data().timeline as TimelineEvent[]) ?? [];
  const newEvent = { status: newStatus, label, timestamp: now, actor: 'Sistema' };

  await updateDoc(orderRef, {
    status: newStatus,
    updatedAt: now,
    timeline: [...existing, newEvent],
  });
}

// ──────────────────────────────────────────────────────────────
// cancelOrder — for user/admin to cancel order and refund stock
// ──────────────────────────────────────────────────────────────
export async function cancelOrder(orderId: string): Promise<void> {
  const now = serverTimestamp();
  const orderRef = doc(db, 'orders', orderId);

  await runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) {
      throw new Error('Pedido não encontrado');
    }

    const orderData = orderSnap.data();
    if (orderData.status === 'cancelled') {
      throw new Error('Este pedido já foi cancelado.');
    }

    // Security: prevent cancellation of delivered orders — stock was already consumed.
    if (orderData.status === 'delivered') {
      throw new Error('Não é possível cancelar um pedido já entregue. Entre em contato com o suporte.');
    }

    // Process stock refund
    const items = (orderData.items ?? []) as OrderItem[];
    const productRefs = items.map((item: OrderItem) => ({
      ref: doc(db, 'products', item.id),
      item,
    }));

    const productDocs = await Promise.all(
      productRefs.map((p) => transaction.get(p.ref))
    );

    const updates: Array<{ ref: ReturnType<typeof doc>; newStock: number }> = [];
    
    for (let i = 0; i < productDocs.length; i++) {
      const pDoc = productDocs[i];
      const { item, ref } = productRefs[i];
      
      if (pDoc.exists()) {
        const data = pDoc.data();
        if (data['stock'] !== undefined && data['stock'] !== null) {
          const newStock = Number(data['stock']) + item.quantity;
          updates.push({ ref, newStock });
        }
      }
    }

    // Apply stock updates
    for (const update of updates) {
      transaction.update(update.ref, {
        stock: update.newStock
      });
    }

    // Update order status
    const existingTimeline = orderData.timeline || [];
    const newEvent = { 
      status: 'cancelled', 
      label: TIMELINE_LABELS['cancelled'], 
      timestamp: Timestamp.now(), 
      actor: 'Sistema' 
    };

    transaction.update(orderRef, {
      status: 'cancelled',
      updatedAt: now,
      timeline: [...existingTimeline, newEvent],
    });
  });
}

// ──────────────────────────────────────────────────────────────
// Utility: relative time (e.g., "há 2 horas")
// ──────────────────────────────────────────────────────────────
export function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora mesmo';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  return date.toLocaleDateString('pt-BR');
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
