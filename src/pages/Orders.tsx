import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag, Clock, Truck, CheckCircle2, XCircle, ChefHat,
  Search, SlidersHorizontal, X, ChevronDown, ChevronUp,
  Package, TrendingUp, Star, ReceiptText, ArrowLeft,
  AlertCircle, CircleDot,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { MercadoLogo, AuthBackground, AuthStyles } from './Login';
import {
  useOrders,
  STATUS_CONFIG,
  TIMELINE_STEPS,
  relativeTime,
  formatCurrency,
  type OrderStatus,
  type Order,
} from '../hooks/useOrders';

// ──────────────────────────────────────────────────────────────
// Design tokens — same as Profile.tsx
// ──────────────────────────────────────────────────────────────
const card = {
  background: 'rgba(9,7,5,0.58)',
  backdropFilter: 'blur(28px)',
  WebkitBackdropFilter: 'blur(28px)',
  border: '1px solid rgba(212,175,55,0.18)',
  borderRadius: '18px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
};

// ──────────────────────────────────────────────────────────────
// Status icon mapping
// ──────────────────────────────────────────────────────────────
const STATUS_ICONS: Record<OrderStatus, React.ReactNode> = {
  pending:    <Clock size={11} />,
  confirmed:  <CheckCircle2 size={11} />,
  preparing:  <ChefHat size={11} />,
  delivering: <Truck size={11} />,
  delivered:  <CheckCircle2 size={11} />,
  cancelled:  <XCircle size={11} />,
};

const PULSE_STATUSES: OrderStatus[] = ['pending', 'preparing', 'delivering'];

// ──────────────────────────────────────────────────────────────
// StatusBadge
// ──────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status];
  const pulse = PULSE_STATUSES.includes(status);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: 99, padding: '4px 10px',
      fontSize: 10.5, fontWeight: 800, color: cfg.color,
      whiteSpace: 'nowrap', letterSpacing: '0.2px',
    }}>
      {pulse && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: cfg.color,
          animation: 'ordPulse 1.8s ease-in-out infinite',
          flexShrink: 0,
        }} />
      )}
      {STATUS_ICONS[status]}
      {cfg.label}
    </span>
  );
};

// ──────────────────────────────────────────────────────────────
// Metric Card (same card token as Profile)
// ──────────────────────────────────────────────────────────────
const MetricCard: React.FC<{
  icon: React.ReactNode; iconColor: string; iconBg: string;
  label: string; value: string; sub?: string;
}> = ({ icon, iconColor, iconBg, label, value, sub }) => (
  <div style={{ ...card, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
    <div style={{
      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
      background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: iconColor,
    }}>
      {icon}
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'rgba(212,175,55,0.6)', fontWeight: 700, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{sub}</div>}
    </div>
  </div>
);

// ──────────────────────────────────────────────────────────────
// Skeleton
// ──────────────────────────────────────────────────────────────
const SkeletonCard: React.FC = () => (
  <div style={{ ...card, padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <div style={{ width: 80, height: 13, borderRadius: 8, background: 'rgba(212,175,55,0.1)', animation: 'ordShimmer 1.4s ease-in-out infinite' }} />
      <div style={{ width: 110, height: 22, borderRadius: 99, background: 'rgba(212,175,55,0.08)', animation: 'ordShimmer 1.4s ease-in-out infinite 0.1s' }} />
    </div>
    <div style={{ display: 'flex', gap: 8 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.06)', animation: `ordShimmer 1.4s ease-in-out infinite ${i * 0.12}s` }} />
      ))}
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <div style={{ width: 70, height: 12, borderRadius: 6, background: 'rgba(255,255,255,0.05)' }} />
      <div style={{ width: 80, height: 12, borderRadius: 6, background: 'rgba(212,175,55,0.08)' }} />
    </div>
  </div>
);

// ──────────────────────────────────────────────────────────────
// Timeline
// ──────────────────────────────────────────────────────────────
const Timeline: React.FC<{ order: Order }> = ({ order }) => {
  if (order.status === 'cancelled') {
    const ev = order.timeline.find((t) => t.status === 'cancelled');
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <XCircle size={13} color="#EF4444" />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#EF4444' }}>Pedido cancelado</div>
          {ev?.timestamp && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{relativeTime(ev.timestamp)}</div>}
        </div>
      </div>
    );
  }

  const currentIdx = TIMELINE_STEPS.indexOf(order.status);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {TIMELINE_STEPS.map((step, i) => {
        const done = i <= currentIdx;
        const active = i === currentIdx;
        const cfg = STATUS_CONFIG[step];
        const ev = order.timeline.find((t) => t.status === step);
        const isLast = i === TIMELINE_STEPS.length - 1;
        return (
          <div key={step} style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 22, flexShrink: 0 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: done ? cfg.bg : 'rgba(255,255,255,0.03)',
                border: `1.5px solid ${done ? cfg.border : 'rgba(255,255,255,0.08)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: done ? cfg.color : 'rgba(255,255,255,0.15)',
                boxShadow: active ? `0 0 8px ${cfg.color}44` : 'none',
              }}>
                {done ? <span style={{ fontSize: 7.5 }}>{STATUS_ICONS[step]}</span> : <CircleDot size={7} />}
              </div>
              {!isLast && (
                <div style={{
                  width: 1.5, flex: 1, minHeight: 16,
                  background: done ? `${cfg.color}50` : 'rgba(255,255,255,0.05)',
                  margin: '2px 0',
                }} />
              )}
            </div>
            <div style={{ paddingBottom: isLast ? 0 : 12, flex: 1 }}>
              <div style={{ fontSize: 11.5, fontWeight: done ? 700 : 500, color: done ? cfg.color : 'rgba(255,255,255,0.2)', lineHeight: 1.2 }}>
                {cfg.label}
              </div>
              {ev?.timestamp && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                  {ev.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {relativeTime(ev.timestamp)}
                </div>
              )}
              {active && !ev?.timestamp && (
                <div style={{ fontSize: 10, color: cfg.color, marginTop: 1, fontWeight: 700 }}>Em andamento...</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// Order Card
// ──────────────────────────────────────────────────────────────
const OrderCard: React.FC<{ order: Order; highlight: boolean }> = ({ order, highlight }) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[order.status];
  const visible = order.items.slice(0, 3);
  const extra = order.items.length - 3;

  return (
    <div style={{
      ...card,
      border: `1px solid ${highlight ? 'rgba(212,175,55,0.4)' : 'rgba(212,175,55,0.18)'}`,
      overflow: 'hidden',
      transition: 'border-color 0.3s ease',
    }}>
      {/* ── Header row (always visible) ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '16px 16px 14px' }}
      >
        {/* Order number + status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#D4AF37', letterSpacing: '0.3px' }}>{order.orderNumber}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
              {order.createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
              {' · '}{relativeTime(order.createdAt)}
            </div>
          </div>
          <StatusBadge status={order.status} />
        </div>

        {/* Product image stack */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ display: 'flex' }}>
            {visible.map((item, i) => (
              <div key={item.id} style={{
                width: 40, height: 40, borderRadius: 10,
                background: '#fff',
                border: '2px solid rgba(212,175,55,0.15)',
                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginLeft: i > 0 ? -10 : 0,
                zIndex: visible.length - i, flexShrink: 0,
                position: 'relative',
              }}>
                {item.image ? (
                  <img src={item.image} alt={item.title} style={{ width: '82%', height: '82%', objectFit: 'contain' }} />
                ) : <Package size={14} color="#090705" />}
              </div>
            ))}
            {extra > 0 && (
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'rgba(212,175,55,0.08)', border: '1.5px solid rgba(212,175,55,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginLeft: -10, zIndex: 0, flexShrink: 0, position: 'relative',
                fontSize: 10, fontWeight: 800, color: '#D4AF37',
              }}>+{extra}</div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {order.items.map((i) => i.title.split(' ').slice(0, 2).join(' ')).join(', ')}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
              {order.paymentMethod}
            </div>
          </div>
        </div>

        {/* Footer row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
            {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>{formatCurrency(order.total)}</span>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: expanded ? cfg.bg : 'rgba(255,255,255,0.05)',
              border: `1px solid ${expanded ? cfg.border : 'rgba(255,255,255,0.08)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: expanded ? cfg.color : 'rgba(255,255,255,0.35)',
            }}>
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </div>
          </div>
        </div>
      </button>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(212,175,55,0.1)', padding: '14px 16px 16px' }}>

          {/* Items list */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: 'rgba(212,175,55,0.6)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>
              Itens do pedido
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {order.items.map((item) => (
                <div key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {item.image ? <img src={item.image} alt={item.title} style={{ width: '82%', height: '82%', objectFit: 'contain' }} /> : <Package size={13} color="#090705" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{item.quantity}x · {formatCurrency(item.price)}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#FFDF73', flexShrink: 0 }}>{formatCurrency(item.price * item.quantity)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial summary */}
          <div style={{ background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.1)', borderRadius: 12, padding: '11px 13px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: 'rgba(212,175,55,0.5)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 2 }}>Resumo</div>
            <SumRow label="Subtotal" value={formatCurrency(order.subtotal)} />
            {order.discount > 0 && <SumRow label={`Desconto${order.coupon ? ` (${order.coupon})` : ''}`} value={`-${formatCurrency(order.discount)}`} color="#10B981" />}
            <SumRow label="Entrega" value={order.deliveryFee === 0 ? 'Grátis' : formatCurrency(order.deliveryFee)} color={order.deliveryFee === 0 ? '#10B981' : undefined} />
            <div style={{ borderTop: '1px dashed rgba(212,175,55,0.15)', paddingTop: 8, marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>Total</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: '#FFDF73' }}>{formatCurrency(order.total)}</span>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: 'rgba(212,175,55,0.6)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>
              Histórico
            </div>
            <Timeline order={order} />
          </div>
        </div>
      )}
    </div>
  );
};

const SumRow: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
    <span style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
    <span style={{ color: color ?? 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{value}</span>
  </div>
);

// ──────────────────────────────────────────────────────────────
// Filter chip
// ──────────────────────────────────────────────────────────────
const FilterChip: React.FC<{ status: OrderStatus; active: boolean; count: number; onClick: () => void }> = ({ status, active, count, onClick }) => {
  const cfg = STATUS_CONFIG[status];
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
      background: active ? cfg.bg : 'rgba(255,255,255,0.04)',
      border: `1px solid ${active ? cfg.border : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 99, padding: '5px 11px',
      fontSize: 10.5, fontWeight: 700,
      color: active ? cfg.color : 'rgba(255,255,255,0.4)',
      cursor: 'pointer', transition: 'all 0.15s ease',
    }}>
      {cfg.label}
      <span style={{
        background: active ? cfg.color : 'rgba(255,255,255,0.08)',
        color: active ? '#090705' : 'rgba(255,255,255,0.35)',
        borderRadius: 99, padding: '0 5px', fontSize: 9, fontWeight: 900,
        lineHeight: '15px', display: 'inline-block',
      }}>{count}</span>
    </button>
  );
};

// ──────────────────────────────────────────────────────────────
// Empty State
// ──────────────────────────────────────────────────────────────
const EmptyState: React.FC<{ filtered: boolean; onClear: () => void }> = ({ filtered, onClear }) => {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', textAlign: 'center', gap: 16 }}>
      <div style={{
        width: 64, height: 64, borderRadius: 18,
        background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ShoppingBag size={26} color="rgba(212,175,55,0.4)" />
      </div>
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 900, color: '#fff', margin: 0 }}>
          {filtered ? 'Nenhum resultado' : 'Nenhum pedido ainda'}
        </h3>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '6px 0 0', maxWidth: 220, lineHeight: 1.5 }}>
          {filtered ? 'Tente remover os filtros.' : 'Faça seu primeiro pedido e ele aparecerá aqui.'}
        </p>
      </div>
      {filtered ? (
        <button onClick={onClear} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 700, padding: '8px 16px', cursor: 'pointer' }}>
          <X size={13} /> Limpar filtros
        </button>
      ) : (
        <button
          onClick={() => navigate('/')}
          style={{ background: 'linear-gradient(135deg, #D4AF37, #FFDF73)', border: 'none', borderRadius: 12, color: '#090705', fontSize: 12, fontWeight: 900, padding: '10px 22px', cursor: 'pointer', boxShadow: '0 4px 16px rgba(212,175,55,0.3)' }}
        >
          Explorar produtos 🛍️
        </button>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// Main — Orders Page
// ──────────────────────────────────────────────────────────────
export const Orders: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orders, metrics, loading, error } = useOrders(user?.uid ?? null);

  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<OrderStatus[]>([]);
  const [sort, setSort] = useState<'recent' | 'oldest' | 'highest'>('recent');
  const [showFilters, setShowFilters] = useState(false);

  // Highlight orders placed in the last 5 min
  const highlightIds = useMemo(() => {
    const cut = Date.now() - 5 * 60 * 1000;
    return new Set(orders.filter((o) => o.createdAt.getTime() > cut).map((o) => o.id));
  }, [orders]);

  // Status counts for chips
  const counts = useMemo(() => {
    const m: Partial<Record<OrderStatus, number>> = {};
    orders.forEach((o) => { m[o.status] = (m[o.status] ?? 0) + 1; });
    return m;
  }, [orders]);

  // Filtered + sorted list
  const filtered = useMemo(() => {
    let list = [...orders];
    if (activeFilters.length > 0) list = list.filter((o) => activeFilters.includes(o.status));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.items.some((i) => i.title.toLowerCase().includes(q))
      );
    }
    if (sort === 'oldest') list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    else if (sort === 'highest') list.sort((a, b) => b.total - a.total);
    return list;
  }, [orders, activeFilters, search, sort]);

  const toggle = (s: OrderStatus) =>
    setActiveFilters((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);
  const clearFilters = () => { setSearch(''); setActiveFilters([]); };
  const hasFilters = !!search.trim() || activeFilters.length > 0;

  return (
    <div style={{ position: 'relative', minHeight: '100vh', fontFamily: "'Manrope','Outfit',sans-serif" }}>
      {/* Supermarket background — same as Profile/Login */}
      <AuthBackground />
      <AuthStyles />

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', paddingBottom: '110px' }}>

        {/* ── Topbar — same pattern as Profile ──────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 16px 12px',
          borderBottom: '1px solid rgba(212,175,55,0.1)',
          background: 'rgba(9,7,5,0.4)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '50%', width: 38, height: 38,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(255,255,255,0.8)', flexShrink: 0,
            }}
          >
            <ArrowLeft size={17} />
          </button>

          <MercadoLogo size="sm" />

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            style={{
              background: showFilters ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${showFilters ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 10, width: 38, height: 38,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: showFilters ? '#D4AF37' : 'rgba(255,255,255,0.6)',
              flexShrink: 0,
            }}
          >
            <SlidersHorizontal size={15} />
            {hasFilters && (
              <span style={{
                position: 'absolute', top: 8, right: 8,
                width: 7, height: 7, borderRadius: '50%',
                background: '#D4AF37', border: '1.5px solid #090705',
              }} />
            )}
          </button>
        </div>

        {/* ── Page title ──────────────────────────── */}
        <div style={{ padding: '18px 16px 4px' }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.3px' }}>Meus Pedidos</h1>
          {metrics.total > 0 && (
            <p style={{ fontSize: 11, color: 'rgba(212,175,55,0.6)', margin: '3px 0 0', fontWeight: 600 }}>
              {metrics.total} pedido{metrics.total !== 1 ? 's' : ''} · {metrics.active > 0 ? `${metrics.active} em andamento` : 'Nenhum em andamento'}
            </p>
          )}
        </div>

        <div style={{ padding: '12px 16px 0', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* ── Metric cards (2-col grid) ── */}
          {!loading && metrics.total > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <MetricCard icon={<ReceiptText size={18} />} iconColor="#D4AF37" iconBg="rgba(212,175,55,0.1)" label="Total" value={String(metrics.total)} />
              <MetricCard icon={<Clock size={18} />} iconColor="#F59E0B" iconBg="rgba(245,158,11,0.1)" label="Ativos" value={String(metrics.active)} sub={metrics.active > 0 ? 'Em andamento' : 'Todos concluídos'} />
              <MetricCard icon={<TrendingUp size={18} />} iconColor="#10B981" iconBg="rgba(16,185,129,0.1)" label="Total gasto" value={formatCurrency(metrics.totalSpent)} />
              <MetricCard icon={<Star size={18} />} iconColor="#8B5CF6" iconBg="rgba(139,92,246,0.1)" label="Ticket médio" value={formatCurrency(metrics.avgTicket)} />
            </div>
          )}

          {/* ── Filter Panel ── */}
          {showFilters && (
            <div style={{ ...card, padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(212,175,55,0.5)', pointerEvents: 'none' }} />
                <input
                  type="text"
                  placeholder="Buscar pedido ou produto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(212,175,55,0.15)',
                    borderRadius: 11, padding: '9px 34px',
                    fontSize: 12, color: '#fff', outline: 'none',
                    fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
                {search && (
                  <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', display: 'flex', padding: 2 }}>
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Status chips */}
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
                {(Object.keys(STATUS_CONFIG) as OrderStatus[]).map((s) => (
                  <FilterChip key={s} status={s} active={activeFilters.includes(s)} count={counts[s] ?? 0} onClick={() => toggle(s)} />
                ))}
              </div>

              {/* Sort row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Ordenar:</span>
                {([['recent', 'Recente'], ['oldest', 'Antigo'], ['highest', 'Maior valor']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setSort(k)} style={{
                    background: sort === k ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${sort === k ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: 8, padding: '4px 10px',
                    fontSize: 10.5, fontWeight: sort === k ? 800 : 500,
                    color: sort === k ? '#D4AF37' : 'rgba(255,255,255,0.35)',
                    cursor: 'pointer',
                  }}>{l}</button>
                ))}
                {hasFilters && (
                  <button onClick={clearFilters} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '4px 10px', fontSize: 10.5, fontWeight: 700, color: '#EF4444', cursor: 'pointer' }}>
                    <X size={11} /> Limpar
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div style={{ ...card, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertCircle size={15} color="#EF4444" />
              <span style={{ fontSize: 12, color: '#EF4444', fontWeight: 600 }}>{error}</span>
            </div>
          )}

          {/* ── Skeleton ── */}
          {loading && [1, 2, 3].map((i) => <SkeletonCard key={i} />)}

          {/* ── List ── */}
          {!loading && !error && (
            <>
              {hasFilters && filtered.length > 0 && (
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                  {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
                </div>
              )}
              {filtered.length === 0
                ? <EmptyState filtered={hasFilters} onClear={clearFilters} />
                : filtered.map((o) => <OrderCard key={o.id} order={o} highlight={highlightIds.has(o.id)} />)
              }
            </>
          )}
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes ordPulse {
          0%   { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
          70%  { box-shadow: 0 0 0 5px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; opacity: 1; }
        }
        @keyframes ordShimmer {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        input[placeholder]::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
};
