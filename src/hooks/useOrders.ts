import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

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

export interface CreateOrderPayload {
  uid: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  coupon?: string;
  paymentMethod?: string;
  notes?: string;
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
function toDate(ts: unknown): Date {
  if (!ts) return new Date();
  if (ts instanceof Date) return ts;
  if (ts instanceof Timestamp) return ts.toDate();
  return new Date();
}

function rawToOrder(id: string, data: Record<string, unknown>): Order {
  const rawItems = (data.items as OrderItem[] | undefined) ?? [];
  const rawTimeline = (data.timeline as Array<{ status: OrderStatus; label: string; timestamp: unknown; actor?: string }> | undefined) ?? [];

  return {
    id,
    uid: String(data.uid ?? ''),
    orderNumber: String(data.orderNumber ?? id),
    status: (data.status as OrderStatus) ?? 'pending',
    items: rawItems,
    subtotal: Number(data.subtotal ?? 0),
    discount: Number(data.discount ?? 0),
    deliveryFee: Number(data.deliveryFee ?? 0),
    total: Number(data.total ?? 0),
    coupon: data.coupon ? String(data.coupon) : undefined,
    paymentMethod: String(data.paymentMethod ?? 'Não informado'),
    notes: data.notes ? String(data.notes) : undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    timeline: rawTimeline.map((t) => ({
      status: t.status,
      label: t.label,
      timestamp: t.timestamp ? toDate(t.timestamp) : null,
      actor: t.actor,
    })),
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
// createOrder — write to Firestore from Cart checkout
// ──────────────────────────────────────────────────────────────
export async function createOrder(payload: CreateOrderPayload): Promise<string> {
  const orderNumber = `#MJ-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = serverTimestamp();
  // NOTE: serverTimestamp() is NOT allowed inside arrays in Firestore.
  // Use Timestamp.now() (client-side timestamp) for timeline events inside arrays.
  const timelineNow = Timestamp.now();

  const timeline = {
    status: 'pending' as OrderStatus,
    label: TIMELINE_LABELS.pending,
    timestamp: timelineNow,   // ← Timestamp.now(), not serverTimestamp()
    actor: 'Sistema',
  };

  await addDoc(collection(db, 'orders'), {
    uid: payload.uid,
    orderNumber,
    status: 'pending' as OrderStatus,
    items: payload.items,
    subtotal: payload.subtotal,
    discount: payload.discount,
    deliveryFee: payload.deliveryFee,
    total: payload.total,
    coupon: payload.coupon ?? null,
    paymentMethod: payload.paymentMethod ?? 'Não informado',
    notes: payload.notes ?? null,
    createdAt: now,           // serverTimestamp() OK at top-level fields
    updatedAt: now,
    timeline: [timeline],     // Timestamp.now() inside array
  });

  return orderNumber;
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
