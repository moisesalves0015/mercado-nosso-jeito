import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers, Clock, Zap, Target, Plus, Trash2, Edit2, Check, X,
  ArrowUp, ArrowDown, Eye, EyeOff, Image, Link2, Star, Tag,
  RefreshCw, Search, Megaphone, ChevronUp, Save,
  AlertCircle, Sunrise, Sun, Sunset, Moon, Wind,
} from 'lucide-react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { VitrineConfig, MegaOfertaConfig, HeroBannerConfig, PeriodConfig } from '../hooks/useHomeConfig';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  title: string;
  image: string;
  category: string;
  price: number;
  active?: boolean;
}

type SubTab = 'vitrines' | 'megaOfertas' | 'periodos' | 'heroBanners' | 'campanhas';

const PERIOD_LABELS: Record<string, { label: string; sub: string; icon: React.ElementType }> = {
  morning:   { label: 'Manhã',      sub: 'Café da manhã', icon: Sunrise },
  lunch:     { label: 'Almoço',     sub: 'Refeições',     icon: Sun },
  afternoon: { label: 'Tarde',      sub: 'Lanches',       icon: Sunset },
  night:     { label: 'Noite',      sub: 'Jantar',        icon: Moon },
  dawn:      { label: 'Madrugada',  sub: 'Essenciais',    icon: Wind },
};

const THEME_OPTIONS: { value: VitrineConfig['theme']; label: string; color: string }[] = [
  { value: 'hero',   label: 'Hero (escuro)',   color: '#1e293b' },
  { value: 'purple', label: 'Roxo / Bebidas',  color: '#818cf8' },
  { value: 'orange', label: 'Laranja / Alimentos', color: '#f97316' },
  { value: 'green',  label: 'Verde / Limpeza', color: '#10b981' },
];

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'rgba(15,23,42,0.6)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 16,
  padding: 20,
};

const inputSt: React.CSSProperties = {
  width: '100%', height: 40,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, padding: '0 12px',
  color: '#fff', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'Manrope, sans-serif',
};

const labelSt: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.45)',
  textTransform: 'uppercase', letterSpacing: 0.5,
  display: 'block', marginBottom: 5,
};

const btnGold: React.CSSProperties = {
  background: 'linear-gradient(135deg, #D4AF37, #FFDF73)',
  border: 'none', borderRadius: 10, color: '#000',
  fontWeight: 900, fontSize: 12, padding: '0 16px', height: 38,
  display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
  fontFamily: 'Manrope, sans-serif', flexShrink: 0,
};

const btnGhost: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, color: 'rgba(255,255,255,0.7)',
  fontWeight: 800, fontSize: 11, padding: '0 12px', height: 32,
  display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
  fontFamily: 'Manrope, sans-serif',
};

const btnIconSm = (color = 'rgba(255,255,255,0.5)'): React.CSSProperties => ({
  background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 7, width: 30, height: 30,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color, cursor: 'pointer',
});

const toggle = (active: boolean): React.CSSProperties => ({
  width: 38, height: 22, borderRadius: 99, border: 'none', cursor: 'pointer',
  background: active ? 'linear-gradient(135deg,#D4AF37,#FFDF73)' : 'rgba(255,255,255,0.1)',
  position: 'relative', transition: 'all 0.2s ease', flexShrink: 0,
});

const toggleKnob = (active: boolean): React.CSSProperties => ({
  position: 'absolute', top: 3, left: active ? 19 : 3,
  width: 16, height: 16, borderRadius: '50%',
  background: active ? '#000' : 'rgba(255,255,255,0.4)',
  transition: 'all 0.2s ease',
});

// ─── PRODUCT SEARCH PICKER ────────────────────────────────────────────────────
const ProductPicker: React.FC<{
  products: Product[];
  selectedIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}> = ({ products, selectedIds, onAdd, onRemove }) => {
  const [q, setQ] = useState('');
  const filtered = products.filter(p =>
    (p.title.toLowerCase().includes(q.toLowerCase()) || p.id.toLowerCase().includes(q.toLowerCase())) &&
    !selectedIds.includes(p.id)
  ).slice(0, 8);

  return (
    <div>
      {/* Selected */}
      {selectedIds.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {selectedIds.map(id => {
            const p = products.find(x => x.id === id);
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: 99, padding: '3px 8px 3px 5px' }}>
                {p && <img src={p.image} alt="" style={{ width: 18, height: 18, objectFit: 'contain', borderRadius: 4 }} />}
                <span style={{ fontSize: 11, fontWeight: 700, color: '#FFDF73', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p ? p.title.split(' ').slice(0, 3).join(' ') : id}
                </span>
                <button onClick={() => onRemove(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: 0 }}>
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 6 }}>
        <Search size={12} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input
          type="text"
          placeholder="Buscar produto por nome..."
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ ...inputSt, paddingLeft: 30, height: 34 }}
        />
      </div>

      {q && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
          {filtered.length === 0 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', padding: '6px 4px' }}>Nenhum produto encontrado.</span>}
          {filtered.map(p => (
            <button key={p.id} onClick={() => { onAdd(p.id); setQ(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', textAlign: 'left' }}>
              <img src={p.image} alt="" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6, background: 'rgba(255,255,255,0.03)', flexShrink: 0 }} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>{p.category} · R$ {Number(p.price).toFixed(2)}</div>
              </div>
              <Plus size={13} color="#D4AF37" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── VITRINE FORM ─────────────────────────────────────────────────────────────
const VitrineForm: React.FC<{
  products: Product[];
  initial?: Partial<VitrineConfig>;
  onSave: (data: Partial<VitrineConfig>) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}> = ({ products, initial = {}, onSave, onCancel, saving }) => {
  const [title, setTitle] = useState(initial.title || '');
  const [subtitle, setSubtitle] = useState(
    Array.isArray(initial.subtitle) ? initial.subtitle.join(' | ') : (initial.subtitle || '')
  );
  const [theme, setTheme] = useState<VitrineConfig['theme']>(initial.theme || 'purple');
  const [order, setOrder] = useState(String(initial.order ?? 0));
  const [maxProducts, setMaxProducts] = useState(String(initial.maxProducts ?? 6));
  const [validFrom, setValidFrom] = useState(initial.validFrom || '');
  const [validUntil, setValidUntil] = useState(initial.validUntil || '');
  const [productIds, setProductIds] = useState<string[]>(initial.productIds || []);
  const [active, setActive] = useState(initial.active !== false);

  const handleSubmit = () => {
    if (!title.trim()) { alert('Informe o título da vitrine.'); return; }
    const subs = subtitle.trim() ? subtitle.split('|').map(s => s.trim()).filter(Boolean) : undefined;
    onSave({
      title: title.trim(),
      subtitle: subs && subs.length === 1 ? subs[0] : (subs || undefined),
      theme, active,
      order: parseInt(order) || 0,
      maxProducts: parseInt(maxProducts) || 6,
      productIds,
      validFrom: validFrom || null,
      validUntil: validUntil || null,
      layout: 'horizontal',
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelSt}>Título *</label>
          <input style={inputSt} value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Bebidas Geladas" />
        </div>
        <div>
          <label style={labelSt}>Subtítulo (separe com |)</label>
          <input style={inputSt} value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Slogan 1 | Slogan 2" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelSt}>Tema / Cor</label>
          <select value={theme} onChange={e => setTheme(e.target.value as any)}
            style={{ ...inputSt, background: 'rgba(255,255,255,0.04)', appearance: 'auto' }}>
            {THEME_OPTIONS.map(t => <option key={t.value} value={t.value} style={{ background: '#0f172a' }}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelSt}>Ordem</label>
          <input style={inputSt} type="number" value={order} onChange={e => setOrder(e.target.value)} min="0" />
        </div>
        <div>
          <label style={labelSt}>Máx. Produtos</label>
          <input style={inputSt} type="number" value={maxProducts} onChange={e => setMaxProducts(e.target.value)} min="1" max="20" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelSt}>Válido a partir de</label>
          <input style={inputSt} type="datetime-local" value={validFrom} onChange={e => setValidFrom(e.target.value)} />
        </div>
        <div>
          <label style={labelSt}>Válido até</label>
          <input style={inputSt} type="datetime-local" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button style={toggle(active)} onClick={() => setActive(!active)}>
          <div style={toggleKnob(active)} />
        </button>
        <span style={{ fontSize: 12, fontWeight: 700, color: active ? '#FFDF73' : 'rgba(255,255,255,0.4)' }}>
          {active ? 'Vitrine ativa' : 'Vitrine inativa'}
        </span>
      </div>

      <div>
        <label style={{ ...labelSt, marginBottom: 8 }}>Produtos vinculados ({productIds.length})</label>
        <ProductPicker
          products={products}
          selectedIds={productIds}
          onAdd={id => setProductIds(prev => [...prev, id])}
          onRemove={id => setProductIds(prev => prev.filter(x => x !== id))}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={onCancel} style={{ ...btnGhost, color: 'rgba(255,255,255,0.5)' }}>Cancelar</button>
        <button onClick={handleSubmit} disabled={saving} style={{ ...btnGold, opacity: saving ? 0.6 : 1 }}>
          {saving ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
          {saving ? 'Salvando...' : 'Salvar Vitrine'}
        </button>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export const AdminMarketing: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('vitrines');

  // ── Data State ──
  const [products, setProducts] = useState<Product[]>([]);
  const [vitrines, setVitrines] = useState<VitrineConfig[]>([]);
  const [megaOfertas, setMegaOfertas] = useState<MegaOfertaConfig[]>([]);
  const [periodConfig, setPeriodConfig] = useState<Record<string, PeriodConfig>>({});
  const [heroBanners, setHeroBanners] = useState<HeroBannerConfig[]>([]);

  // ── UI State ──
  const [saving, setSaving] = useState(false);

  // Vitrines
  const [editingVitrineId, setEditingVitrineId] = useState<string | null>(null);
  const [creatingVitrine, setCreatingVitrine] = useState(false);

  // Mega Ofertas
  const [moSearch, setMoSearch] = useState('');
  const [moBadge, setMoBadge] = useState('');
  const [moBadgeStyle, setMoBadgeStyle] = useState<'orange' | 'light'>('orange');
  const [moValidUntil, setMoValidUntil] = useState('');
  const [moSelectedId, setMoSelectedId] = useState('');

  // Períodos
  const [editingPeriod, setEditingPeriod] = useState<string | null>(null);
  const [periodDraft, setPeriodDraft] = useState<Partial<PeriodConfig>>({});

  // Hero Banners
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [creatingBanner, setCreatingBanner] = useState(false);
  const [bannerDraft, setBannerDraft] = useState<Partial<HeroBannerConfig>>({});

  // ── Load Firestore ──────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'products'), snap => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      }),
      onSnapshot(collection(db, 'home-config', 'data', 'vitrines'), snap => {
        setVitrines(snap.docs.map(d => ({ id: d.id, ...d.data() } as VitrineConfig)).sort((a, b) => a.order - b.order));
      }),
      onSnapshot(collection(db, 'home-config', 'data', 'mega-ofertas'), snap => {
        setMegaOfertas(snap.docs.map(d => ({ id: d.id, ...d.data() } as MegaOfertaConfig)).sort((a, b) => a.order - b.order));
      }),
      onSnapshot(collection(db, 'home-config', 'data', 'period-config'), snap => {
        const data: Record<string, PeriodConfig> = {};
        snap.docs.forEach(d => { data[d.id] = { id: d.id as any, ...d.data() } as PeriodConfig; });
        setPeriodConfig(data);
      }),
      onSnapshot(collection(db, 'home-config', 'data', 'hero-banners'), snap => {
        setHeroBanners(snap.docs.map(d => ({ id: d.id, ...d.data() } as HeroBannerConfig)).sort((a, b) => a.order - b.order));
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  // ── Vitrine Ops ─────────────────────────────────────────────────────────────
  const saveVitrine = useCallback(async (data: Partial<VitrineConfig>, id?: string) => {
    setSaving(true);
    try {
      if (id) {
        await updateDoc(doc(db, 'home-config', 'data', 'vitrines', id), data as any);
      } else {
        await addDoc(collection(db, 'home-config', 'data', 'vitrines'), data);
      }
      setEditingVitrineId(null);
      setCreatingVitrine(false);
    } catch (e: any) { alert('Erro: ' + e.message); }
    finally { setSaving(false); }
  }, []);

  const deleteVitrine = useCallback(async (id: string) => {
    if (!window.confirm('Excluir esta vitrine?')) return;
    await deleteDoc(doc(db, 'home-config', 'data', 'vitrines', id));
  }, []);

  const moveVitrine = useCallback(async (index: number, dir: 'up' | 'down') => {
    const next = dir === 'up' ? index - 1 : index + 1;
    if (next < 0 || next >= vitrines.length) return;
    const a = vitrines[index], b = vitrines[next];
    await updateDoc(doc(db, 'home-config', 'data', 'vitrines', a.id), { order: b.order });
    await updateDoc(doc(db, 'home-config', 'data', 'vitrines', b.id), { order: a.order });
  }, [vitrines]);

  const toggleVitrine = useCallback(async (v: VitrineConfig) => {
    await updateDoc(doc(db, 'home-config', 'data', 'vitrines', v.id), { active: !v.active });
  }, []);

  // ── Mega Oferta Ops ─────────────────────────────────────────────────────────
  const addMegaOferta = useCallback(async () => {
    if (!moSelectedId) { alert('Selecione um produto.'); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, 'home-config', 'data', 'mega-ofertas'), {
        productId: moSelectedId,
        badge: moBadge || undefined,
        badgeStyle: moBadgeStyle,
        order: megaOfertas.length,
        validUntil: moValidUntil || null,
      });
      setMoSelectedId(''); setMoBadge(''); setMoValidUntil('');
    } catch (e: any) { alert('Erro: ' + e.message); }
    finally { setSaving(false); }
  }, [moSelectedId, moBadge, moBadgeStyle, moValidUntil, megaOfertas.length]);

  const deleteMegaOferta = useCallback(async (id: string) => {
    if (!window.confirm('Remover desta seção?')) return;
    await deleteDoc(doc(db, 'home-config', 'data', 'mega-ofertas', id));
  }, []);

  const moveMegaOferta = useCallback(async (index: number, dir: 'up' | 'down') => {
    const next = dir === 'up' ? index - 1 : index + 1;
    if (next < 0 || next >= megaOfertas.length) return;
    const a = megaOfertas[index], b = megaOfertas[next];
    await updateDoc(doc(db, 'home-config', 'data', 'mega-ofertas', a.id), { order: b.order });
    await updateDoc(doc(db, 'home-config', 'data', 'mega-ofertas', b.id), { order: a.order });
  }, [megaOfertas]);

  // ── Period Ops ──────────────────────────────────────────────────────────────
  const savePeriod = useCallback(async (periodId: string) => {
    if (!periodDraft.title?.trim()) { alert('Informe o título do período.'); return; }
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'home-config', 'data', 'period-config', periodId),
        { ...periodConfig[periodId], ...periodDraft, id: periodId },
        { merge: true }
      );
      setEditingPeriod(null);
    } catch (e: any) { alert('Erro: ' + e.message); }
    finally { setSaving(false); }
  }, [periodDraft, periodConfig]);

  const addProductToPeriod = useCallback(async (periodId: string, productId: string) => {
    const current = periodConfig[periodId] || { id: periodId, title: PERIOD_LABELS[periodId]?.label, active: true, productIds: [], isAuto: false };
    const ids = [...(current.productIds || [])];
    if (ids.includes(productId)) return;
    ids.push(productId);
    await setDoc(doc(db, 'home-config', 'data', 'period-config', periodId), { ...current, productIds: ids }, { merge: true });
  }, [periodConfig]);

  const removeProductFromPeriod = useCallback(async (periodId: string, productId: string) => {
    const current = periodConfig[periodId];
    if (!current) return;
    const ids = current.productIds.filter(id => id !== productId);
    await updateDoc(doc(db, 'home-config', 'data', 'period-config', periodId), { productIds: ids });
  }, [periodConfig]);

  const togglePeriodActive = useCallback(async (periodId: string) => {
    const current = periodConfig[periodId];
    const val = current ? !current.active : false;
    await setDoc(doc(db, 'home-config', 'data', 'period-config', periodId),
      { ...(current || {}), active: val, id: periodId }, { merge: true });
  }, [periodConfig]);

  const togglePeriodAuto = useCallback(async (periodId: string) => {
    const current = periodConfig[periodId];
    const val = current ? !current.isAuto : true;
    await setDoc(doc(db, 'home-config', 'data', 'period-config', periodId),
      { ...(current || {}), isAuto: val, id: periodId }, { merge: true });
  }, [periodConfig]);

  // ── Hero Banner Ops ─────────────────────────────────────────────────────────
  const saveBanner = useCallback(async () => {
    if (!bannerDraft.title?.trim()) { alert('Informe o título.'); return; }
    setSaving(true);
    try {
      const data = {
        title: bannerDraft.title?.trim() || '',
        subtitle: bannerDraft.subtitle?.trim() || '',
        image: bannerDraft.image || '',
        link: bannerDraft.link || '/',
        buttonText: bannerDraft.buttonText || 'Ver Oferta',
        badgeText: bannerDraft.badgeText || '',
        highlightWords: bannerDraft.highlightWords || [],
        order: bannerDraft.order ?? heroBanners.length,
      };
      if (editingBannerId) {
        await updateDoc(doc(db, 'home-config', 'data', 'hero-banners', editingBannerId), data);
      } else {
        await addDoc(collection(db, 'home-config', 'data', 'hero-banners'), data);
      }
      setEditingBannerId(null); setCreatingBanner(false); setBannerDraft({});
    } catch (e: any) { alert('Erro: ' + e.message); }
    finally { setSaving(false); }
  }, [bannerDraft, editingBannerId, heroBanners.length]);

  const deleteBanner = useCallback(async (id: string) => {
    if (!window.confirm('Excluir este banner?')) return;
    await deleteDoc(doc(db, 'home-config', 'data', 'hero-banners', id));
  }, []);

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  const SubTabBtn = ({ id, label, icon: Icon, badge }: { id: SubTab; label: string; icon: React.ElementType; badge?: number }) => {
    const active = activeSubTab === id;
    return (
      <button onClick={() => setActiveSubTab(id)} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: active ? 'rgba(212,175,55,0.12)' : 'transparent',
        color: active ? '#D4AF37' : 'rgba(255,255,255,0.45)',
        fontWeight: 800, fontSize: 12, fontFamily: 'Manrope, sans-serif',
        flexShrink: 0, position: 'relative',
        borderBottom: active ? '2px solid #D4AF37' : '2px solid transparent',
      }}>
        <Icon size={14} /> {label}
        {badge !== undefined && badge > 0 && (
          <span style={{ background: '#D4AF37', color: '#000', fontSize: 9, fontWeight: 900, width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>
        )}
      </button>
    );
  };

  const moSearchFiltered = products
    .filter(p => p.title.toLowerCase().includes(moSearch.toLowerCase()) && !megaOfertas.find(m => m.productId === p.id))
    .slice(0, 6);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Sub Tab Nav ── */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(15,23,42,0.5)', padding: '8px 12px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto', scrollbarWidth: 'none' }}>
        <SubTabBtn id="vitrines"    label="Vitrines"     icon={Layers}     badge={vitrines.length} />
        <SubTabBtn id="megaOfertas" label="Mega Ofertas" icon={Zap}         badge={megaOfertas.length} />
        <SubTabBtn id="periodos"    label="Períodos"     icon={Clock}       />
        <SubTabBtn id="heroBanners" label="Hero Banners" icon={Image}       badge={heroBanners.length} />
        <SubTabBtn id="campanhas"   label="Campanhas"    icon={Megaphone}   />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SUB-ABA: VITRINES                                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'vitrines' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, color: '#fff', fontSize: 16, fontWeight: 900 }}>Vitrines de Produtos</h3>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Seções exibidas na Home, em tempo real</p>
            </div>
            {!creatingVitrine && (
              <button onClick={() => { setCreatingVitrine(true); setEditingVitrineId(null); }} style={btnGold}>
                <Plus size={13} /> Nova Vitrine
              </button>
            )}
          </div>

          {/* Create Form */}
          {creatingVitrine && (
            <div style={{ ...card, border: '1px solid rgba(212,175,55,0.3)', background: 'rgba(212,175,55,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Plus size={15} color="#D4AF37" />
                <h4 style={{ margin: 0, color: '#FFDF73', fontSize: 14, fontWeight: 900 }}>Nova Vitrine</h4>
              </div>
              <VitrineForm
                products={products}
                onSave={(data) => saveVitrine(data)}
                onCancel={() => setCreatingVitrine(false)}
                saving={saving}
              />
            </div>
          )}

          {/* List */}
          {vitrines.length === 0 && !creatingVitrine && (
            <div style={{ ...card, textAlign: 'center', padding: '40px 20px' }}>
              <Layers size={32} color="rgba(255,255,255,0.15)" style={{ marginBottom: 12 }} />
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0 }}>Nenhuma vitrine configurada.<br/>A Home usa dados de fallback (Bebidas, Alimentos, Limpeza).</p>
            </div>
          )}

          {vitrines.map((v, index) => {
            const isEditing = editingVitrineId === v.id;
            const theme = THEME_OPTIONS.find(t => t.value === v.theme);
            return (
              <div key={v.id} style={{ ...card, border: isEditing ? '1px solid rgba(212,175,55,0.4)' : '1px solid rgba(255,255,255,0.07)', transition: 'border 0.2s' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isEditing ? 16 : 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: theme?.color || '#666', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{v.title}</span>
                      <span style={{ fontSize: 9, fontWeight: 900, background: v.active ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)', color: v.active ? '#10b981' : '#ef4444', border: `1px solid ${v.active ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`, padding: '2px 7px', borderRadius: 99 }}>
                        {v.active ? 'ATIVA' : 'INATIVA'}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)' }}>Ordem {v.order} · {v.productIds.length} produtos</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button style={btnIconSm()} onClick={() => moveVitrine(index, 'up')} title="Mover para cima" disabled={index === 0}><ArrowUp size={12} /></button>
                    <button style={btnIconSm()} onClick={() => moveVitrine(index, 'down')} title="Mover para baixo" disabled={index === vitrines.length - 1}><ArrowDown size={12} /></button>
                    <button style={btnIconSm(v.active ? '#10b981' : '#ef4444')} onClick={() => toggleVitrine(v)} title="Toggle ativo">
                      {v.active ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                    <button style={btnIconSm('#FFDF73')} onClick={() => { setEditingVitrineId(isEditing ? null : v.id); setCreatingVitrine(false); }} title="Editar">
                      {isEditing ? <ChevronUp size={12} /> : <Edit2 size={12} />}
                    </button>
                    <button style={{ ...btnIconSm('#ef4444'), border: '1px solid rgba(239,68,68,0.2)' }} onClick={() => deleteVitrine(v.id)} title="Excluir">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Edit Form Inline */}
                {isEditing && (
                  <VitrineForm
                    products={products}
                    initial={v}
                    onSave={(data) => saveVitrine(data, v.id)}
                    onCancel={() => setEditingVitrineId(null)}
                    saving={saving}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SUB-ABA: MEGA OFERTAS                                                */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'megaOfertas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: '0 0 2px', color: '#fff', fontSize: 16, fontWeight: 900 }}>⚡ Mega Ofertas</h3>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Seção "MEGA OFERTAS — SÓ ESTA SEMANA" na Home</p>
          </div>

          {/* Add form */}
          <div style={{ ...card, border: '1px solid rgba(212,175,55,0.2)', background: 'rgba(212,175,55,0.03)' }}>
            <h4 style={{ margin: '0 0 12px', color: '#FFDF73', fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Adicionar produto às Mega Ofertas
            </h4>
            {/* Product search */}
            <div style={{ marginBottom: 10 }}>
              <label style={labelSt}>Buscar produto do catálogo</label>
              <div style={{ position: 'relative' }}>
                <Search size={12} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input value={moSearch} onChange={e => setMoSearch(e.target.value)}
                  placeholder="Digite o nome do produto..." style={{ ...inputSt, paddingLeft: 30 }} />
              </div>
              {moSearch && (
                <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                  {moSearchFiltered.length === 0 && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', padding: 6 }}>Nenhum produto disponível.</span>}
                  {moSearchFiltered.map(p => (
                    <button key={p.id} onClick={() => { setMoSelectedId(p.id); setMoSearch(''); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, background: moSelectedId === p.id ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${moSelectedId === p.id ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', textAlign: 'left' }}>
                      <img src={p.image} alt="" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6, background: 'rgba(255,255,255,0.03)' }} />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>R$ {Number(p.price).toFixed(2)} · {p.category}</div>
                      </div>
                      {moSelectedId === p.id ? <Check size={13} color="#D4AF37" /> : <Plus size={13} color="rgba(255,255,255,0.3)" />}
                    </button>
                  ))}
                </div>
              )}
              {moSelectedId && (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 8, padding: '6px 10px' }}>
                  <Check size={12} color="#D4AF37" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#FFDF73' }}>
                    {products.find(p => p.id === moSelectedId)?.title || moSelectedId}
                  </span>
                  <button onClick={() => setMoSelectedId('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', marginLeft: 'auto', display: 'flex' }}><X size={12} /></button>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={labelSt}>Badge (ex: 47% OFF)</label>
                <input style={inputSt} value={moBadge} onChange={e => setMoBadge(e.target.value)} placeholder="35% OFF" />
              </div>
              <div>
                <label style={labelSt}>Estilo do badge</label>
                <select value={moBadgeStyle} onChange={e => setMoBadgeStyle(e.target.value as any)}
                  style={{ ...inputSt, appearance: 'auto', background: 'rgba(255,255,255,0.04)' }}>
                  <option value="orange" style={{ background: '#0f172a' }}>🟠 Orange</option>
                  <option value="light" style={{ background: '#0f172a' }}>⬜ Light</option>
                </select>
              </div>
              <div>
                <label style={labelSt}>Válido até</label>
                <input style={inputSt} type="datetime-local" value={moValidUntil} onChange={e => setMoValidUntil(e.target.value)} />
              </div>
            </div>

            <button onClick={addMegaOferta} disabled={!moSelectedId || saving} style={{ ...btnGold, opacity: (!moSelectedId || saving) ? 0.5 : 1 }}>
              <Plus size={13} /> Adicionar à Seção
            </button>
          </div>

          {/* List */}
          {megaOfertas.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: '32px 20px' }}>
              <Zap size={28} color="rgba(255,255,255,0.15)" style={{ marginBottom: 10 }} />
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0 }}>Nenhum produto nas Mega Ofertas.<br/>A Home usa 3 produtos de fallback.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {megaOfertas.map((mo, index) => {
                const p = products.find(x => x.id === mo.productId);
                return (
                  <div key={mo.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                    {p && <img src={p.image} alt="" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }} />}
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p ? p.title : mo.productId}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
                        {p && <span style={{ fontSize: 11, fontWeight: 900, color: '#FFDF73' }}>R$ {Number(p.price).toFixed(2)}</span>}
                        {mo.badge && (
                          <span style={{ fontSize: 9, fontWeight: 900, background: mo.badgeStyle === 'orange' ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.1)', color: mo.badgeStyle === 'orange' ? '#f97316' : '#fff', border: `1px solid ${mo.badgeStyle === 'orange' ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.15)'}`, padding: '2px 7px', borderRadius: 99 }}>{mo.badge}</span>
                        )}
                        {mo.validUntil && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>Até {new Date(mo.validUntil).toLocaleDateString('pt-BR')}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button style={btnIconSm()} onClick={() => moveMegaOferta(index, 'up')} disabled={index === 0}><ArrowUp size={12} /></button>
                      <button style={btnIconSm()} onClick={() => moveMegaOferta(index, 'down')} disabled={index === megaOfertas.length - 1}><ArrowDown size={12} /></button>
                      <button style={{ ...btnIconSm('#ef4444'), border: '1px solid rgba(239,68,68,0.2)' }} onClick={() => deleteMegaOferta(mo.id)}><Trash2 size={12} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SUB-ABA: PERÍODOS                                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'periodos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: '0 0 2px', color: '#fff', fontSize: 16, fontWeight: 900 }}>🌅 Configuração de Períodos</h3>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Produtos exibidos em cada horário do dia na Home</p>
          </div>

          {Object.entries(PERIOD_LABELS).map(([periodId, meta]) => {
            const cfg = periodConfig[periodId];
            const isEditing = editingPeriod === periodId;
            const PeriodIcon = meta.icon;
            const active = cfg?.active !== false;
            const isAuto = cfg?.isAuto !== false;

            return (
              <div key={periodId} style={{ ...card, border: isEditing ? '1px solid rgba(212,175,55,0.3)' : '1px solid rgba(255,255,255,0.07)', transition: 'border 0.2s' }}>
                {/* Period Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(212,175,55,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <PeriodIcon size={18} color="#D4AF37" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{cfg?.title || meta.label}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{meta.sub} · {cfg?.productIds?.length || 0} produtos configurados</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <button style={toggle(active)} onClick={() => togglePeriodActive(periodId)}>
                        <div style={toggleKnob(active)} />
                      </button>
                      <span style={{ fontSize: 8, fontWeight: 700, color: active ? '#10b981' : 'rgba(255,255,255,0.3)' }}>Ativo</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <button style={toggle(isAuto)} onClick={() => togglePeriodAuto(periodId)}>
                        <div style={toggleKnob(isAuto)} />
                      </button>
                      <span style={{ fontSize: 8, fontWeight: 700, color: isAuto ? '#818cf8' : 'rgba(255,255,255,0.3)' }}>Auto</span>
                    </div>
                    <button style={btnIconSm('#FFDF73')} onClick={() => {
                      if (isEditing) { setEditingPeriod(null); }
                      else { setEditingPeriod(periodId); setPeriodDraft({ title: cfg?.title || meta.label }); }
                    }}>
                      {isEditing ? <ChevronUp size={12} /> : <Edit2 size={12} />}
                    </button>
                  </div>
                </div>

                {/* Expanded edit */}
                {isEditing && (
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
                    <div>
                      <label style={labelSt}>Título da seção</label>
                      <input style={inputSt} value={periodDraft.title || ''} onChange={e => setPeriodDraft(p => ({ ...p, title: e.target.value }))} placeholder={meta.label} />
                    </div>

                    <div>
                      <label style={{ ...labelSt, marginBottom: 8 }}>Produtos neste período ({cfg?.productIds?.length || 0})</label>
                      <ProductPicker
                        products={products}
                        selectedIds={cfg?.productIds || []}
                        onAdd={id => addProductToPeriod(periodId, id)}
                        onRemove={id => removeProductFromPeriod(periodId, id)}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 8, background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.15)', borderRadius: 10, padding: '10px 14px' }}>
                      <AlertCircle size={14} color="#818cf8" style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600, lineHeight: 1.5 }}>
                        <strong style={{ color: '#818cf8' }}>Modo Auto:</strong> quando ativado, o sistema pode mesclar os produtos configurados com os mais vendidos automaticamente. Desative para controle total.
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <button onClick={() => setEditingPeriod(null)} style={{ ...btnGhost }}>Fechar</button>
                      <button onClick={() => savePeriod(periodId)} disabled={saving} style={{ ...btnGold, opacity: saving ? 0.6 : 1 }}>
                        {saving ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={12} />}
                        Salvar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SUB-ABA: HERO BANNERS                                                */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'heroBanners' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 2px', color: '#fff', fontSize: 16, fontWeight: 900 }}>🎯 Hero Banners</h3>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Carrossel no topo da Home (máx. 3 recomendado)</p>
            </div>
            {!creatingBanner && !editingBannerId && (
              <button onClick={() => { setCreatingBanner(true); setBannerDraft({ order: heroBanners.length }); }} style={btnGold}>
                <Plus size={13} /> Novo Banner
              </button>
            )}
          </div>

          {/* Create / Edit Form */}
          {(creatingBanner || editingBannerId) && (
            <div style={{ ...card, border: '1px solid rgba(212,175,55,0.3)', background: 'rgba(212,175,55,0.03)' }}>
              <h4 style={{ margin: '0 0 16px', color: '#FFDF73', fontSize: 13, fontWeight: 900 }}>
                {creatingBanner ? '+ Novo Banner' : '✏️ Editar Banner'}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelSt}>Título *</label>
                    <input style={inputSt} value={bannerDraft.title || ''} onChange={e => setBannerDraft(b => ({ ...b, title: e.target.value }))} placeholder="Ex: Mega Promoção de Verão" />
                  </div>
                  <div>
                    <label style={labelSt}>Subtítulo</label>
                    <input style={inputSt} value={bannerDraft.subtitle || ''} onChange={e => setBannerDraft(b => ({ ...b, subtitle: e.target.value }))} placeholder="Descrição curta" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelSt}>URL da Imagem</label>
                    <input style={inputSt} value={bannerDraft.image || ''} onChange={e => setBannerDraft(b => ({ ...b, image: e.target.value }))} placeholder="/banner.png ou https://..." />
                  </div>
                  <div>
                    <label style={labelSt}>Link destino</label>
                    <input style={inputSt} value={bannerDraft.link || ''} onChange={e => setBannerDraft(b => ({ ...b, link: e.target.value }))} placeholder="/promotions" />
                  </div>
                  <div>
                    <label style={labelSt}>Texto do botão</label>
                    <input style={inputSt} value={bannerDraft.buttonText || ''} onChange={e => setBannerDraft(b => ({ ...b, buttonText: e.target.value }))} placeholder="Ver Oferta" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelSt}>Badge texto (opcional)</label>
                    <input style={inputSt} value={bannerDraft.badgeText || ''} onChange={e => setBannerDraft(b => ({ ...b, badgeText: e.target.value }))} placeholder="Ex: 🔥 Esta Semana" />
                  </div>
                  <div>
                    <label style={labelSt}>Ordem</label>
                    <input style={inputSt} type="number" value={bannerDraft.order ?? ''} onChange={e => setBannerDraft(b => ({ ...b, order: parseInt(e.target.value) || 0 }))} min="0" />
                  </div>
                </div>

                {/* Preview thumbnail */}
                {bannerDraft.image && (
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                    <img src={bannerDraft.image} alt="Preview" style={{ width: 80, height: 50, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{bannerDraft.title || 'Título do Banner'}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{bannerDraft.subtitle}</div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <button onClick={() => { setCreatingBanner(false); setEditingBannerId(null); setBannerDraft({}); }} style={btnGhost}>Cancelar</button>
                  <button onClick={saveBanner} disabled={saving} style={{ ...btnGold, opacity: saving ? 0.6 : 1 }}>
                    {saving ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
                    {saving ? 'Salvando...' : 'Salvar Banner'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Banner List */}
          {heroBanners.length === 0 && !creatingBanner && (
            <div style={{ ...card, textAlign: 'center', padding: '40px 20px' }}>
              <Image size={32} color="rgba(255,255,255,0.15)" style={{ marginBottom: 12 }} />
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, margin: 0 }}>Nenhum banner configurado.<br/>A Home usa 3 banners padrão do código.</p>
            </div>
          )}

          {heroBanners.map((banner) => (
            <div key={banner.id} style={{ ...card, display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px' }}>
              <div style={{ width: 70, height: 44, borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {banner.image ? (
                  <img src={banner.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : <Image size={18} color="rgba(255,255,255,0.2)" />}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{banner.title}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Link2 size={9} /> {banner.link} · Ordem {banner.order}
                  {banner.badgeText && <span style={{ background: 'rgba(212,175,55,0.1)', color: '#D4AF37', padding: '1px 6px', borderRadius: 99, fontSize: 8, fontWeight: 900 }}>{banner.badgeText}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <button style={btnIconSm('#FFDF73')} onClick={() => {
                  setEditingBannerId(banner.id);
                  setCreatingBanner(false);
                  setBannerDraft({ ...banner });
                }}><Edit2 size={12} /></button>
                <button style={{ ...btnIconSm('#ef4444'), border: '1px solid rgba(239,68,68,0.2)' }} onClick={() => deleteBanner(banner.id)}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SUB-ABA: CAMPANHAS                                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'campanhas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: '0 0 2px', color: '#fff', fontSize: 16, fontWeight: 900 }}>📣 Central de Campanhas</h3>
            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Gerencie campanhas temporárias e promoções segmentadas</p>
          </div>

          <div style={{ ...card, background: 'linear-gradient(135deg, rgba(129,140,248,0.08) 0%, rgba(15,23,42,0.6) 100%)', border: '1px solid rgba(129,140,248,0.2)' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(129,140,248,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Megaphone size={22} color="#818cf8" />
              </div>
              <div>
                <h4 style={{ margin: '0 0 6px', color: '#818cf8', fontSize: 15, fontWeight: 900 }}>Em Desenvolvimento</h4>
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>O sistema de campanhas está sendo planejado com os seguintes recursos:</p>
              </div>
            </div>
          </div>

          {[
            { icon: Target, title: 'Campanhas por Segmento', desc: 'Crie promoções exclusivas para Clientes VIP, Bronze, Novos Clientes ou segmentos personalizados.', color: '#D4AF37' },
            { icon: Clock, title: 'Campanhas com Agendamento', desc: 'Defina datas de início e fim. A campanha ativa e desativa automaticamente.', color: '#10b981' },
            { icon: Zap, title: 'Promoções Flash', desc: 'Ofertas relâmpago com cronômetro visível na Home — cria urgência e aumenta conversão.', color: '#f97316' },
            { icon: Star, title: 'Programa de Indicação', desc: 'Configure recompensas em diamantes para clientes que indicam amigos.', color: '#818cf8' },
            { icon: Tag, title: 'Cupons e Códigos', desc: 'Gere cupons de desconto fixo ou percentual vinculados a campanhas específicas.', color: '#ec4899' },
          ].map((item, i) => {
            const ItemIcon = item.icon;
            return (
              <div key={i} style={{ ...card, display: 'flex', gap: 12, alignItems: 'flex-start', opacity: 0.8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ItemIcon size={17} color={item.color} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginBottom: 3 }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, lineHeight: 1.5 }}>{item.desc}</div>
                </div>
                <span style={{ flexShrink: 0, fontSize: 8, fontWeight: 900, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)', padding: '3px 8px', borderRadius: 99, marginLeft: 'auto' }}>EM BREVE</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
