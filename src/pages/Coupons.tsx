import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Ticket, ArrowLeft, Tag, Zap, CheckCircle2, XCircle,
  Copy, Sparkles, AlertCircle, Gift,
  BadgePercent, Timer, Search, X,
} from 'lucide-react';
import { MercadoLogo, AuthBackground, AuthStyles } from './Login';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../hooks/useAuth';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────
type CouponType = 'percent' | 'fixed' | 'frete' | 'gift';
type CouponStatus = 'available' | 'used' | 'expired';

interface Coupon {
  id: string;
  code: string;
  title: string;
  description: string;
  type: CouponType;
  value: number;          // percent or R$ amount
  minOrder?: number;
  maxDiscount?: number;
  expiresAt?: Date;
  usedAt?: Date;
  status: CouponStatus;
  categoryRestriction?: string;
  firstPurchaseOnly?: boolean;
  club?: boolean;
}

// ──────────────────────────────────────────────────────────────
// Design tokens
// ──────────────────────────────────────────────────────────────
const card = {
  background: 'rgba(9,7,5,0.58)',
  backdropFilter: 'blur(28px)',
  WebkitBackdropFilter: 'blur(28px)',
  border: '1px solid rgba(212,175,55,0.18)',
  borderRadius: '20px',
  boxShadow: '0 12px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
};

// ──────────────────────────────────────────────────────────────
// Coupon type config
// ──────────────────────────────────────────────────────────────
const TYPE_CFG: Record<CouponType, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  percent: { label: 'Desconto',  color: '#10B981', bg: 'rgba(16,185,129,0.1)',  icon: <BadgePercent size={16} /> },
  fixed:   { label: 'Desconto',  color: '#6366F1', bg: 'rgba(99,102,241,0.1)', icon: <Tag size={16} /> },
  frete:   { label: 'Frete',     color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', icon: <Zap size={16} /> },
  gift:    { label: 'Brinde',    color: '#EC4899', bg: 'rgba(236,72,153,0.1)', icon: <Gift size={16} /> },
};

const STATUS_CFG: Record<CouponStatus, { label: string; color: string; bg: string }> = {
  available: { label: 'Disponível', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  used:      { label: 'Utilizado',  color: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.05)' },
  expired:   { label: 'Expirado',   color: '#EF4444', bg: 'rgba(239,68,68,0.08)' },
};

// ──────────────────────────────────────────────────────────────
// Mock coupons — replace with Firestore in production
// ──────────────────────────────────────────────────────────────
const MOCK_COUPONS: Coupon[] = [
  {
    id: '1', code: 'BEMVINDO15', title: 'Boas-vindas!', type: 'percent', value: 15,
    description: '15% de desconto na sua primeira compra acima de R$ 80.',
    minOrder: 80, maxDiscount: 50, status: 'available',
    expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    firstPurchaseOnly: true,
  },
  {
    id: '2', code: 'FRETEFIX', title: 'Frete Grátis', type: 'frete', value: 0,
    description: 'Frete grátis em compras acima de R$ 120.',
    minOrder: 120, status: 'available',
    expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
  },
  {
    id: '3', code: 'CLUBE10', title: 'Benefício Clube', type: 'percent', value: 10,
    description: '10% extra para membros do Clube. Sem pedido mínimo.',
    status: 'available', club: true,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
  {
    id: '4', code: 'MERCADO20', title: 'Super Oferta', type: 'fixed', value: 20,
    description: 'R$ 20 de desconto em compras acima de R$ 150.',
    minOrder: 150, status: 'available',
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: '5', code: 'JANTAR5', title: 'Noite de Promo', type: 'fixed', value: 5,
    description: 'R$ 5 de desconto na seção de Bebidas.',
    categoryRestriction: 'Bebidas', status: 'used',
    usedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: '6', code: 'FERIAS30', title: 'Promoção Férias', type: 'percent', value: 30,
    description: '30% de desconto em toda a loja. Promoção encerrada.',
    status: 'expired',
    expiresAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
];

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────
const fmtDiscount = (c: Coupon) => {
  if (c.type === 'frete') return 'Frete Grátis';
  if (c.type === 'gift') return 'Brinde';
  if (c.type === 'percent') return `-${c.value}%`;
  return `-R$ ${c.value.toFixed(2).replace('.', ',')}`;
};

const fmtExpiry = (d?: Date) => {
  if (!d) return null;
  const diff = d.getTime() - Date.now();
  if (diff < 0) return 'Expirado';
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Expira hoje!';
  if (days === 1) return 'Expira amanhã';
  return `Expira em ${days} dias`;
};

// ──────────────────────────────────────────────────────────────
// Coupon Card
// ──────────────────────────────────────────────────────────────
const CouponCard: React.FC<{ coupon: Coupon; onCopy: (code: string) => void }> = ({ coupon, onCopy }) => {
  const [copied, setCopied] = useState(false);
  const typeCfg = TYPE_CFG[coupon.type];
  const statusCfg = STATUS_CFG[coupon.status];
  const available = coupon.status === 'available';
  const expiry = fmtExpiry(coupon.expiresAt);
  const expiringUrgent = coupon.expiresAt && (coupon.expiresAt.getTime() - Date.now()) < 3 * 86400000 && available;

  const handleCopy = () => {
    navigator.clipboard.writeText(coupon.code).catch(() => {});
    setCopied(true);
    onCopy(coupon.code);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      ...card,
      opacity: available ? 1 : 0.65,
      overflow: 'hidden',
      border: available
        ? coupon.club
          ? '1px solid rgba(212,175,55,0.45)'
          : '1px solid rgba(212,175,55,0.22)'
        : '1px solid rgba(255,255,255,0.07)',
    }}>
      {/* ── Dashed ticket separator ── */}
      <div style={{
        position: 'relative',
        borderBottom: '1.5px dashed rgba(255,255,255,0.07)',
        marginBottom: '0',
      }}>
        {/* Left circle notch */}
        <div style={{
          position: 'absolute', left: -14, top: '50%', transform: 'translateY(-50%)',
          width: 24, height: 24, borderRadius: '50%',
          background: '#090705',
          border: '1.5px solid rgba(212,175,55,0.1)',
        }} />
        {/* Right circle notch */}
        <div style={{
          position: 'absolute', right: -14, top: '50%', transform: 'translateY(-50%)',
          width: 24, height: 24, borderRadius: '50%',
          background: '#090705',
          border: '1.5px solid rgba(212,175,55,0.1)',
        }} />

        {/* Main coupon body */}
        <div style={{ padding: '16px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          {/* Discount badge */}
          <div style={{
            minWidth: '72px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '10px 6px',
            background: available ? typeCfg.bg : 'rgba(255,255,255,0.04)',
            border: `1px solid ${available ? typeCfg.color + '30' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: '14px',
            flexShrink: 0,
          }}>
            <div style={{ color: available ? typeCfg.color : 'rgba(255,255,255,0.3)', marginBottom: '4px' }}>
              {typeCfg.icon}
            </div>
            <div style={{
              fontSize: '15px', fontWeight: 900, lineHeight: 1.1,
              color: available ? typeCfg.color : 'rgba(255,255,255,0.25)',
              textAlign: 'center',
            }}>
              {fmtDiscount(coupon)}
            </div>
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: available ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                {coupon.title}
              </span>
              {coupon.club && (
                <span style={{
                  fontSize: '8.5px', fontWeight: 800,
                  background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)',
                  color: '#D4AF37', borderRadius: '99px', padding: '2px 6px', letterSpacing: '0.5px',
                }}>⭐ CLUBE</span>
              )}
              <span style={{
                fontSize: '9px', fontWeight: 800,
                background: statusCfg.bg, color: statusCfg.color,
                borderRadius: '99px', padding: '2px 7px',
              }}>
                {statusCfg.label}
              </span>
            </div>
            <p style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.45)', margin: '0 0 6px', lineHeight: 1.45 }}>
              {coupon.description}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
              {coupon.minOrder && <span>Mín. R$ {coupon.minOrder.toFixed(2).replace('.', ',')}</span>}
              {coupon.maxDiscount && <span>· Máx. R$ {coupon.maxDiscount.toFixed(2).replace('.', ',')}</span>}
              {coupon.categoryRestriction && <span>· {coupon.categoryRestriction} somente</span>}
              {coupon.firstPurchaseOnly && <span>· Primeira compra</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div style={{
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
      }}>
        {/* Code */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'rgba(255,255,255,0.04)',
          border: '1.5px dashed rgba(255,255,255,0.12)',
          borderRadius: '9px', padding: '6px 12px',
          flex: 1, minWidth: 0,
        }}>
          <span style={{
            fontSize: '13px', fontWeight: 900, letterSpacing: '1.5px',
            color: available ? '#FFDF73' : 'rgba(255,255,255,0.25)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {coupon.code}
          </span>
        </div>

        {/* Expiry */}
        {expiry && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <Timer size={10} color={expiringUrgent ? '#EF4444' : 'rgba(255,255,255,0.3)'} />
            <span style={{ fontSize: '10px', color: expiringUrgent ? '#EF4444' : 'rgba(255,255,255,0.3)', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {expiry}
            </span>
          </div>
        )}

        {/* Copy button */}
        {available && (
          <button
            onClick={handleCopy}
            className={`coupon-copy-btn ${copied ? 'coupon-copied' : ''}`}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              height: '34px', padding: '0 12px',
              background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(212,175,55,0.12)',
              border: `1px solid ${copied ? 'rgba(16,185,129,0.4)' : 'rgba(212,175,55,0.3)'}`,
              borderRadius: '9px', cursor: 'pointer',
              color: copied ? '#10B981' : '#D4AF37',
              fontSize: '11px', fontWeight: 800, fontFamily: 'inherit',
              transition: 'all 0.25s ease', flexShrink: 0,
            }}
          >
            {copied ? <><CheckCircle2 size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
          </button>
        )}

        {coupon.status === 'used' && coupon.usedAt && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={11} color="rgba(255,255,255,0.2)" />
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>
              {coupon.usedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </span>
          </div>
        )}

        {coupon.status === 'expired' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <XCircle size={11} color="rgba(239,68,68,0.5)" />
            <span style={{ fontSize: '10px', color: 'rgba(239,68,68,0.5)', fontWeight: 600 }}>Expirado</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// Apply Coupon Input
// ──────────────────────────────────────────────────────────────
const ApplyCoupon: React.FC<{ onApply: (code: string) => void }> = ({ onApply }) => {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const { error: toastError, success } = useToast();

  const handle = async () => {
    const code = value.trim().toUpperCase();
    if (!code) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 700));
    const found = MOCK_COUPONS.find(c => c.code === code);
    if (found) {
      if (found.status === 'available') { success('Cupom válido!', `"${code}" adicionado com sucesso.`); onApply(code); setValue(''); }
      else if (found.status === 'used') toastError('Cupom já utilizado', 'Você já usou este cupom.');
      else toastError('Cupom expirado', 'Este cupom não está mais válido.');
    } else {
      toastError('Cupom inválido', 'Código não encontrado ou inválido.');
    }
    setLoading(false);
  };

  return (
    <div style={{ ...card, padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Ticket size={14} color="#D4AF37" />
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(212,175,55,0.7)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          Inserir cupom
        </span>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="Digite o código do cupom..."
          value={value}
          onChange={e => setValue(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && handle()}
          className="coupon-input"
          style={{
            flex: 1, height: '44px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '11px', padding: '0 14px',
            color: '#fff', fontSize: '13px', letterSpacing: '1px', fontWeight: 700,
            outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
        <button
          onClick={handle}
          disabled={loading || !value.trim()}
          className="coupon-apply-btn"
          style={{
            height: '44px', padding: '0 16px',
            background: value.trim() ? 'linear-gradient(135deg, #D4AF37, #FFDF73)' : 'rgba(255,255,255,0.05)',
            border: value.trim() ? 'none' : '1px solid rgba(255,255,255,0.08)',
            borderRadius: '11px', cursor: value.trim() ? 'pointer' : 'default',
            color: value.trim() ? '#000' : 'rgba(255,255,255,0.25)',
            fontWeight: 800, fontSize: '13px', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0,
            transition: 'all 0.2s ease',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading
            ? <span className="coupon-spinner" />
            : <><CheckCircle2 size={14} /> Aplicar</>
          }
        </button>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// Stats bar
// ──────────────────────────────────────────────────────────────
const StatsBar: React.FC<{ coupons: Coupon[] }> = ({ coupons }) => {
  const avail = coupons.filter(c => c.status === 'available').length;
  const used  = coupons.filter(c => c.status === 'used').length;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
      {[
        { label: 'Disponíveis', value: avail, color: '#10B981', icon: <Sparkles size={16} /> },
        { label: 'Utilizados',  value: used,  color: '#6366F1', icon: <CheckCircle2 size={16} /> },
        { label: 'Total',       value: coupons.length, color: '#D4AF37', icon: <Ticket size={16} /> },
      ].map(s => (
        <div key={s.label} style={{ ...card, padding: '12px 10px', textAlign: 'center' }}>
          <div style={{ color: s.color, display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>{s.icon}</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>{s.value}</div>
          <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '2px' }}>{s.label}</div>
        </div>
      ))}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────
export const Coupons: React.FC = () => {
  const navigate = useNavigate();
  const { success } = useToast();
  const { userProfile } = useAuth();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | CouponStatus>('all');

  // Get available + used + expired coupons
  const allCoupons = useMemo(() => {
    // Show club coupons only if user is in a club (simplified check)
    return MOCK_COUPONS;
  }, []);

  const filtered = useMemo(() => {
    let list = allCoupons;
    if (filter !== 'all') list = list.filter(c => c.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    }
    // Sort: available first, then used, then expired
    return [...list].sort((a, b) => {
      const ord = { available: 0, used: 1, expired: 2 };
      return ord[a.status] - ord[b.status];
    });
  }, [allCoupons, filter, search]);

  const handleCopy = (code: string) => {
    success('Copiado!', `Código ${code} copiado para a área de transferência.`);
  };

  const tabs: { key: 'all' | CouponStatus; label: string; count: number }[] = [
    { key: 'all',       label: 'Todos',       count: allCoupons.length },
    { key: 'available', label: 'Disponíveis', count: allCoupons.filter(c => c.status === 'available').length },
    { key: 'used',      label: 'Utilizados',  count: allCoupons.filter(c => c.status === 'used').length },
    { key: 'expired',   label: 'Expirados',   count: allCoupons.filter(c => c.status === 'expired').length },
  ];

  return (
    <div style={{ position: 'relative', minHeight: '100vh', fontFamily: "'Manrope','Outfit',sans-serif" }}>
      <AuthBackground />
      <AuthStyles />

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', paddingBottom: '110px' }}>

        {/* ── Topbar ─────────────────────────────────────────── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'rgba(9,7,5,0.4)', backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(212,175,55,0.1)',
        }}>
          <div className="safe-area-top-bg" style={{ background: '#090705' }} />
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
          }}>
            <button onClick={() => navigate(-1)} className="coupon-back-btn" style={{
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '50%', width: 38, height: 38,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'rgba(255,255,255,0.8)',
            }}>
              <ArrowLeft size={18} />
            </button>
            <MercadoLogo size="sm" />
            <div style={{ width: 38 }} />
          </div>
        </div>

        {/* ── Page header ────────────────────────────────────── */}
        <div style={{ padding: '18px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '10px',
              background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Ticket size={16} color="#D4AF37" />
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 900, color: '#fff', margin: 0 }}>
              Cupons e Descontos
            </h1>
          </div>
          {userProfile?.name && (
            <p style={{ fontSize: '11px', color: 'rgba(212,175,55,0.5)', margin: '0 0 0 42px', fontWeight: 600 }}>
              Olá, {userProfile.name.split(' ')[0]}! Você tem {allCoupons.filter(c => c.status === 'available').length} cupons disponíveis
            </p>
          )}
        </div>

        <div style={{ padding: '0 16px', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Stats */}
          <StatsBar coupons={allCoupons} />

          {/* Apply coupon */}
          <ApplyCoupon onApply={() => {}} />

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(212,175,55,0.5)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Buscar cupom..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="coupon-input"
              style={{
                width: '100%', height: '40px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '11px', padding: '0 36px',
                color: '#fff', fontSize: '12.5px', outline: 'none', fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 2, display: 'flex' }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px', scrollbarWidth: 'none' }}>
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className="coupon-filter-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0,
                  background: filter === t.key ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${filter === t.key ? 'rgba(212,175,55,0.35)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: '99px', padding: '6px 12px',
                  fontSize: '10.5px', fontWeight: 700,
                  color: filter === t.key ? '#D4AF37' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {t.label}
                <span style={{
                  background: filter === t.key ? 'rgba(212,175,55,0.25)' : 'rgba(255,255,255,0.08)',
                  color: filter === t.key ? '#D4AF37' : 'rgba(255,255,255,0.3)',
                  borderRadius: '99px', padding: '0 6px',
                  fontSize: '9px', fontWeight: 900, lineHeight: '15px',
                }}>{t.count}</span>
              </button>
            ))}
          </div>

          {/* Results */}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: 60, height: 60, borderRadius: '18px',
                background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Ticket size={24} color="rgba(212,175,55,0.35)" />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff', marginBottom: '5px' }}>
                  Nenhum cupom encontrado
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5, maxWidth: '200px' }}>
                  Tente outros filtros ou busque por um código diferente.
                </div>
              </div>
            </div>
          )}

          {filtered.map(c => (
            <CouponCard key={c.id} coupon={c} onCopy={handleCopy} />
          ))}

          {/* Info tip */}
          <div style={{ ...card, padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start', border: '1px solid rgba(255,255,255,0.07)' }}>
            <AlertCircle size={16} color="rgba(255,255,255,0.25)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
              Os cupons são de uso único e pessoal. Aplique o código no checkout antes de finalizar o pedido. Cupons de frete são válidos somente para entregas na área de cobertura.
            </div>
          </div>
        </div>
      </div>

      <CouponStyles />
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────
const CouponStyles: React.FC = () => (
  <style>{`
    @keyframes couponSpin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
    .coupon-spinner {
      display: inline-block; width: 14px; height: 14px;
      border: 2px solid rgba(0,0,0,0.15); border-top-color: #000;
      border-radius: 50%; animation: couponSpin 0.7s linear infinite;
    }
    .coupon-input:focus {
      border-color: rgba(212,175,55,0.45) !important;
      box-shadow: 0 0 0 3px rgba(212,175,55,0.08) !important;
      background: rgba(255,255,255,0.08) !important;
    }
    .coupon-input::placeholder { color: rgba(255,255,255,0.2); }
    .coupon-copy-btn:hover { transform: translateY(-1px); }
    .coupon-apply-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(212,175,55,0.3); }
    .coupon-filter-btn:hover { opacity: 0.85; }
    .coupon-back-btn:hover { background: rgba(255,255,255,0.12) !important; }
    .coupon-copied { animation: couponCopied 0.3s ease; }
    @keyframes couponCopied { 0% { transform: scale(1) } 50% { transform: scale(0.95) } 100% { transform: scale(1) } }
  `}</style>
);
