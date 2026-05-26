import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag, Clock, Truck, CheckCircle2, XCircle, ChefHat,
  Search, SlidersHorizontal, X, ChevronDown, ChevronUp,
  Package, TrendingUp, Star, ReceiptText, RefreshCw, ArrowLeft,
  AlertCircle, CircleDot,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
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
// Status icon mapping
// ──────────────────────────────────────────────────────────────
const STATUS_ICONS: Record<OrderStatus, React.ReactNode> = {
  pending:    <Clock size={12} />,
  confirmed:  <CheckCircle2 size={12} />,
  preparing:  <ChefHat size={12} />,
  delivering: <Truck size={12} />,
  delivered:  <CheckCircle2 size={12} />,
  cancelled:  <XCircle size={12} />,
};

const ACTIVE_PULSE: OrderStatus[] = ['pending', 'preparing', 'delivering'];

// ──────────────────────────────────────────────────────────────
// StatusBadge
// ──────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const cfg = STATUS_CONFIG[status];
  const pulse = ACTIVE_PULSE.includes(status);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderRadius: 20, padding: '3px 10px',
      fontSize: 11, fontWeight: 700, color: cfg.color,
      whiteSpace: 'nowrap',
    }}>
      {pulse && (
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: cfg.color,
          boxShadow: `0 0 0 0 ${cfg.color}`,
          animation: 'ordersPulse 1.8s ease-in-out infinite',
          flexShrink: 0,
        }} />
      )}
      {STATUS_ICONS[status]}
      {cfg.label}
    </span>
  );
};

// ──────────────────────────────────────────────────────────────
// MetricCard
// ──────────────────────────────────────────────────────────────
interface MetricCardProps {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
  sub?: string;
}
const MetricCard: React.FC<MetricCardProps> = ({ icon, iconColor, iconBg, label, value, sub }) => (
  <div style={{
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    animation: 'ordersSlideUp 0.4s ease both',
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 10,
      background: iconBg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: iconColor, flexShrink: 0,
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{sub}</div>}
    </div>
  </div>
);

// ──────────────────────────────────────────────────────────────
// SkeletonCard
// ──────────────────────────────────────────────────────────────
const SkeletonCard: React.FC = () => (
  <div style={{
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16, padding: '16px',
    display: 'flex', flexDirection: 'column', gap: 12,
    animation: 'ordersShimmer 1.5s ease-in-out infinite',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ height: 14, width: 90, borderRadius: 8, background: 'rgba(255,255,255,0.08)' }} />
      <div style={{ height: 22, width: 110, borderRadius: 20, background: 'rgba(255,255,255,0.08)' }} />
    </div>
    <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
    <div style={{ display: 'flex', gap: 8 }}>
      {[40, 40, 40].map((_, i) => (
        <div key={i} style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.08)' }} />
      ))}
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <div style={{ height: 13, width: 60, borderRadius: 6, background: 'rgba(255,255,255,0.08)' }} />
      <div style={{ height: 13, width: 80, borderRadius: 6, background: 'rgba(255,255,255,0.08)' }} />
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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '4px 0' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <XCircle size={14} color="#EF4444" />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#EF4444' }}>Pedido cancelado</div>
          {ev?.timestamp && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{relativeTime(ev.timestamp)}</div>}
        </div>
      </div>
    );
  }

  const currentIdx = TIMELINE_STEPS.indexOf(order.status);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {TIMELINE_STEPS.map((step, i) => {
        const done = i <= currentIdx;
        const active = i === currentIdx;
        const cfg = STATUS_CONFIG[step];
        const ev = order.timeline.find((t) => t.status === step);
        const isLast = i === TIMELINE_STEPS.length - 1;
        return (
          <div key={step} style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            {/* Connector + circle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: done ? cfg.bg : 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${done ? cfg.border : 'rgba(255,255,255,0.1)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: done ? cfg.color : 'rgba(255,255,255,0.2)',
                boxShadow: active ? `0 0 10px ${cfg.color}44` : 'none',
              }}>
                {done ? <span style={{ fontSize: 8 }}>{STATUS_ICONS[step]}</span> : <CircleDot size={8} />}
              </div>
              {!isLast && (
                <div style={{
                  width: 1.5, flex: 1, minHeight: 20,
                  background: done ? `linear-gradient(to bottom, ${cfg.color}60, ${STATUS_CONFIG[TIMELINE_STEPS[i + 1] as OrderStatus]?.color ?? '#fff'}30)` : 'rgba(255,255,255,0.06)',
                  margin: '2px 0',
                }} />
              )}
            </div>
            {/* Content */}
            <div style={{ paddingBottom: isLast ? 0 : 14, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: done ? 700 : 500, color: done ? cfg.color : 'rgba(255,255,255,0.25)' }}>
                {cfg.label}
              </div>
              {ev?.timestamp && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                  {ev.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {relativeTime(ev.timestamp)}
                </div>
              )}
              {active && !ev?.timestamp && (
                <div style={{ fontSize: 10, color: cfg.color, marginTop: 1, fontWeight: 600 }}>Em andamento...</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// OrderCard
// ──────────────────────────────────────────────────────────────
const OrderCard: React.FC<{ order: Order; isNew: boolean }> = ({ order, isNew }) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[order.status];
  const visibleItems = order.items.slice(0, 3);
  const extraCount = order.items.length - 3;

  return (
    <div style={{
      background: isNew ? 'rgba(212,175,55,0.06)' : 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(12px)',
      border: `1px solid ${isNew ? 'rgba(212,175,55,0.25)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 16,
      overflow: 'hidden',
      transition: 'border-color 0.3s ease',
      animation: 'ordersSlideUp 0.35s ease both',
    }}>
      {/* Card header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
          padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}
      >
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#D4AF37' }}>{order.orderNumber}</div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              {order.createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
              {' · '}{relativeTime(order.createdAt)}
            </div>
          </div>
          <StatusBadge status={order.status} />
        </div>

        {/* Product thumbnails */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: -6 }}>
            {visibleItems.map((item, i) => (
              <div key={item.id} style={{
                width: 38, height: 38, borderRadius: 9,
                background: '#fff',
                border: '2px solid rgba(255,255,255,0.06)',
                overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginLeft: i > 0 ? -8 : 0,
                zIndex: visibleItems.length - i,
                flexShrink: 0,
              }}>
                {item.image ? (
                  <img src={item.image} alt={item.title} style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
                ) : (
                  <Package size={16} color="#090705" />
                )}
              </div>
            ))}
            {extraCount > 0 && (
              <div style={{
                width: 38, height: 38, borderRadius: 9,
                background: 'rgba(255,255,255,0.07)',
                border: '2px solid rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginLeft: -8, zIndex: 0, flexShrink: 0,
                fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.5)',
              }}>
                +{extraCount}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {order.items.map((i) => i.title.split(' ').slice(0, 2).join(' ')).join(', ')}
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            {order.items.length} {order.items.length === 1 ? 'item' : 'itens'} · {order.paymentMethod}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{formatCurrency(order.total)}</span>
            {expanded ? <ChevronUp size={14} color={cfg.color} /> : <ChevronDown size={14} color="rgba(255,255,255,0.3)" />}
          </div>
        </div>
      </button>

      {/* Expandable detail section */}
      {expanded && (
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          animation: 'ordersExpand 0.25s ease both',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '16px' }}>
            {/* Two columns: items + timeline */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, marginBottom: 16 }}>

              {/* Items list */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
                  Itens do pedido
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {order.items.map((item) => (
                    <div key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                        {item.image ? (
                          <img src={item.image} alt={item.title} style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
                        ) : <Package size={14} color="#090705" />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                        <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>{item.quantity}x · {formatCurrency(item.price)}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#FFDF73', flexShrink: 0 }}>{formatCurrency(item.price * item.quantity)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div style={{ minWidth: 150 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
                  Status
                </div>
                <Timeline order={order} />
              </div>
            </div>

            {/* Financial summary */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12, padding: '12px 14px',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Resumo financeiro</div>
              <Row label="Subtotal" value={formatCurrency(order.subtotal)} />
              {order.discount > 0 && <Row label={`Desconto${order.coupon ? ` (${order.coupon})` : ''}`} value={`-${formatCurrency(order.discount)}`} color="#10B981" />}
              <Row label="Taxa de entrega" value={order.deliveryFee === 0 ? 'Grátis' : formatCurrency(order.deliveryFee)} color={order.deliveryFee === 0 ? '#10B981' : undefined} />
              <div style={{ borderTop: '1px dashed rgba(255,255,255,0.08)', marginTop: 4, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#fff' }}>Total</span>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#FFDF73' }}>{formatCurrency(order.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Small inline row component for financial summary
const Row: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
    <span style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
    <span style={{ color: color ?? 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{value}</span>
  </div>
);

// ──────────────────────────────────────────────────────────────
// Empty State
// ──────────────────────────────────────────────────────────────
const EmptyState: React.FC<{ filtered: boolean; onClear: () => void }> = ({ filtered, onClear }) => {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 24px', textAlign: 'center', gap: 16 }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ShoppingBag size={30} color="rgba(255,255,255,0.2)" />
      </div>
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0 }}>
          {filtered ? 'Nenhum pedido encontrado' : 'Você ainda não fez pedidos'}
        </h3>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '6px 0 0', maxWidth: 240 }}>
          {filtered
            ? 'Tente remover os filtros ou buscar por outro termo.'
            : 'Que tal explorar nossos produtos e fazer seu primeiro pedido?'}
        </p>
      </div>
      {filtered ? (
        <button onClick={onClear} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 12, fontWeight: 700, padding: '8px 16px', cursor: 'pointer' }}>
          <X size={14} /> Limpar filtros
        </button>
      ) : (
        <button onClick={() => navigate('/')} style={{ background: 'linear-gradient(135deg, #FFDF73, #D4AF37)', border: 'none', borderRadius: 10, color: '#090705', fontSize: 12, fontWeight: 900, padding: '10px 20px', cursor: 'pointer' }}>
          Fazer meu primeiro pedido 🛍️
        </button>
      )}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// Filter chip
// ──────────────────────────────────────────────────────────────
const FilterChip: React.FC<{ status: OrderStatus; active: boolean; count: number; onClick: () => void }> = ({ status, active, count, onClick }) => {
  const cfg = STATUS_CONFIG[status];
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 5,
      background: active ? cfg.bg : 'rgba(255,255,255,0.04)',
      border: `1px solid ${active ? cfg.border : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 20, padding: '5px 12px',
      fontSize: 11, fontWeight: 700,
      color: active ? cfg.color : 'rgba(255,255,255,0.45)',
      cursor: 'pointer', flexShrink: 0,
      transition: 'all 0.18s ease',
    }}>
      {cfg.label}
      <span style={{
        background: active ? cfg.color : 'rgba(255,255,255,0.1)',
        color: active ? '#000' : 'rgba(255,255,255,0.5)',
        borderRadius: 10, padding: '1px 6px', fontSize: 9.5, fontWeight: 900,
      }}>{count}</span>
    </button>
  );
};

// ──────────────────────────────────────────────────────────────
// Main Page — Orders
// ──────────────────────────────────────────────────────────────
export const Orders: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orders, metrics, loading, error } = useOrders(user?.uid ?? null);

  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<OrderStatus[]>([]);
  const [sort, setSort] = useState<'recent' | 'oldest' | 'highest'>('recent');
  const [showFilters, setShowFilters] = useState(false);

  // Track newest order IDs to highlight them
  const newestIds = useMemo(() => {
    const threshold = Date.now() - 5 * 60 * 1000; // 5 min
    return new Set(orders.filter((o) => o.createdAt.getTime() > threshold).map((o) => o.id));
  }, [orders]);

  // Status counts for filter chips
  const statusCounts = useMemo(() => {
    const counts: Partial<Record<OrderStatus, number>> = {};
    orders.forEach((o) => { counts[o.status] = (counts[o.status] ?? 0) + 1; });
    return counts;
  }, [orders]);

  // Filtered + sorted orders
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

  const toggleFilter = (s: OrderStatus) =>
    setActiveFilters((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  const clearFilters = () => { setSearch(''); setActiveFilters([]); };
  const hasFilters = search.trim() || activeFilters.length > 0;

  return (
    <main style={{
      minHeight: '100vh',
      paddingBottom: 100,
      fontFamily: "'Manrope', 'Outfit', sans-serif",
    }}>
      {/* ── Topbar ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(9,7,5,0.92)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 900, color: '#fff', margin: 0, lineHeight: 1 }}>Meus Pedidos</h1>
            {metrics.total > 0 && <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{metrics.total} {metrics.total === 1 ? 'pedido' : 'pedidos'} no total</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {metrics.active > 0 && (
            <span style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 800, color: '#F59E0B' }}>
              {metrics.active} ativo{metrics.active > 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={() => setShowFilters((v) => !v)}
            style={{
              background: showFilters ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${showFilters ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 10, padding: '6px 12px',
              fontSize: 11, fontWeight: 700, color: showFilters ? '#D4AF37' : 'rgba(255,255,255,0.6)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <SlidersHorizontal size={13} /> Filtros
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* ── Metrics Dashboard ── */}
        {!loading && metrics.total > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
            <MetricCard
              icon={<ReceiptText size={18} />}
              iconColor="#D4AF37"
              iconBg="rgba(212,175,55,0.12)"
              label="Total de pedidos"
              value={String(metrics.total)}
            />
            <MetricCard
              icon={<Clock size={18} />}
              iconColor="#F59E0B"
              iconBg="rgba(245,158,11,0.12)"
              label="Pedidos ativos"
              value={String(metrics.active)}
              sub={metrics.active > 0 ? 'Em andamento agora' : 'Nenhum em andamento'}
            />
            <MetricCard
              icon={<TrendingUp size={18} />}
              iconColor="#10B981"
              iconBg="rgba(16,185,129,0.12)"
              label="Total investido"
              value={formatCurrency(metrics.totalSpent)}
            />
            <MetricCard
              icon={<Star size={18} />}
              iconColor="#8B5CF6"
              iconBg="rgba(139,92,246,0.12)"
              label="Ticket médio"
              value={formatCurrency(metrics.avgTicket)}
              sub={metrics.lastOrderAt ? `Último: ${relativeTime(metrics.lastOrderAt)}` : undefined}
            />
          </div>
        )}

        {/* ── Filter Panel ── */}
        {showFilters && (
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14, padding: '14px',
            marginBottom: 14,
            animation: 'ordersSlideUp 0.2s ease both',
          }}>
            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Buscar por ID ou produto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, padding: '9px 12px 9px 34px',
                  fontSize: 12, color: '#fff', outline: 'none',
                  fontFamily: "'Manrope', 'Outfit', sans-serif",
                }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex' }}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {(Object.keys(STATUS_CONFIG) as OrderStatus[]).map((s) => (
                <FilterChip
                  key={s}
                  status={s}
                  active={activeFilters.includes(s)}
                  count={statusCounts[s] ?? 0}
                  onClick={() => toggleFilter(s)}
                />
              ))}
            </div>

            {/* Sort + clear */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>Ordenar:</span>
              {[
                { key: 'recent', label: 'Mais recente' },
                { key: 'oldest', label: 'Mais antigo' },
                { key: 'highest', label: 'Maior valor' },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setSort(key as typeof sort)} style={{
                  background: sort === key ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${sort === key ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 8, padding: '4px 10px',
                  fontSize: 11, fontWeight: sort === key ? 700 : 500,
                  color: sort === key ? '#D4AF37' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                }}>
                  {label}
                </button>
              ))}
              {hasFilters && (
                <button onClick={clearFilters} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: '#EF4444', cursor: 'pointer' }}>
                  <X size={11} /> Limpar
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Error state ── */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
            <AlertCircle size={16} color="#EF4444" />
            <span style={{ fontSize: 12, color: '#EF4444', fontWeight: 600 }}>{error}</span>
            <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}><RefreshCw size={14} /></button>
          </div>
        )}

        {/* ── Skeleton Loading ── */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── Orders List ── */}
        {!loading && !error && (
          <>
            {hasFilters && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 10, fontWeight: 600 }}>
                {filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'} encontrado{filtered.length !== 1 ? 's' : ''}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.length === 0 ? (
                <EmptyState filtered={!!hasFilters} onClear={clearFilters} />
              ) : (
                filtered.map((order) => (
                  <OrderCard key={order.id} order={order} isNew={newestIds.has(order.id)} />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Global Styles ── */}
      <style>{`
        @keyframes ordersPulse {
          0%   { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
          70%  { box-shadow: 0 0 0 5px transparent; opacity: 0.6; }
          100% { box-shadow: 0 0 0 0 transparent; opacity: 1; }
        }
        @keyframes ordersSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ordersExpand {
          from { opacity: 0; max-height: 0; }
          to   { opacity: 1; max-height: 1000px; }
        }
        @keyframes ordersShimmer {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1; }
        }
        input::placeholder { color: rgba(255,255,255,0.25); }
      `}</style>
    </main>
  );
};
