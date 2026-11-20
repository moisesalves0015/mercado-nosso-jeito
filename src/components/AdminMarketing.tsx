import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Layers, Clock, Zap, Target, Plus, Trash2, Edit2, Check, X,
  ArrowUp, ArrowDown, Eye, EyeOff, Image, Link2, Star, Tag,
  RefreshCw, Search, Megaphone, ChevronUp, Save, UploadCloud,
  AlertCircle, Sunrise, Sun, Sunset, Moon, Wind, Heart, Sparkles,
  Video, Film, LayoutList, Award, Store,
} from 'lucide-react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc, getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { defaultProducts } from '../data/defaultProducts';
import { DEFAULT_HERO_BANNERS } from '../data/defaultHeroBanners';
import { DEFAULT_BRANDS, DEFAULT_LOCAL_PARTNERS } from '../data/defaultHomeExtras';
import { uploadOrCompressImage, uploadBannerMediaFile } from '../services/imageUploadService';
import { useResolvedMediaUrl } from '../services/mediaStorageService';
import { sanitizeBannerImageUrl, cleanImageUrl, handleImageError } from '../utils/imageUrl';
import type {
  VitrineConfig,
  MegaOfertaConfig,
  HeroBannerConfig,
  PeriodConfig,
  CondoFavoriteConfig,
  HomeLayoutBlock,
  RoundCardItem,
} from '../hooks/useHomeConfig';
import { AdminHomeLayoutBuilder } from './admin/AdminHomeLayoutBuilder';
import { AdminRoundCardsManager } from './admin/AdminRoundCardsManager';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  title: string;
  image: string;
  category: string;
  price: number;
  active?: boolean;
}

type SubTab =
  | 'layout'
  | 'vitrines'
  | 'heroBanners'
  | 'brands'
  | 'partners'
  | 'favoritos'
  | 'megaOfertas'
  | 'periodos'
  | 'campanhas';

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

// ─── CRM Light Mode Theme ───────────────────────────────────────────────
const crmTheme = {
  bg: '#f8fafc',
  cardBg: '#ffffff',
  headerBg: 'rgba(255, 255, 255, 0.9)',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  borderLight: '#f1f5f9',
  primary: '#4f46e5',
  primaryLight: 'rgba(79, 70, 229, 0.08)',
  success: '#10b981',
  successLight: 'rgba(16, 185, 129, 0.08)',
  warning: '#f59e0b',
  warningLight: 'rgba(245, 158, 11, 0.08)',
  danger: '#ef4444',
  dangerLight: 'rgba(239, 68, 68, 0.08)',
  accent: '#0ea5e9',
  accentLight: 'rgba(14, 165, 233, 0.08)',
  shadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02)',
  shadowSm: '0 1px 3px rgba(0, 0, 0, 0.05)',
};

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: crmTheme.cardBg,
  border: `1px solid ${crmTheme.border}`,
  borderRadius: 16,
  padding: 20,
  boxShadow: crmTheme.shadow,
};

const inputSt: React.CSSProperties = {
  width: '100%', height: 40,
  background: crmTheme.cardBg,
  border: `1px solid ${crmTheme.border}`,
  borderRadius: 10, padding: '0 12px',
  color: crmTheme.textPrimary, fontSize: 13, outline: 'none',
  boxSizing: 'border-box', fontFamily: 'Manrope, sans-serif',
};

const labelSt: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, color: crmTheme.textSecondary,
  textTransform: 'uppercase', letterSpacing: 0.5,
  display: 'block', marginBottom: 5,
};

const btnGold: React.CSSProperties = {
  background: crmTheme.primary,
  border: 'none', borderRadius: 10, color: '#fff',
  fontWeight: 900, fontSize: 12, padding: '0 16px', height: 38,
  display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
  fontFamily: 'Manrope, sans-serif', flexShrink: 0,
  boxShadow: '0 4px 12px rgba(79,70,229,0.2)',
};

const btnGhost: React.CSSProperties = {
  background: crmTheme.cardBg,
  border: `1px solid ${crmTheme.border}`,
  borderRadius: 8, color: crmTheme.textSecondary,
  fontWeight: 800, fontSize: 11, padding: '0 12px', height: 32,
  display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer',
  fontFamily: 'Manrope, sans-serif',
  boxShadow: crmTheme.shadowSm,
};

const btnIconSm = (color = crmTheme.textSecondary): React.CSSProperties => ({
  background: crmTheme.cardBg, border: `1px solid ${crmTheme.border}`,
  borderRadius: 7, width: 30, height: 30,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color, cursor: 'pointer',
  boxShadow: crmTheme.shadowSm,
});

export const BANNER_PAGES = [
  { id: 'all', label: 'Todas as Páginas', icon: '🌐' },
  { id: 'home', label: 'Home (Topo Hero)', icon: '🏠' },
  { id: 'home-inline', label: 'Home (Entre Vitrines)', icon: '🧩' },
  { id: 'promotions', label: 'Promoções', icon: '🔥' },
  { id: 'bebidas', label: 'Bebidas', icon: '🍻' },
  { id: 'padaria', label: 'Padaria', icon: '🥐' },
  { id: 'tabacaria', label: 'Tabacaria', icon: '🚬' },
  { id: 'eletronicos', label: 'Eletrônicos', icon: '⚡' },
] as const;

export function getPlacementMeta(placement?: string) {
  const p = (placement || 'home').toLowerCase().trim();
  switch (p) {
    case 'home-inline':
      return { label: 'Home (Entre Vitrines)', icon: '🧩', bg: 'rgba(236, 72, 153, 0.15)', text: '#be185d', border: 'rgba(236, 72, 153, 0.35)' };
    case 'promotions':
      return { label: 'Promoções', icon: '🔥', bg: 'rgba(239, 68, 68, 0.15)', text: '#fca5a5', border: 'rgba(239, 68, 68, 0.3)' };
    case 'bebidas':
      return { label: 'Bebidas', icon: '🍻', bg: 'rgba(14, 165, 233, 0.15)', text: '#7dd3fc', border: 'rgba(14, 165, 233, 0.3)' };
    case 'padaria':
      return { label: 'Padaria', icon: '🥐', bg: 'rgba(245, 158, 11, 0.15)', text: '#fcd34d', border: 'rgba(245, 158, 11, 0.3)' };
    case 'tabacaria':
      return { label: 'Tabacaria', icon: '🚬', bg: 'rgba(168, 85, 247, 0.15)', text: '#d8b4fe', border: 'rgba(168, 85, 247, 0.3)' };
    case 'eletronicos':
      return { label: 'Eletrônicos', icon: '⚡', bg: 'rgba(234, 179, 8, 0.15)', text: '#fde047', border: 'rgba(234, 179, 8, 0.3)' };
    case 'all':
      return { label: 'Todas as Páginas', icon: '🌐', bg: 'rgba(99, 102, 241, 0.15)', text: '#a5b4fc', border: 'rgba(99, 102, 241, 0.3)' };
    case 'home':
    default:
      return { label: 'Home', icon: '🏠', bg: 'rgba(16, 185, 129, 0.15)', text: '#6ee7b7', border: 'rgba(16, 185, 129, 0.3)' };
  }
}

const AdminVideoPreview: React.FC<{
  videoSrc: string;
  poster?: string;
  style?: React.CSSProperties;
}> = ({ videoSrc, poster, style }) => {
  const resolved = useResolvedMediaUrl(videoSrc);
  return (
    <video
      src={resolved || undefined}
      poster={poster ? sanitizeBannerImageUrl(poster) : undefined}
      autoPlay
      loop
      muted
      playsInline
      style={{
        objectFit: 'contain',
        background: '#000',
        ...style,
      }}
    />
  );
};

// ─── SubTabBtn — module-level to prevent recreation on every render ────────────
interface SubTabBtnProps {
  id: SubTab;
  label: string;
  icon: React.ElementType;
  badge?: number;
  activeSubTab: SubTab;
  setActiveSubTab: (id: SubTab) => void;
}
function SubTabBtn({ id, label, icon: Icon, badge, activeSubTab, setActiveSubTab }: SubTabBtnProps) {
  const active = activeSubTab === id;
  return (
    <button onClick={() => setActiveSubTab(id)} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
      background: active ? crmTheme.primaryLight : 'transparent',
      color: active ? crmTheme.primary : crmTheme.textSecondary,
      fontWeight: 800, fontSize: 12, fontFamily: 'Manrope, sans-serif',
      flexShrink: 0, position: 'relative',
      borderBottom: active ? `2px solid ${crmTheme.primary}` : '2px solid transparent',
    }}>
      <Icon size={14} /> {label}
      {badge !== undefined && badge > 0 && (
        <span style={{ background: crmTheme.primary, color: '#fff', fontSize: 9, fontWeight: 900, width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>
      )}
    </button>
  );
}

const toggle = (active: boolean): React.CSSProperties => ({
  width: 38, height: 22, borderRadius: 99, border: 'none', cursor: 'pointer',
  background: active ? crmTheme.success : '#cbd5e1',
  position: 'relative', transition: 'all 0.2s ease', flexShrink: 0,
});

const toggleKnob = (active: boolean): React.CSSProperties => ({
  position: 'absolute', top: 3, left: active ? 19 : 3,
  width: 16, height: 16, borderRadius: '50%',
  background: '#fff',
  transition: 'all 0.2s ease',
  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
});

// ─── PRODUCT SEARCH & REORDER PICKER ──────────────────────────────────────────
const ProductPicker: React.FC<{
  products: Product[];
  selectedIds: string[];
  onChangeIds?: (ids: string[]) => void;
  onAdd?: (id: string) => void;
  onRemove?: (id: string) => void;
  defaultCategory?: string;
  emptyHint?: string;
}> = ({ products, selectedIds, onChangeIds, onAdd, onRemove, defaultCategory, emptyHint }) => {
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState(defaultCategory || 'all');

  // Categorias únicas derivadas do catálogo
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Reordenação manual para cima/baixo na vitrine
  const moveItem = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= selectedIds.length) return;
    const next = [...selectedIds];
    const temp = next[index];
    next[index] = next[target];
    next[target] = temp;
    if (onChangeIds) onChangeIds(next);
  };

  const removeItem = (id: string) => {
    if (onRemove) onRemove(id);
    if (onChangeIds) onChangeIds(selectedIds.filter((x) => x !== id));
  };

  const addItem = (id: string) => {
    if (!selectedIds.includes(id)) {
      if (onAdd) onAdd(id);
      if (onChangeIds) onChangeIds([...selectedIds, id]);
    }
  };

  const addAllFromCategory = () => {
    const candidates = products
      .filter((p) => catFilter === 'all' || p.category.toLowerCase() === catFilter.toLowerCase())
      .map((p) => p.id);
    const combined = Array.from(new Set([...selectedIds, ...candidates]));
    if (onChangeIds) onChangeIds(combined);
    else if (onAdd) {
      candidates.forEach((id) => {
        if (!selectedIds.includes(id)) onAdd(id);
      });
    }
  };

  const clearAll = () => {
    if (window.confirm('Remover todos os produtos selecionados desta lista?')) {
      if (onChangeIds) onChangeIds([]);
      else if (onRemove) {
        selectedIds.forEach((id) => onRemove(id));
      }
    }
  };

  // Produtos disponíveis filtrados por categoria e texto
  const availableProducts = React.useMemo(() => {
    return products.filter((p) => {
      const matchCat =
        catFilter === 'all' || p.category.toLowerCase() === catFilter.toLowerCase();
      const matchQ =
        !q ||
        p.title.toLowerCase().includes(q.toLowerCase()) ||
        p.id.toLowerCase().includes(q.toLowerCase());
      return matchCat && matchQ;
    });
  }, [products, catFilter, q]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* SEÇÃO 1: PRODUTOS VINCULADOS & ORDEM EXATA */}
      <div
        style={{
          background: crmTheme.bg,
          padding: 12,
          borderRadius: 10,
          border: `1px solid ${crmTheme.border}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 800, color: crmTheme.textPrimary }}>
            Ordem dos Produtos na Vitrine ({selectedIds.length})
          </span>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              style={{
                fontSize: 11,
                color: crmTheme.danger,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Limpar todos
            </button>
          )}
        </div>

        {selectedIds.length === 0 ? (
          <div
            style={{
              padding: '16px 8px',
              textAlign: 'center',
              color: crmTheme.textMuted,
              fontSize: 12,
            }}
          >
            {emptyHint || (
              <>
                Nenhum produto fixado manualmente nesta vitrine.
                <br />
                <span style={{ fontSize: 11 }}>
                  Adicione produtos abaixo para definir a ordem exata ou selecione uma categoria para modo automático.
                </span>
              </>
            )}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxHeight: 250,
              overflowY: 'auto',
              paddingRight: 4,
            }}
          >
            {selectedIds.map((id, index) => {
              const p = products.find((x) => x.id === id);
              return (
                <div
                  key={id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: crmTheme.cardBg,
                    border: `1px solid ${crmTheme.border}`,
                    borderRadius: 8,
                    padding: '6px 10px',
                    boxShadow: crmTheme.shadowSm,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 900,
                      color: crmTheme.primary,
                      background: crmTheme.primaryLight,
                      padding: '2px 6px',
                      borderRadius: 99,
                      minWidth: 26,
                      textAlign: 'center',
                    }}
                  >
                    {index + 1}º
                  </span>

                  {p && (
                    <img
                      src={cleanImageUrl(p.image)}
                      onError={handleImageError}
                      alt=""
                      style={{
                        width: 28,
                        height: 28,
                        objectFit: 'contain',
                        borderRadius: 4,
                        background: '#fff',
                        border: `1px solid ${crmTheme.border}`,
                      }}
                    />
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: crmTheme.textPrimary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {p ? p.title : id}
                    </div>
                    {p && (
                      <div style={{ fontSize: 10, color: crmTheme.textSecondary }}>
                        {p.category} · R$ {Number(p.price).toFixed(2)}
                      </div>
                    )}
                  </div>

                  {/* Controles de Ordem e Remoção */}
                  <div style={{ display: 'flex', gap: 3 }}>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveItem(index, 'up')}
                      title="Mover para cima / antes"
                      style={{
                        padding: '4px 7px',
                        borderRadius: 4,
                        border: `1px solid ${crmTheme.border}`,
                        background: index === 0 ? 'transparent' : crmTheme.bg,
                        color: index === 0 ? crmTheme.textMuted : crmTheme.textPrimary,
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={index === selectedIds.length - 1}
                      onClick={() => moveItem(index, 'down')}
                      title="Mover para baixo / depois"
                      style={{
                        padding: '4px 7px',
                        borderRadius: 4,
                        border: `1px solid ${crmTheme.border}`,
                        background:
                          index === selectedIds.length - 1 ? 'transparent' : crmTheme.bg,
                        color:
                          index === selectedIds.length - 1
                            ? crmTheme.textMuted
                            : crmTheme.textPrimary,
                        cursor: index === selectedIds.length - 1 ? 'not-allowed' : 'pointer',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(id)}
                      title="Remover produto da vitrine"
                      style={{
                        padding: '4px 7px',
                        borderRadius: 4,
                        border: `1px solid ${crmTheme.dangerLight}`,
                        background: crmTheme.dangerLight,
                        color: crmTheme.danger,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SEÇÃO 2: CATÁLOGO DE PRODUTOS PARA ADICIONAR LIVREMENTE */}
      <div
        style={{
          background: crmTheme.cardBg,
          border: `1px solid ${crmTheme.border}`,
          borderRadius: 10,
          padding: 12,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: crmTheme.textPrimary,
            marginBottom: 8,
          }}
        >
          Adicionar Produtos do Catálogo
        </div>

        {/* Filtros: Categoria e Busca */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            style={{ ...inputSt, height: 34, appearance: 'auto' }}
          >
            <option value="all">Todas as Categorias</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <div style={{ position: 'relative' }}>
            <Search
              size={12}
              color={crmTheme.textMuted}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ ...inputSt, paddingLeft: 30, height: 34 }}
            />
          </div>
        </div>

        {/* Botão de lote para categoria */}
        {catFilter !== 'all' && (
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={addAllFromCategory}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: crmTheme.primary,
                background: crmTheme.primaryLight,
                border: `1px solid ${crmTheme.primary}`,
                borderRadius: 6,
                padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              + Adicionar todos de "{catFilter}"
            </button>
          </div>
        )}

        {/* Lista de produtos para adicionar */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            maxHeight: 200,
            overflowY: 'auto',
          }}
        >
          {availableProducts.length === 0 ? (
            <span
              style={{
                fontSize: 11,
                color: crmTheme.textMuted,
                padding: '10px 4px',
                textAlign: 'center',
              }}
            >
              Nenhum produto encontrado com os filtros atuais.
            </span>
          ) : (
            availableProducts.map((p) => {
              const isSelected = selectedIds.includes(p.id);
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: isSelected ? crmTheme.bg : crmTheme.cardBg,
                    border: `1px solid ${isSelected ? crmTheme.primaryLight : crmTheme.border}`,
                    borderRadius: 8,
                    padding: '5px 10px',
                  }}
                >
                  <img
                    src={cleanImageUrl(p.image)}
                    onError={handleImageError}
                    alt=""
                    style={{
                      width: 28,
                      height: 28,
                      objectFit: 'contain',
                      borderRadius: 4,
                      background: '#fff',
                      border: `1px solid ${crmTheme.border}`,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: crmTheme.textPrimary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {p.title}
                    </div>
                    <div style={{ fontSize: 10, color: crmTheme.textSecondary }}>
                      {p.category} · R$ {Number(p.price).toFixed(2)}
                    </div>
                  </div>

                  {isSelected ? (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: crmTheme.success,
                        background: crmTheme.successLight,
                        padding: '2px 8px',
                        borderRadius: 99,
                      }}
                    >
                      ✓ Na vitrine
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addItem(p.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        background: crmTheme.primaryLight,
                        border: `1px solid ${crmTheme.primary}`,
                        borderRadius: 6,
                        padding: '3px 8px',
                        fontSize: 11,
                        fontWeight: 700,
                        color: crmTheme.primary,
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={11} /> Adicionar
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
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
    Array.isArray(initial.subtitle) ? initial.subtitle.join(' | ') : initial.subtitle || ''
  );
  const [theme, setTheme] = useState<VitrineConfig['theme']>(initial.theme || 'purple');
  const [order, setOrder] = useState(String(initial.order ?? 0));
  const [maxProducts, setMaxProducts] = useState(String(initial.maxProducts ?? 8));
  const [validFrom, setValidFrom] = useState(initial.validFrom || '');
  const [validUntil, setValidUntil] = useState(initial.validUntil || '');
  const [productIds, setProductIds] = useState<string[]>(initial.productIds || []);
  const [active, setActive] = useState(initial.active !== false);
  const [category, setCategory] = useState(initial.category || '');
  const [layout, setLayout] = useState<VitrineConfig['layout']>(initial.layout || 'horizontal');

  // Categorias disponíveis no catálogo
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  // Preenchimento automático inteligente por categoria
  const handleFillFromCategory = () => {
    const targetCat = category.trim() || title.trim();
    if (!targetCat) {
      alert('Selecione uma categoria abaixo ou defina o título da vitrine.');
      return;
    }
    const catProds = products
      .filter((p) => p.category.toLowerCase() === targetCat.toLowerCase())
      .map((p) => p.id);
    if (catProds.length === 0) {
      alert(`Nenhum produto encontrado para a categoria "${targetCat}".`);
      return;
    }
    setProductIds(catProds);
    alert(`${catProds.length} produtos carregados! Agora você pode reorganizar a ordem como preferir.`);
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      alert('Informe o título da vitrine.');
      return;
    }
    const subs = subtitle.trim()
      ? subtitle
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    onSave({
      title: title.trim(),
      subtitle: subs && subs.length === 1 ? subs[0] : subs || undefined,
      theme,
      active,
      order: parseInt(order) || 0,
      maxProducts: parseInt(maxProducts) || 8,
      productIds,
      category: category.trim() || undefined,
      layout,
      validFrom: validFrom || null,
      validUntil: validUntil || null,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelSt}>Título da Vitrine *</label>
          <input
            style={inputSt}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Bebidas Geladas"
          />
        </div>
        <div>
          <label style={labelSt}>Subtítulo (separe slogans com |)</label>
          <input
            style={inputSt}
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Gelada é aqui! 🧊 | As melhores marcas"
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelSt}>Categoria Vinculada</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ ...inputSt, background: crmTheme.cardBg, appearance: 'auto' }}
          >
            <option value="">Sem categoria fixa (Livre)</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelSt}>Tema Visual</label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as VitrineConfig['theme'])}
            style={{ ...inputSt, background: crmTheme.cardBg, appearance: 'auto' }}
          >
            {THEME_OPTIONS.map((t) => (
              <option
                key={t.value}
                value={t.value}
                style={{ background: crmTheme.cardBg, color: crmTheme.textPrimary }}
              >
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelSt}>Layout</label>
          <select
            value={layout}
            onChange={(e) => setLayout(e.target.value as VitrineConfig['layout'])}
            style={{ ...inputSt, background: crmTheme.cardBg, appearance: 'auto' }}
          >
            <option value="horizontal">Carrossel Horizontal</option>
            <option value="grid">Grade (Grid)</option>
          </select>
        </div>
        <div>
          <label style={labelSt}>Máx. Produtos</label>
          <input
            style={inputSt}
            type="number"
            value={maxProducts}
            onChange={(e) => setMaxProducts(e.target.value)}
            min="1"
            max="30"
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelSt}>Ordem de Exibição na Home</label>
          <input
            style={inputSt}
            type="number"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
            min="0"
          />
        </div>
        <div>
          <label style={labelSt}>Válido a partir de</label>
          <input
            style={inputSt}
            type="datetime-local"
            value={validFrom}
            onChange={(e) => setValidFrom(e.target.value)}
          />
        </div>
        <div>
          <label style={labelSt}>Válido até</label>
          <input
            style={inputSt}
            type="datetime-local"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={toggle(active)} onClick={() => setActive(!active)}>
            <div style={toggleKnob(active)} />
          </button>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: active ? crmTheme.success : crmTheme.textMuted,
            }}
          >
            {active ? 'Vitrine ativa na Home' : 'Vitrine pausada/inativa'}
          </span>
        </div>

        {category && (
          <button
            type="button"
            onClick={handleFillFromCategory}
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: crmTheme.accent,
              background: crmTheme.accentLight,
              border: `1px solid ${crmTheme.accent}`,
              borderRadius: 6,
              padding: '5px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <RefreshCw size={12} /> Preencher com produtos de "{category}"
          </button>
        )}
      </div>

      <div>
        <ProductPicker
          products={products}
          selectedIds={productIds}
          onChangeIds={setProductIds}
          defaultCategory={category}
        />
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          paddingTop: 8,
          borderTop: `1px solid ${crmTheme.border}`,
        }}
      >
        <button onClick={onCancel} style={btnGhost}>
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{ ...btnGold, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? (
            <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
          ) : (
            <Save size={13} />
          )}
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
  const [condoFavorites, setCondoFavorites] = useState<CondoFavoriteConfig[]>([]);
  const [homeLayout, setHomeLayout] = useState<HomeLayoutBlock[]>([]);
  const [brands, setBrands] = useState<RoundCardItem[]>([]);
  const [localPartners, setLocalPartners] = useState<RoundCardItem[]>([]);

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
  const [uploadingPeriodBg, setUploadingPeriodBg] = useState(false);
  const periodBgInputRef = useRef<HTMLInputElement>(null);

  // Hero Banners
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [creatingBanner, setCreatingBanner] = useState(false);
  const [bannerDraft, setBannerDraft] = useState<Partial<HeroBannerConfig>>({});
  const [bannerPageFilter, setBannerPageFilter] = useState<string>('all');
  const [uploadingBannerImg, setUploadingBannerImg] = useState(false);
  const [uploadingBannerRowId, setUploadingBannerRowId] = useState<string | null>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const rowFileInputRef = useRef<HTMLInputElement>(null);
  const uploadingBannerRowTarget = useRef<HeroBannerConfig | null>(null);

  // ── Load Firestore ──────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'products'), snap => {
        const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Product));
        setProducts(list);
      }),
      onSnapshot(collection(db, 'home-config', 'data', 'vitrines'), snap => {
        setVitrines(snap.docs.map(d => ({ id: d.id, ...d.data() } as VitrineConfig)).sort((a, b) => a.order - b.order));
      }),
      onSnapshot(collection(db, 'home-config', 'data', 'mega-ofertas'), snap => {
        setMegaOfertas(snap.docs.map(d => ({ id: d.id, ...d.data() } as MegaOfertaConfig)).sort((a, b) => a.order - b.order));
      }),
      onSnapshot(collection(db, 'home-config', 'data', 'period-config'), snap => {
        const data: Record<string, PeriodConfig> = {};
        snap.docs.forEach(d => { data[d.id] = { id: d.id as string, ...d.data() } as PeriodConfig; });
        setPeriodConfig(data);
      }),
      onSnapshot(collection(db, 'home-config', 'data', 'hero-banners'), snap => {
        setHeroBanners(snap.docs.map(d => ({ id: d.id, ...d.data() } as HeroBannerConfig)).sort((a, b) => a.order - b.order));
      }),
      onSnapshot(collection(db, 'home-config', 'data', 'condo-favorites'), snap => {
        setCondoFavorites(snap.docs.map(d => ({ id: d.id, ...d.data() } as CondoFavoriteConfig)).sort((a, b) => a.order - b.order));
      }),
      onSnapshot(collection(db, 'home-config', 'data', 'home-layout'), snap => {
        setHomeLayout(snap.docs.map(d => ({ id: d.id, ...d.data() } as HomeLayoutBlock)).sort((a, b) => a.order - b.order));
      }),
      onSnapshot(collection(db, 'home-config', 'data', 'home-brands'), snap => {
        setBrands(snap.docs.map(d => ({ id: d.id, ...d.data() } as RoundCardItem)).sort((a, b) => a.order - b.order));
      }),
      onSnapshot(collection(db, 'home-config', 'data', 'home-partners'), snap => {
        setLocalPartners(snap.docs.map(d => ({ id: d.id, ...d.data() } as RoundCardItem)).sort((a, b) => a.order - b.order));
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  // ── Vitrine Ops ─────────────────────────────────────────────────────────────
  const saveVitrine = useCallback(async (data: Partial<VitrineConfig>, id?: string) => {
    setSaving(true);
    try {
      // Remove any undefined properties before sending to Firestore
      const cleanedData: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(data)) {
        if (v !== undefined) {
          cleanedData[k] = v;
        }
      }
      if (id) {
        await updateDoc(doc(db, 'home-config', 'data', 'vitrines', id), cleanedData);
      } else {
        await addDoc(collection(db, 'home-config', 'data', 'vitrines'), cleanedData);
      }
      setEditingVitrineId(null);
      setCreatingVitrine(false);
    } catch (e: unknown) { alert('Erro: ' + (e instanceof Error ? e.message : String(e))); }
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

  const handleGenerateDefaultVitrines = async () => {
    if (!window.confirm('Deseja criar ou atualizar as vitrines padrão para todas as categorias?')) return;
    setSaving(true);
    try {
      const normalizeStr = (str: string) => 
        (str || "").toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      const productsByCategory: Record<string, string[]> = {};
      products.forEach(p => {
        const cat = p.category;
        if (!cat) return;
        const normalizedCat = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
        if (!productsByCategory[normalizedCat]) {
          productsByCategory[normalizedCat] = [];
        }
        productsByCategory[normalizedCat].push(p.id);
      });

      const existingVitrinesMap = new Map(vitrines.map(v => [normalizeStr(v.title), v]));

      const targetCategories = [
        { title: "Bebidas", theme: "purple" as const, subtitle: ["Gelada é aqui! 🧊", "As melhores marcas", "Refresque seu dia"] },
        { title: "Alimentos", theme: "orange" as const, subtitle: ["Descubra novidades exclusivas!", "Sabor inconfundível", "Ofertas especiais"] },
        { title: "Limpeza", theme: "green" as const, subtitle: ["Deixo tudo brilhando ✨", "Limpeza pesada", "Fragrâncias únicas"] },
        { title: "Promoções", theme: "orange" as const, subtitle: "As melhores ofertas da semana!" },
        { title: "Padaria", theme: "orange" as const, subtitle: "Pães quentinhos e doces frescos!" },
        { title: "Congelados", theme: "purple" as const, subtitle: "Praticidade para o seu dia a dia!" },
        { title: "Pet Shop", theme: "green" as const, subtitle: "Tudo para o seu melhor amigo!" },
        { title: "Salgadinhos", theme: "purple" as const, subtitle: "Para curtir aquele filme ou jogo!" },
        { title: "Doces", theme: "orange" as const, subtitle: "Açúcar e felicidade em cada mordida!" },
        { title: "Biscoitos", theme: "orange" as const, subtitle: "Perfeitos para acompanhar o café!" },
        { title: "Beleza", theme: "purple" as const, subtitle: "Seu ritual de cuidados diários!" },
        { title: "Eletrônicos", theme: "purple" as const, subtitle: "Tecnologia de ponta ao seu alcance!" },
        { title: "Tabacaria", theme: "green" as const, subtitle: "Variedade de sedas, isqueiros e importados!" },
        { title: "Sorvetes", theme: "purple" as const, subtitle: "Refresque-se com o melhor sabor!" },
        { title: "Utilidades", theme: "green" as const, subtitle: "Facilidades para o seu lar!" },
        { title: "Churrasco", theme: "orange" as const, subtitle: "Tudo para o churrasco perfeito!" },
        { title: "Adega", theme: "purple" as const, subtitle: "Vinhos e destilados selecionados!" },
        { title: "Bomboniere", theme: "orange" as const, subtitle: "Guloseimas irresistíveis!" },
        { title: "Higiene", theme: "green" as const, subtitle: "Sua saúde e higiene pessoal em dia!" },
        { title: "Fitness", theme: "purple" as const, subtitle: "Itens para manter a energia e o foco!" },
        { title: "Combos", theme: "orange" as const, subtitle: "Leve mais por muito menos!" },
        { title: "Favoritos do Condomínio", theme: "orange" as const, subtitle: "Os preferidos da nossa comunidade!" }
      ];

      let order = vitrines.reduce((max, v) => Math.max(max, v.order ?? 0), 0) + 1;
      let createdCount = 0;
      let updatedCount = 0;

      for (const cat of targetCategories) {
        let matchedProductIds: string[] = [];
        if (cat.title === "Favoritos do Condomínio") {
          matchedProductIds = ['coca-cola-350ml', 'monster-energy', 'heineken-330ml', 'paodequeijo-novo', 'cafe-novo', 'suco-dobem', 'pao-de-forma', 'queijo-minas', 'manteiga-itambe', 'peito-de-peru'];
        } else {
          const categoryKey = Object.keys(productsByCategory).find(
            k => normalizeStr(k) === normalizeStr(cat.title)
          );
          
          if (categoryKey) {
            matchedProductIds = productsByCategory[categoryKey];
          } else {
            matchedProductIds = products
              .filter(p => normalizeStr(p.category || "") === normalizeStr(cat.title) || normalizeStr(p.title || "").includes(normalizeStr(cat.title)))
              .map(p => p.id);
          }
        }

        const slug = cat.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
        const docRef = doc(db, "home-config", "data", "vitrines", slug);
        const existingVitrine = existingVitrinesMap.get(normalizeStr(cat.title));

        if (!existingVitrine) {
          await setDoc(docRef, {
            title: cat.title,
            subtitle: cat.subtitle,
            theme: cat.theme,
            active: true,
            order: order++,
            layout: "horizontal",
            maxProducts: cat.title === "Favoritos do Condomínio" ? 10 : 6,
            productIds: matchedProductIds.slice(0, cat.title === "Favoritos do Condomínio" ? 10 : 6)
          });
          createdCount++;
        } else {
          await updateDoc(docRef, {
            productIds: matchedProductIds.slice(0, cat.title === "Favoritos do Condomínio" ? 10 : 6)
          });
          updatedCount++;
        }
      }

      alert(`${createdCount} vitrines criadas e ${updatedCount} vitrines atualizadas com sucesso!`);
    } catch (e: unknown) {
      alert('Erro ao criar vitrines: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  const handleResetProductsAndVitrines = async () => {
    if (!window.confirm('Deseja restaurar TODOS os produtos padrão e vitrines no banco de dados (Firestore)? Isso adicionará todos os produtos ausentes e atualizará os dados existentes.')) return;
    setSaving(true);
    try {
      // Helper function to normalize strings for comparison without accents and in lowercase
      const normalizeStr = (str: string) => 
        (str || "").toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // 1. Write all default products to Firestore if they do not exist
      let productsCreated = 0;
      let productsUpdated = 0;
      for (const p of defaultProducts) {
        const docRef = doc(db, 'products', p.id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) {
          await setDoc(docRef, p);
          productsCreated++;
        } else {
          const existing = docSnap.data();
          const pPrice = Number(p.price);
          const pCost = p.costPrice !== undefined ? Number(p.costPrice) : undefined;

          const hasChanges = 
            existing.title !== p.title ||
            existing.image !== p.image ||
            existing.category !== p.category ||
            existing.price !== pPrice ||
            (existing.costPrice !== pCost && pCost !== undefined) ||
            existing.description !== p.description;

          if (hasChanges) {
            await setDoc(docRef, p, { merge: true });
            productsUpdated++;
          }
        }
      }

      // Fetch the latest products list from Firestore to group them
      const productsSnap = await getDocs(collection(db, "products"));
      const allProds = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Product);

      const productsByCategory: Record<string, string[]> = {};
      allProds.forEach(p => {
        const cat = p.category;
        if (!cat) return;
        const normalizedCat = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
        if (!productsByCategory[normalizedCat]) {
          productsByCategory[normalizedCat] = [];
        }
        productsByCategory[normalizedCat].push(p.id);
      });

      // 2. Fetch existing vitrines
      const vitrinesSnap = await getDocs(collection(db, "home-config", "data", "vitrines"));
      const existingVitrines = vitrinesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as VitrineConfig));
      const existingVitrinesMap = new Map(existingVitrines.map(v => [normalizeStr(v.title), v]));

      const targetCategories = [
        { title: "Bebidas", theme: "purple" as const, subtitle: ["Gelada é aqui! 🧊", "As melhores marcas", "Refresque seu dia"] },
        { title: "Alimentos", theme: "orange" as const, subtitle: ["Descubra novidades exclusivas!", "Sabor inconfundível", "Ofertas especiais"] },
        { title: "Limpeza", theme: "green" as const, subtitle: ["Deixo tudo brilhando ✨", "Limpeza pesada", "Fragrâncias únicas"] },
        { title: "Promoções", theme: "orange" as const, subtitle: "As melhores ofertas da semana!" },
        { title: "Padaria", theme: "orange" as const, subtitle: "Pães quentinhos e doces frescos!" },
        { title: "Congelados", theme: "purple" as const, subtitle: "Praticidade para o seu dia a dia!" },
        { title: "Pet Shop", theme: "green" as const, subtitle: "Tudo para o seu melhor amigo!" },
        { title: "Salgadinhos", theme: "purple" as const, subtitle: "Para curtir aquele filme ou jogo!" },
        { title: "Doces", theme: "orange" as const, subtitle: "Açúcar e felicidade em cada mordida!" },
        { title: "Biscoitos", theme: "orange" as const, subtitle: "Perfeitos para acompanhar o café!" },
        { title: "Beleza", theme: "purple" as const, subtitle: "Seu ritual de cuidados diários!" },
        { title: "Eletrônicos", theme: "purple" as const, subtitle: "Tecnologia de ponta ao seu alcance!" },
        { title: "Tabacaria", theme: "green" as const, subtitle: "Variedade de sedas, isqueiros e importados!" },
        { title: "Sorvetes", theme: "purple" as const, subtitle: "Refresque-se com o melhor sabor!" },
        { title: "Utilidades", theme: "green" as const, subtitle: "Facilidades para o seu lar!" },
        { title: "Churrasco", theme: "orange" as const, subtitle: "Tudo para o churrasco perfeito!" },
        { title: "Adega", theme: "purple" as const, subtitle: "Vinhos e destilados selecionados!" },
        { title: "Bomboniere", theme: "orange" as const, subtitle: "Guloseimas irresistíveis!" },
        { title: "Higiene", theme: "green" as const, subtitle: "Sua saúde e higiene pessoal em dia!" },
        { title: "Fitness", theme: "purple" as const, subtitle: "Itens para manter a energia e o foco!" },
        { title: "Combos", theme: "orange" as const, subtitle: "Leve mais por muito menos!" }
      ];

      let order = existingVitrines.reduce((max, v) => Math.max(max, v.order ?? 0), 0) + 1;
      let vitrinesCreated = 0;
      let vitrinesUpdated = 0;

      for (const cat of targetCategories) {
        let matchedProductIds: string[] = [];
        if (cat.title === "Favoritos do Condomínio") {
          matchedProductIds = ['coca-cola-350ml', 'monster-energy', 'heineken-330ml', 'paodequeijo-novo', 'cafe-novo', 'suco-dobem', 'pao-de-forma', 'queijo-minas', 'manteiga-itambe', 'peito-de-peru'];
        } else {
          const categoryKey = Object.keys(productsByCategory).find(
            k => normalizeStr(k) === normalizeStr(cat.title)
          );
          
          if (categoryKey) {
            matchedProductIds = productsByCategory[categoryKey];
          } else {
            matchedProductIds = allProds
              .filter(p => normalizeStr(p.category || "") === normalizeStr(cat.title) || normalizeStr(p.title || "").includes(normalizeStr(cat.title)))
              .map(p => p.id);
          }
        }

        const slug = cat.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
        const docRef = doc(db, "home-config", "data", "vitrines", slug);
        const existingVitrine = existingVitrinesMap.get(normalizeStr(cat.title));

        if (!existingVitrine) {
          await setDoc(docRef, {
            title: cat.title,
            subtitle: cat.subtitle,
            theme: cat.theme,
            active: true,
            order: order++,
            layout: "horizontal",
            maxProducts: cat.title === "Favoritos do Condomínio" ? 10 : 6,
            productIds: matchedProductIds.slice(0, cat.title === "Favoritos do Condomínio" ? 10 : 6)
          });
          vitrinesCreated++;
        } else {
          await updateDoc(docRef, {
            productIds: matchedProductIds.slice(0, cat.title === "Favoritos do Condomínio" ? 10 : 6)
          });
          vitrinesUpdated++;
        }
      }

      // Update local storage to match
      localStorage.setItem('app-products', JSON.stringify(allProds));
      // Dispatch update event
      window.dispatchEvent(new Event('app-products-updated'));

      alert(`Sucesso! ${productsCreated} produtos criados, ${productsUpdated} atualizados. ${vitrinesCreated} vitrines criadas e ${vitrinesUpdated} vitrines populadas.`);
    } catch (e: unknown) {
      alert('Erro: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  // ── Condo Favorites Ops ─────────────────────────────────────────────────────
  const handleUpdateCondoFavorites = useCallback(async (newIds: string[]) => {
    setSaving(true);
    try {
      const currentIds = condoFavorites.map(f => f.productId);
      const toRemove = currentIds.filter(id => !newIds.includes(id));
      for (const pid of toRemove) {
        await deleteDoc(doc(db, 'home-config', 'data', 'condo-favorites', pid));
      }
      for (let i = 0; i < newIds.length; i++) {
        const pid = newIds[i];
        await setDoc(doc(db, 'home-config', 'data', 'condo-favorites', pid), {
          id: pid,
          productId: pid,
          order: i,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }
      // Sincroniza também a vitrine regular 'favoritos-do-condominio' se ela existir
      const vitrineRef = doc(db, 'home-config', 'data', 'vitrines', 'favoritos-do-condominio');
      const vSnap = await getDoc(vitrineRef);
      if (vSnap.exists()) {
        await updateDoc(vitrineRef, { productIds: newIds });
      }
    } catch (e: unknown) {
      alert('Erro ao atualizar favoritos do condomínio: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }, [condoFavorites]);

  const seedDefaultCondoFavorites = useCallback(async () => {
    const defaultIds = [
      'coca-cola-350ml',
      'monster-energy',
      'heineken-330ml',
      'paodequeijo-novo',
      'cafe-novo',
      'suco-dobem',
      'pao-de-forma',
      'queijo-minas',
      'manteiga-itambe',
      'peito-de-peru',
    ];
    await handleUpdateCondoFavorites(defaultIds);
    alert('10 produtos favoritos sugeridos foram carregados com sucesso!');
  }, [handleUpdateCondoFavorites]);

  // ── Mega Oferta Ops ─────────────────────────────────────────────────────────
  const addMegaOferta = useCallback(async () => {
    if (!moSelectedId) { alert('Selecione um produto.'); return; }
    setSaving(true);
    try {
      const docData: Record<string, unknown> = {
        productId: moSelectedId,
        badgeStyle: moBadgeStyle,
        order: megaOfertas.length,
        validUntil: moValidUntil || null,
      };
      if (moBadge && moBadge.trim()) {
        docData.badge = moBadge.trim();
      }
      await addDoc(collection(db, 'home-config', 'data', 'mega-ofertas'), docData);
      setMoSelectedId(''); setMoBadge(''); setMoValidUntil('');
    } catch (e: unknown) { alert('Erro: ' + (e instanceof Error ? e.message : String(e))); }
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
    } catch (e: unknown) { alert('Erro: ' + (e instanceof Error ? e.message : String(e))); }
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

  const updatePeriodProductIds = useCallback(async (periodId: string, ids: string[]) => {
    const current = periodConfig[periodId] || { id: periodId, title: PERIOD_LABELS[periodId]?.label, active: true, productIds: [], isAuto: false };
    await setDoc(doc(db, 'home-config', 'data', 'period-config', periodId), { ...current, productIds: ids }, { merge: true });
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
  const ensureDefaultBannersSeeded = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'home-config', 'data', 'hero-banners'));
      if (!snap.empty) return;
      for (const def of DEFAULT_HERO_BANNERS) {
        await setDoc(
          doc(db, 'home-config', 'data', 'hero-banners', def.id),
          {
            title: def.title,
            subtitle: def.subtitle,
            image: def.image,
            link: def.link,
            buttonText: def.buttonText,
            badgeText: def.badgeText || '',
            highlightWords: def.highlightWords || [],
            order: def.order,
            active: def.active !== false,
            placement: def.placement || 'home',
            mediaType: def.mediaType || 'image',
            videoUrl: def.videoUrl || '',
            posterImage: def.posterImage || '',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    } catch (err) {
      console.warn('[ensureDefaultBannersSeeded] Falha ao verificar ou semear banners padrão:', err);
    }
  }, []);

  const seedAllPageBanners = useCallback(async () => {
    if (!confirm('Deseja carregar os banners sugeridos para todas as páginas (Home, Promoções, Bebidas, Padaria, Tabacaria e Eletrônicos)? Banners existentes serão preservados.')) return;
    setSaving(true);
    try {
      for (const def of DEFAULT_HERO_BANNERS) {
        await setDoc(
          doc(db, 'home-config', 'data', 'hero-banners', def.id),
          {
            title: def.title,
            subtitle: def.subtitle,
            image: def.image,
            link: def.link,
            buttonText: def.buttonText,
            badgeText: def.badgeText || '',
            highlightWords: def.highlightWords || [],
            order: def.order,
            active: def.active !== false,
            placement: def.placement || 'home',
            mediaType: def.mediaType || 'image',
            videoUrl: def.videoUrl || '',
            posterImage: def.posterImage || '',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
      alert('Banners padrão carregados com sucesso para todas as páginas!');
    } catch (err) {
      alert('Erro ao carregar banners das páginas: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }, []);

  const handleBannerImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBannerImg(true);
    try {
      const result = await uploadBannerMediaFile(file);
      if (result.mediaType === 'video') {
        setBannerDraft(prev => ({
          ...prev,
          videoUrl: result.url,
          mediaType: 'video',
          posterImage: result.posterImage || prev.posterImage || '',
          aspectRatio: result.aspectRatio || prev.aspectRatio || '',
          image: result.posterImage || prev.image || '',
        }));
        alert('Vídeo carregado com sucesso! Clique em "Salvar Banner" para aplicar permanentemente.');
      } else {
        setBannerDraft(prev => ({
          ...prev,
          image: result.url,
          mediaType: prev.mediaType === 'video' ? 'video' : 'image',
        }));
      }
    } catch (err) {
      alert('Erro ao processar arquivo do banner: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingBannerImg(false);
      if (e.target) e.target.value = '';
    }
  }, []);

  const handleRowFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const banner = uploadingBannerRowTarget.current;
      if (!file || !banner) return;
      setUploadingBannerRowId(banner.id);
      try {
        await ensureDefaultBannersSeeded();
        const result = await uploadBannerMediaFile(file);
        if (result.mediaType === 'video') {
          await setDoc(
            doc(db, 'home-config', 'data', 'hero-banners', banner.id),
            {
              title: banner.title || 'Banner',
              subtitle: banner.subtitle || '',
              image: banner.image || result.posterImage || '',
              link: banner.link || '/promotions',
              buttonText: banner.buttonText || 'Ver Oferta',
              badgeText: banner.badgeText || '',
              highlightWords: banner.highlightWords || [],
              order: banner.order ?? 0,
              active: banner.active !== false,
              placement: banner.placement || 'home',
              videoUrl: result.url,
              mediaType: 'video',
              posterImage: result.posterImage || banner.posterImage || '',
              aspectRatio: result.aspectRatio || '',
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
          alert('Vídeo em loop do banner atualizado e salvo com sucesso!');
        } else {
          await setDoc(
            doc(db, 'home-config', 'data', 'hero-banners', banner.id),
            {
              title: banner.title || 'Banner',
              subtitle: banner.subtitle || '',
              image: result.url,
              link: banner.link || '/promotions',
              buttonText: banner.buttonText || 'Ver Oferta',
              badgeText: banner.badgeText || '',
              highlightWords: banner.highlightWords || [],
              order: banner.order ?? 0,
              active: banner.active !== false,
              placement: banner.placement || 'home',
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
          alert('Imagem do banner atualizada com sucesso!');
        }
      } catch (err) {
        alert('Erro ao atualizar mídia do banner: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setUploadingBannerRowId(null);
        uploadingBannerRowTarget.current = null;
        if (e.target) e.target.value = '';
      }
    },
    [ensureDefaultBannersSeeded]
  );

  const handlePeriodBgUpload = useCallback(
    async (_periodId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadingPeriodBg(true);
      try {
        const uploadedUrl = await uploadOrCompressImage(file, {
          folder: 'banners',
          maxDimension: 960,
          quality: 0.82,
        });
        setPeriodDraft(p => ({ ...p, background: uploadedUrl }));
        alert('Imagem de atmosfera carregada! Clique em Salvar para aplicar.');
      } catch (err) {
        alert('Erro ao carregar imagem: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setUploadingPeriodBg(false);
        if (e.target) e.target.value = '';
      }
    },
    []
  );

  const saveBanner = useCallback(async () => {
    const isVideoExt = (url?: string) => Boolean(url && (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url) || url.startsWith('data:video/')));
    const rawVideoUrl = (bannerDraft.videoUrl || '').trim();
    const rawImage = (bannerDraft.image || '').trim();
    const isVideo = bannerDraft.mediaType === 'video' || Boolean(rawVideoUrl) || isVideoExt(rawImage);
    const resolvedVideoUrl = rawVideoUrl || (isVideoExt(rawImage) ? rawImage : '');
    const resolvedImage = isVideoExt(rawImage) ? (bannerDraft.posterImage || '') : rawImage;

    if (!bannerDraft.title?.trim() && !resolvedImage && !resolvedVideoUrl) {
      alert('Informe pelo menos o título, uma imagem ou o vídeo para o banner.');
      return;
    }

    if (resolvedVideoUrl.startsWith('data:') && resolvedVideoUrl.length > 700_000) {
      alert(
        'O vídeo atual está codificado como Data URI muito longo (>700KB) e excederá o limite de 1MB por documento do Firestore. ' +
        'Por favor, clique no botão "Enviar Vídeo" para carregá-lo pelo Firebase Storage ou cole a URL direta (MP4/WebM).'
      );
      return;
    }

    setSaving(true);
    try {
      await ensureDefaultBannersSeeded();
      const currentCount = heroBanners.length > 0 ? heroBanners.length : DEFAULT_HERO_BANNERS.length;
      const targetPlacement = (bannerDraft.placement || (bannerPageFilter !== 'all' ? bannerPageFilter : 'home')).trim();

      const data: Record<string, unknown> = {
        title: bannerDraft.title?.trim() || 'Banner Principal',
        subtitle: bannerDraft.subtitle?.trim() || '',
        image: resolvedImage || (bannerDraft.posterImage?.trim() || ''),
        link: (bannerDraft.link || (targetPlacement === 'home' ? '/promotions' : `/${targetPlacement}`)).trim(),
        buttonText: (bannerDraft.buttonText || 'Ver Oferta').trim(),
        badgeText: (bannerDraft.badgeText || '').trim(),
        highlightWords: bannerDraft.highlightWords || [],
        order: bannerDraft.order ?? currentCount,
        active: bannerDraft.active !== false,
        placement: targetPlacement,
        mediaType: isVideo ? 'video' : 'image',
        videoUrl: resolvedVideoUrl || '',
        posterImage: bannerDraft.posterImage?.trim() || '',
        aspectRatio: bannerDraft.aspectRatio?.trim() || '',
        updatedAt: new Date().toISOString(),
      };

      if (editingBannerId) {
        await setDoc(doc(db, 'home-config', 'data', 'hero-banners', editingBannerId), data, { merge: true });
      } else {
        const defMatch = DEFAULT_HERO_BANNERS.find(d => (d.placement || 'home').toLowerCase() === targetPlacement.toLowerCase());
        const alreadyHasInList = heroBanners.some(b => b.id === defMatch?.id);
        if (defMatch && !alreadyHasInList) {
          await setDoc(doc(db, 'home-config', 'data', 'hero-banners', defMatch.id), data, { merge: true });
        } else {
          await addDoc(collection(db, 'home-config', 'data', 'hero-banners'), data);
        }
      }
      setEditingBannerId(null);
      setCreatingBanner(false);
      setBannerDraft({});
      alert('Banner salvo com sucesso e gravado permanentemente no sistema!');
    } catch (e: unknown) {
      console.error('[saveBanner] Erro ao salvar banner no Firestore:', e);
      alert('Erro ao salvar banner: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }, [bannerDraft, editingBannerId, heroBanners, ensureDefaultBannersSeeded, bannerPageFilter]);

  const toggleBannerActive = useCallback(
    async (banner: HeroBannerConfig) => {
      try {
        await ensureDefaultBannersSeeded();
        const nextActive = banner.active === false ? true : false;
        await setDoc(
          doc(db, 'home-config', 'data', 'hero-banners', banner.id),
          {
            title: banner.title || 'Banner',
            subtitle: banner.subtitle || '',
            image: banner.image || '',
            link: banner.link || '/promotions',
            buttonText: banner.buttonText || 'Ver Oferta',
            badgeText: banner.badgeText || '',
            highlightWords: banner.highlightWords || [],
            order: banner.order ?? 0,
            active: nextActive,
            placement: banner.placement || 'home',
            mediaType: banner.mediaType || (banner.videoUrl ? 'video' : 'image'),
            videoUrl: banner.videoUrl || '',
            posterImage: banner.posterImage || '',
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (e: unknown) {
        alert('Erro ao alterar status do banner: ' + (e instanceof Error ? e.message : String(e)));
      }
    },
    [ensureDefaultBannersSeeded]
  );

  const moveBanner = useCallback(
    async (index: number, dir: 'up' | 'down') => {
      const list = heroBanners.length > 0 ? heroBanners : DEFAULT_HERO_BANNERS;
      const next = dir === 'up' ? index - 1 : index + 1;
      if (next < 0 || next >= list.length) return;
      await ensureDefaultBannersSeeded();
      const a = list[index];
      const b = list[next];
      await setDoc(doc(db, 'home-config', 'data', 'hero-banners', a.id), { order: next }, { merge: true });
      await setDoc(doc(db, 'home-config', 'data', 'hero-banners', b.id), { order: index }, { merge: true });
    },
    [heroBanners, ensureDefaultBannersSeeded]
  );

  const deleteBanner = useCallback(
    async (id: string) => {
      if (!window.confirm('Excluir este banner?')) return;
      try {
        await deleteDoc(doc(db, 'home-config', 'data', 'hero-banners', id));
      } catch (e) {
        alert('Erro ao excluir banner: ' + (e instanceof Error ? e.message : String(e)));
      }
    },
    []
  );


  // SubTabBtn is defined at module level to satisfy react-hooks/static-components.

  const moSearchFiltered = products
    .filter(p => p.title.toLowerCase().includes(moSearch.toLowerCase()) && !megaOfertas.find(m => m.productId === p.id))
    .slice(0, 6);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Sub Tab Nav ── */}
      <div style={{ display: 'flex', gap: 4, background: crmTheme.cardBg, padding: '8px 12px', borderRadius: 14, border: `1px solid ${crmTheme.border}`, overflowX: 'auto', scrollbarWidth: 'none', boxShadow: crmTheme.shadowSm }}>
        <SubTabBtn id="layout"      label="Estrutura Home" icon={LayoutList} badge={homeLayout.length || undefined} activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab} />
        <SubTabBtn id="vitrines"    label="Vitrines"       icon={Layers}     badge={vitrines.length}    activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab} />
        <SubTabBtn id="heroBanners" label="Banners"        icon={Image}      badge={heroBanners.length} activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab} />
        <SubTabBtn id="brands"      label="Marcas"         icon={Award}      badge={brands.length || undefined} activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab} />
        <SubTabBtn id="partners"    label="Parceiros"      icon={Store}      badge={localPartners.length || undefined} activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab} />
        <SubTabBtn id="favoritos"   label="Favoritos"      icon={Heart}      badge={condoFavorites.length} activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab} />
        <SubTabBtn id="megaOfertas" label="Mega Ofertas"   icon={Zap}        badge={megaOfertas.length} activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab} />
        <SubTabBtn id="periodos"    label="Períodos"       icon={Clock}                                  activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab} />
        <SubTabBtn id="campanhas"   label="Campanhas"      icon={Megaphone}                              activeSubTab={activeSubTab} setActiveSubTab={setActiveSubTab} />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SUB-ABA: VITRINES                                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'vitrines' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, color: crmTheme.textPrimary, fontSize: 16, fontWeight: 900 }}>Vitrines de Produtos</h3>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: crmTheme.textSecondary }}>Seções exibidas na Home, em tempo real</p>
            </div>
            {!creatingVitrine && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleResetProductsAndVitrines} style={{ ...btnGold, background: crmTheme.accent, boxShadow: '0 4px 12px rgba(14,165,233,0.2)' }}>
                  <RefreshCw size={13} /> Gerar Produtos & Vitrines
                </button>
                <button onClick={handleGenerateDefaultVitrines} style={{ ...btnGold, background: crmTheme.success, boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}>
                  <RefreshCw size={13} /> Gerar Vitrines Padrão
                </button>
                <button onClick={() => { setCreatingVitrine(true); setEditingVitrineId(null); }} style={btnGold}>
                  <Plus size={13} /> Nova Vitrine
                </button>
              </div>
            )}
          </div>

          {/* Create Form */}
          {creatingVitrine && (
            <div style={{ ...card, border: `1px solid ${crmTheme.primary}`, background: crmTheme.primaryLight }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Plus size={15} color={crmTheme.primary} />
                <h4 style={{ margin: 0, color: crmTheme.primary, fontSize: 14, fontWeight: 900 }}>Nova Vitrine</h4>
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
              <Layers size={32} color={crmTheme.textMuted} style={{ marginBottom: 12 }} />
              <p style={{ color: crmTheme.textSecondary, fontSize: 13, margin: 0 }}>Nenhuma vitrine configurada.<br/>A Home seleciona automaticamente categorias ativas do catálogo oficial.</p>
            </div>
          )}

          {vitrines.map((v, index) => {
            const isEditing = editingVitrineId === v.id;
            const theme = THEME_OPTIONS.find(t => t.value === v.theme);
            const missingCount = v.productIds.filter(pid => !products.some(p => p.id === pid)).length;
            return (
              <div key={v.id} style={{ ...card, border: isEditing ? `1px solid ${crmTheme.primary}` : `1px solid ${crmTheme.border}`, transition: 'border 0.2s' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isEditing ? 16 : 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: theme?.color || '#666', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color: crmTheme.textPrimary }}>{v.title}</span>
                      <span style={{ fontSize: 9, fontWeight: 900, background: v.active ? crmTheme.successLight : crmTheme.dangerLight, color: v.active ? crmTheme.success : crmTheme.danger, border: `1px solid ${v.active ? crmTheme.success : crmTheme.danger}`, padding: '2px 7px', borderRadius: 99 }}>
                        {v.active ? 'ATIVA' : 'INATIVA'}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: crmTheme.textMuted }}>Ordem {v.order} · {v.productIds.length} produtos</span>
                      {missingCount > 0 && (
                        <span style={{ fontSize: 9, fontWeight: 800, color: crmTheme.danger, background: crmTheme.dangerLight, border: `1px solid ${crmTheme.danger}`, padding: '1px 6px', borderRadius: 99 }}>
                          {missingCount} produto{missingCount > 1 ? 's' : ''} ausente{missingCount > 1 ? 's' : ''} do catálogo
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button style={btnIconSm()} onClick={() => moveVitrine(index, 'up')} title="Mover para cima" disabled={index === 0}><ArrowUp size={12} /></button>
                    <button style={btnIconSm()} onClick={() => moveVitrine(index, 'down')} title="Mover para baixo" disabled={index === vitrines.length - 1}><ArrowDown size={12} /></button>
                    <button style={btnIconSm(v.active ? crmTheme.success : crmTheme.danger)} onClick={() => toggleVitrine(v)} title="Toggle ativo">
                      {v.active ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                    <button style={btnIconSm(crmTheme.primary)} onClick={() => { setEditingVitrineId(isEditing ? null : v.id); setCreatingVitrine(false); }} title="Editar">
                      {isEditing ? <ChevronUp size={12} /> : <Edit2 size={12} />}
                    </button>
                    <button style={{ ...btnIconSm(crmTheme.danger), border: `1px solid ${crmTheme.dangerLight}` }} onClick={() => deleteVitrine(v.id)} title="Excluir">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Prévia visual dos produtos da vitrine na ordem exata */}
                {!isEditing && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: crmTheme.textSecondary }}>
                        Produtos da Vitrine ({v.productIds.length}):
                      </span>
                      <button
                        type="button"
                        onClick={() => { setEditingVitrineId(v.id); setCreatingVitrine(false); }}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: crmTheme.primary,
                          background: crmTheme.primaryLight,
                          border: `1px solid ${crmTheme.primary}`,
                          borderRadius: 6,
                          padding: '2px 8px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Edit2 size={10} /> Gerenciar Produtos & Ordem
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                      {v.productIds.length === 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                          <span style={{ fontSize: 11, color: crmTheme.textMuted, fontStyle: 'italic' }}>
                            {v.category
                              ? `Modo automático: exibe os produtos da categoria "${v.category}".`
                              : 'Vazia no momento.'}
                          </span>
                        </div>
                      ) : (
                        v.productIds.slice(0, 12).map((pid, pidx) => {
                          const prod = products.find((p) => p.id === pid);
                          return (
                            <div
                              key={pid}
                              title={`${pidx + 1}º: ${prod ? prod.title : pid}`}
                              style={{
                                position: 'relative',
                                width: 34,
                                height: 34,
                                borderRadius: 6,
                                background: '#fff',
                                border: `1px solid ${crmTheme.border}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                overflow: 'hidden',
                              }}
                            >
                              <span
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  fontSize: 8,
                                  fontWeight: 900,
                                  background: 'rgba(0,0,0,0.65)',
                                  color: '#fff',
                                  padding: '1px 3px',
                                  borderBottomRightRadius: 4,
                                  lineHeight: 1,
                                }}
                              >
                                {pidx + 1}
                              </span>
                              {prod ? (
                                <img
                                  src={cleanImageUrl(prod.image)}
                                  onError={handleImageError}
                                  alt=""
                                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                              ) : (
                                <span style={{ fontSize: 9, color: crmTheme.danger }}>?</span>
                              )}
                            </div>
                          );
                        })
                      )}
                      {v.productIds.length > 12 && (
                        <span
                          style={{
                            fontSize: 10,
                            color: crmTheme.textMuted,
                            fontWeight: 700,
                            paddingLeft: 4,
                          }}
                        >
                          +{v.productIds.length - 12}
                        </span>
                      )}
                    </div>
                  </div>
                )}

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
      {/* SUB-ABA: FAVORITOS DO CONDOMÍNIO                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'favoritos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Heart size={20} color="#f87171" fill="#f87171" />
                <h3 style={{ margin: 0, color: crmTheme.textPrimary, fontSize: 16, fontWeight: 900 }}>Favoritos do Condomínio</h3>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: crmTheme.textSecondary }}>
                Controle total da vitrine de favoritos: adicione, remova e defina a ordem exata do ranking exibido no carrossel da Home.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                onClick={seedDefaultCondoFavorites}
                disabled={saving}
                style={{
                  ...btnGhost,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: crmTheme.accent,
                  border: `1px solid ${crmTheme.accent}`,
                  fontSize: 11,
                  padding: '6px 12px',
                }}
              >
                <RefreshCw size={12} /> Carregar Favoritos Sugeridos
              </button>
            </div>
          </div>

          {/* Dica explicativa */}
          <div
            style={{
              background: crmTheme.cardBg,
              border: `1px solid ${crmTheme.border}`,
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 11,
              color: crmTheme.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span>
              ⭐ <strong>Como funciona o ranking:</strong> O 1º produto da lista receberá o selo <strong>#1</strong> na Home, o 2º o selo <strong>#2</strong>, e assim por diante. Use os botões ▲ e ▼ para subir ou descer a posição de qualquer item.
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: crmTheme.primary,
                background: crmTheme.primaryLight,
                padding: '3px 8px',
                borderRadius: 99,
                whiteSpace: 'nowrap',
              }}
            >
              {condoFavorites.length} produto{condoFavorites.length === 1 ? '' : 's'} no ranking
            </span>
          </div>

          {/* Seletor e Ordenador Completo de Produtos */}
          <div style={{ ...card, padding: 14 }}>
            <ProductPicker
              products={products}
              selectedIds={condoFavorites.map(f => f.productId)}
              onChangeIds={handleUpdateCondoFavorites}
              emptyHint="A vitrine de favoritos do condomínio está vazia. Adicione produtos abaixo ou clique em 'Carregar Favoritos Sugeridos'."
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SUB-ABA: MEGA OFERTAS                                                */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'megaOfertas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: '0 0 2px', color: crmTheme.textPrimary, fontSize: 16, fontWeight: 900 }}>⚡ Mega Ofertas</h3>
            <p style={{ margin: 0, fontSize: 11, color: crmTheme.textSecondary }}>Seção "MEGA OFERTAS — SÓ ESTA SEMANA" na Home</p>
          </div>

          {/* Add form */}
          <div style={{ ...card, border: `1px solid ${crmTheme.primaryLight}`, background: crmTheme.primaryLight }}>
            <h4 style={{ margin: '0 0 12px', color: crmTheme.primary, fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={14} /> Adicionar produto às Mega Ofertas
            </h4>
            {/* Product search */}
            <div style={{ marginBottom: 10 }}>
              <label style={labelSt}>Buscar produto do catálogo</label>
              <div style={{ position: 'relative' }}>
                <Search size={12} color={crmTheme.textMuted} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input value={moSearch} onChange={e => setMoSearch(e.target.value)}
                  placeholder="Digite o nome do produto..." style={{ ...inputSt, paddingLeft: 30 }} />
              </div>
              {moSearch && (
                <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                  {moSearchFiltered.length === 0 && <span style={{ fontSize: 11, color: crmTheme.textMuted, padding: 6 }}>Nenhum produto disponível.</span>}
                  {moSearchFiltered.map(p => (
                    <button key={p.id} onClick={() => { setMoSelectedId(p.id); setMoSearch(''); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, background: moSelectedId === p.id ? crmTheme.primaryLight : crmTheme.cardBg, border: `1px solid ${moSelectedId === p.id ? crmTheme.primary : crmTheme.border}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', textAlign: 'left' }}>
                      <img
                        src={cleanImageUrl(p.image)}
                        onError={handleImageError}
                        alt=""
                        style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6, background: '#fff', border: `1px solid ${crmTheme.border}` }}
                      />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: crmTheme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                        <div style={{ fontSize: 10, color: crmTheme.textSecondary }}>R$ {Number(p.price).toFixed(2)} · {p.category}</div>
                      </div>
                      {moSelectedId === p.id ? <Check size={13} color={crmTheme.primary} /> : <Plus size={13} color={crmTheme.textMuted} />}
                    </button>
                  ))}
                </div>
              )}
              {moSelectedId && (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, background: crmTheme.primaryLight, border: `1px solid ${crmTheme.primary}`, borderRadius: 8, padding: '6px 10px' }}>
                  <Check size={12} color={crmTheme.primary} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: crmTheme.primary }}>
                    {products.find(p => p.id === moSelectedId)?.title || moSelectedId}
                  </span>
                  <button onClick={() => setMoSelectedId('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: crmTheme.danger, marginLeft: 'auto', display: 'flex' }}><X size={12} /></button>
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
                <select value={moBadgeStyle} onChange={e => setMoBadgeStyle(e.target.value as 'orange' | 'light')}
                  style={{ ...inputSt, appearance: 'auto', background: crmTheme.cardBg }}>
                  <option value="orange" style={{ background: crmTheme.cardBg, color: crmTheme.textPrimary }}>🟠 Orange</option>
                  <option value="light" style={{ background: crmTheme.cardBg, color: crmTheme.textPrimary }}>⬜ Light</option>
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
              <Zap size={28} color={crmTheme.textMuted} style={{ marginBottom: 10 }} />
              <p style={{ color: crmTheme.textSecondary, fontSize: 13, margin: 0 }}>Nenhum produto nas Mega Ofertas.<br/>A Home exibe automaticamente promoções ativas do catálogo oficial.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {megaOfertas.map((mo, index) => {
                const p = products.find(x => x.id === mo.productId);
                return (
                  <div key={mo.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                    {p ? (
                      <img
                        src={cleanImageUrl(p.image)}
                        onError={handleImageError}
                        alt=""
                        style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8, background: '#fff', border: `1px solid ${crmTheme.border}`, flexShrink: 0 }}
                      />
                    ) : (
                      <div style={{ width: 44, height: 44, borderRadius: 8, background: crmTheme.dangerLight, border: `1px solid ${crmTheme.danger}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: crmTheme.danger, fontSize: 11, fontWeight: 900, flexShrink: 0 }}>!</div>
                    )}
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: p ? crmTheme.textPrimary : crmTheme.danger, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p ? p.title : `${mo.productId} (não encontrado no catálogo)`}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                        {p && <span style={{ fontSize: 11, fontWeight: 900, color: crmTheme.primary }}>R$ {Number(p.price).toFixed(2)}</span>}
                        {mo.badge && (
                          <span style={{ fontSize: 9, fontWeight: 900, background: mo.badgeStyle === 'orange' ? crmTheme.warningLight : crmTheme.primaryLight, color: mo.badgeStyle === 'orange' ? crmTheme.warning : crmTheme.primary, border: `1px solid ${mo.badgeStyle === 'orange' ? crmTheme.warning : crmTheme.primary}`, padding: '2px 7px', borderRadius: 99 }}>{mo.badge}</span>
                        )}
                        {mo.validUntil && <span style={{ fontSize: 9, color: crmTheme.textMuted, fontWeight: 600 }}>Até {new Date(mo.validUntil).toLocaleDateString('pt-BR')}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button style={btnIconSm()} onClick={() => moveMegaOferta(index, 'up')} disabled={index === 0}><ArrowUp size={12} /></button>
                      <button style={btnIconSm()} onClick={() => moveMegaOferta(index, 'down')} disabled={index === megaOfertas.length - 1}><ArrowDown size={12} /></button>
                      <button style={{ ...btnIconSm(crmTheme.danger), border: `1px solid ${crmTheme.dangerLight}` }} onClick={() => deleteMegaOferta(mo.id)}><Trash2 size={12} /></button>
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
            <h3 style={{ margin: '0 0 2px', color: crmTheme.textPrimary, fontSize: 16, fontWeight: 900 }}>🌅 Configuração de Períodos</h3>
            <p style={{ margin: 0, fontSize: 11, color: crmTheme.textSecondary }}>Produtos exibidos em cada horário do dia na Home</p>
          </div>

          {Object.entries(PERIOD_LABELS).map(([periodId, meta]) => {
            const cfg = periodConfig[periodId];
            const isEditing = editingPeriod === periodId;
            const PeriodIcon = meta.icon;
            const active = cfg?.active !== false;
            const isAuto = cfg?.isAuto !== false;

            return (
              <div key={periodId} style={{ ...card, border: isEditing ? `1px solid ${crmTheme.primary}` : `1px solid ${crmTheme.border}`, transition: 'border 0.2s' }}>
                {/* Period Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: crmTheme.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <PeriodIcon size={18} color={crmTheme.primary} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: crmTheme.textPrimary }}>{cfg?.title || meta.label}</div>
                    <div style={{ fontSize: 10, color: crmTheme.textSecondary, fontWeight: 600 }}>{meta.sub} · {cfg?.productIds?.length || 0} produtos configurados</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <button style={toggle(active)} onClick={() => togglePeriodActive(periodId)}>
                        <div style={toggleKnob(active)} />
                      </button>
                      <span style={{ fontSize: 8, fontWeight: 700, color: active ? crmTheme.success : crmTheme.textMuted }}>Ativo</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <button style={toggle(isAuto)} onClick={() => togglePeriodAuto(periodId)}>
                        <div style={toggleKnob(isAuto)} />
                      </button>
                      <span style={{ fontSize: 8, fontWeight: 700, color: isAuto ? crmTheme.accent : crmTheme.textMuted }}>Auto</span>
                    </div>
                    <button style={btnIconSm(crmTheme.primary)} onClick={() => {
                      if (isEditing) { setEditingPeriod(null); }
                      else { setEditingPeriod(periodId); setPeriodDraft({ title: cfg?.title || meta.label, background: cfg?.background || '' }); }
                    }}>
                      {isEditing ? <ChevronUp size={12} /> : <Edit2 size={12} />}
                    </button>
                  </div>
                </div>

                {/* Expanded edit */}
                {isEditing && (
                  <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ height: 1, background: crmTheme.border }} />
                    <div>
                      <label style={labelSt}>Título da seção</label>
                      <input style={inputSt} value={periodDraft.title || ''} onChange={e => setPeriodDraft(p => ({ ...p, title: e.target.value }))} placeholder={meta.label} />
                    </div>

                    <div>
                      <label style={labelSt}>Imagem de Fundo / Atmosfera (Upload ou URL)</label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          style={inputSt}
                          value={periodDraft.background || ''}
                          onChange={e => setPeriodDraft(p => ({ ...p, background: e.target.value }))}
                          placeholder="Cole a URL ou envie uma foto do dispositivo"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (periodBgInputRef.current) periodBgInputRef.current.value = '';
                            periodBgInputRef.current?.click();
                          }}
                          disabled={uploadingPeriodBg}
                          style={{ ...btnGold, height: 36, padding: '0 12px', fontSize: 11, flexShrink: 0 }}
                        >
                          <UploadCloud size={13} />
                          {uploadingPeriodBg ? 'Enviando...' : 'Enviar Foto'}
                        </button>
                        {periodDraft.background && (
                          <button
                            type="button"
                            onClick={() => setPeriodDraft(p => ({ ...p, background: '' }))}
                            style={{ ...btnGhost, height: 36, padding: '0 10px', fontSize: 11, color: crmTheme.danger }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <input
                        ref={periodBgInputRef}
                        type="file"
                        accept="image/*"
                        onChange={e => handlePeriodBgUpload(periodId, e)}
                        style={{ display: 'none' }}
                      />
                    </div>

                    <div>
                      <label style={{ ...labelSt, marginBottom: 8 }}>Produtos neste período ({cfg?.productIds?.length || 0})</label>
                      <ProductPicker
                        products={products}
                        selectedIds={cfg?.productIds || []}
                        onChangeIds={ids => updatePeriodProductIds(periodId, ids)}
                        onAdd={(id: string) => addProductToPeriod(periodId, id)}
                        onRemove={(id: string) => removeProductFromPeriod(periodId, id)}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 8, background: crmTheme.accentLight, border: `1px solid ${crmTheme.accent}`, borderRadius: 10, padding: '10px 14px' }}>
                      <AlertCircle size={14} color={crmTheme.accent} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 11, color: crmTheme.textSecondary, fontWeight: 600, lineHeight: 1.5 }}>
                        <strong style={{ color: crmTheme.accent }}>Modo Auto:</strong> quando ativado, o sistema pode mesclar os produtos configurados com os mais vendidos automaticamente. Desative para controle total.
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: `1px solid ${crmTheme.border}` }}>
                      <button onClick={() => setEditingPeriod(null)} style={btnGhost}>Fechar</button>
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
      {/* SUB-ABA: HERO BANNERS POR PÁGINA                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'heroBanners' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ margin: '0 0 2px', color: crmTheme.textPrimary, fontSize: 16, fontWeight: 900 }}>
                🎯 Banners & Hero por Página (Home, Promoções, Bebidas, Padaria, Tabacaria, Eletrônicos)
              </h3>
              <p style={{ margin: 0, fontSize: 11, color: crmTheme.textSecondary }}>
                Crie e personalize banners no estilo Hero para qualquer página. Faça upload de novas fotos, troque imagens em tempo real e escolha onde o banner deve aparecer.
              </p>
            </div>
            {!creatingBanner && !editingBannerId && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('layout')}
                  style={{ ...btnGhost, color: '#be185d', borderColor: 'rgba(236,72,153,0.4)' }}
                  title="Mover banners entre vitrines e organizar a ordem da página Home"
                >
                  <LayoutList size={13} /> Organizar Posição na Home
                </button>
                <button
                  type="button"
                  onClick={seedAllPageBanners}
                  disabled={saving}
                  style={{ ...btnGhost, color: crmTheme.primary, borderColor: crmTheme.primary }}
                  title="Carregar banners pré-configurados para todas as páginas"
                >
                  <Sparkles size={13} /> Carregar Banners das Páginas
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const baseCount = heroBanners.length > 0 ? heroBanners.length : DEFAULT_HERO_BANNERS.length;
                    const defaultPlacement = bannerPageFilter !== 'all' ? bannerPageFilter : 'home';
                    const defaultLink =
                      defaultPlacement === 'home'
                        ? '/promotions'
                        : `/${defaultPlacement}`;
                    setCreatingBanner(true);
                    setBannerDraft({
                      order: baseCount,
                      active: true,
                      placement: defaultPlacement,
                      link: defaultLink,
                      buttonText: 'Ver Ofertas',
                    });
                  }}
                  style={btnGold}
                >
                  <Plus size={13} /> Novo Banner
                </button>
              </div>
            )}
          </div>

          {/* Page Filter Tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', background: crmTheme.cardBg, border: `1px solid ${crmTheme.border}`, borderRadius: 12, padding: '8px 12px' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: crmTheme.textSecondary, marginRight: 4 }}>
              Filtrar por Página:
            </span>
            {BANNER_PAGES.map((page) => {
              const isSelected = bannerPageFilter === page.id;
              const countForPage = (heroBanners.length > 0 ? heroBanners : DEFAULT_HERO_BANNERS).filter(
                (b) => page.id === 'all' || (b.placement || 'home').toLowerCase() === page.id
              ).length;
              return (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => setBannerPageFilter(page.id)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 800,
                    border: `1px solid ${isSelected ? crmTheme.primary : crmTheme.border}`,
                    background: isSelected ? crmTheme.primaryLight : 'transparent',
                    color: isSelected ? crmTheme.primary : crmTheme.textSecondary,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{page.icon}</span>
                  <span>{page.label}</span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 900,
                      background: isSelected ? crmTheme.primary : crmTheme.border,
                      color: isSelected ? '#fff' : crmTheme.textMuted,
                      padding: '1px 6px',
                      borderRadius: 99,
                    }}
                  >
                    {countForPage}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Create / Edit Form */}
          {(creatingBanner || editingBannerId) && (
            <div style={{ ...card, border: `1px solid ${crmTheme.primary}`, background: crmTheme.primaryLight }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h4 style={{ margin: 0, color: crmTheme.primary, fontSize: 13, fontWeight: 900 }}>
                  {creatingBanner ? '+ Novo Banner Hero' : '✏️ Editar / Substituir Imagem do Banner'}
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: crmTheme.textSecondary }}>Destino:</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 900,
                      padding: '2px 8px',
                      borderRadius: 99,
                      background: getPlacementMeta(bannerDraft.placement).bg,
                      color: getPlacementMeta(bannerDraft.placement).text,
                      border: `1px solid ${getPlacementMeta(bannerDraft.placement).border}`,
                    }}
                  >
                    {getPlacementMeta(bannerDraft.placement).icon} {getPlacementMeta(bannerDraft.placement).label}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelSt}>Página de Exibição do Banner *</label>
                    <select
                      style={inputSt}
                      value={bannerDraft.placement || 'home'}
                      onChange={(e) => {
                        const target = e.target.value;
                        setBannerDraft((b) => ({
                          ...b,
                          placement: target,
                          link: b.link || (target === 'home' ? '/promotions' : `/${target}`),
                        }));
                      }}
                    >
                      <option value="home">🏠 Home (Topo / Hero Principal)</option>
                      <option value="home-inline">🧩 Home (Entre Vitrines)</option>
                      <option value="promotions">🔥 Promoções (/promotions)</option>
                      <option value="bebidas">🍻 Bebidas (/bebidas)</option>
                      <option value="padaria">🥐 Padaria (/padaria)</option>
                      <option value="tabacaria">🚬 Tabacaria (/tabacaria)</option>
                      <option value="eletronicos">⚡ Eletrônicos (/eletronicos)</option>
                      <option value="all">🌐 Todas as Páginas (Global)</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelSt}>Título do Banner *</label>
                    <input
                      style={inputSt}
                      value={bannerDraft.title || ''}
                      onChange={(e) => setBannerDraft((b) => ({ ...b, title: e.target.value }))}
                      placeholder="Ex: Cervejas Trincando no Gelo"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelSt}>Subtítulo / Descrição Curta</label>
                    <input
                      style={inputSt}
                      value={bannerDraft.subtitle || ''}
                      onChange={(e) => setBannerDraft((b) => ({ ...b, subtitle: e.target.value }))}
                      placeholder="Ex: Entregas expressas em menos de 15 minutos"
                    />
                  </div>
                  <div>
                    <label style={labelSt}>Link de Destino ao Clicar</label>
                    <input
                      style={inputSt}
                      value={bannerDraft.link || ''}
                      onChange={(e) => setBannerDraft((b) => ({ ...b, link: e.target.value }))}
                      placeholder="Ex: /bebidas ou /promotions"
                    />
                  </div>
                </div>

                {/* Media Type Toggle + Media Upload / URL */}
                <div style={{ background: crmTheme.cardBg, border: `1px solid ${crmTheme.border}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setBannerDraft((b) => ({ ...b, mediaType: 'image' }))}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 800,
                          border: `1px solid ${bannerDraft.mediaType !== 'video' ? crmTheme.primary : crmTheme.border}`,
                          background: bannerDraft.mediaType !== 'video' ? crmTheme.primaryLight : 'transparent',
                          color: bannerDraft.mediaType !== 'video' ? crmTheme.primary : crmTheme.textSecondary,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <Image size={13} /> 🖼️ Foto / Imagem
                      </button>
                      <button
                        type="button"
                        onClick={() => setBannerDraft((b) => ({ ...b, mediaType: 'video' }))}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 800,
                          border: `1px solid ${bannerDraft.mediaType === 'video' ? '#8b5cf6' : crmTheme.border}`,
                          background: bannerDraft.mediaType === 'video' ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                          color: bannerDraft.mediaType === 'video' ? '#7c3aed' : crmTheme.textSecondary,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <Video size={13} /> 🎥 Vídeo Curto em Loop
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        ref={bannerFileInputRef}
                        type="file"
                        accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime"
                        onChange={handleBannerImageUpload}
                        disabled={uploadingBannerImg}
                        style={{ display: 'none' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (bannerFileInputRef.current) bannerFileInputRef.current.value = '';
                          bannerFileInputRef.current?.click();
                        }}
                        disabled={uploadingBannerImg}
                        style={{
                          ...btnGold,
                          height: 34,
                          padding: '0 12px',
                          fontSize: 11,
                          cursor: uploadingBannerImg ? 'wait' : 'pointer',
                          opacity: uploadingBannerImg ? 0.7 : 1,
                        }}
                      >
                        <UploadCloud size={13} />
                        {uploadingBannerImg
                          ? 'Processando arquivo...'
                          : bannerDraft.mediaType === 'video'
                          ? (bannerDraft.videoUrl ? 'Trocar Vídeo (Upload)' : 'Enviar Vídeo (MP4/WebM)')
                          : (bannerDraft.image ? 'Substituir Imagem' : 'Enviar Imagem')}
                      </button>
                      {(bannerDraft.image || bannerDraft.videoUrl) && (
                        <button
                          type="button"
                          onClick={() => setBannerDraft((b) => ({ ...b, image: '', videoUrl: '', posterImage: '' }))}
                          style={{ ...btnGhost, height: 34, padding: '0 10px', fontSize: 11, color: crmTheme.danger }}
                        >
                          <Trash2 size={12} /> Limpar
                        </button>
                      )}
                    </div>
                  </div>

                  {bannerDraft.mediaType === 'video' ? (
                    <>
                      <div>
                        <label style={labelSt}>URL do Vídeo Curto (MP4 ou WebM para rodar em Loop) *</label>
                        <input
                          style={inputSt}
                          value={bannerDraft.videoUrl || ''}
                          onChange={(e) => setBannerDraft((b) => ({ ...b, videoUrl: e.target.value, mediaType: 'video' }))}
                          placeholder="Cole a URL do vídeo (ex: /videos/promo.mp4, https://... ou faça upload acima)"
                        />
                      </div>
                      <div>
                        <label style={labelSt}>Imagem de Capa / Poster do Vídeo (Opcional, exibida enquanto carrega)</label>
                        <input
                          style={inputSt}
                          value={bannerDraft.posterImage || bannerDraft.image || ''}
                          onChange={(e) => setBannerDraft((b) => ({ ...b, posterImage: e.target.value, image: e.target.value }))}
                          placeholder="URL da capa opcional (ex: /pao_de_queijo.png ou https://...)"
                        />
                      </div>

                      {(bannerDraft.videoUrl || bannerDraft.image) && (
                        <div style={{ display: 'flex', gap: 14, alignItems: 'center', paddingTop: 6, background: '#000', padding: 10, borderRadius: 10 }}>
                          <AdminVideoPreview
                            videoSrc={bannerDraft.videoUrl || bannerDraft.image || ''}
                            poster={bannerDraft.posterImage ? sanitizeBannerImageUrl(bannerDraft.posterImage) : undefined}
                            style={{
                              width: 160,
                              height: 90,
                              objectFit: 'contain',
                              borderRadius: 6,
                              flexShrink: 0,
                              border: '1px solid rgba(255,255,255,0.2)',
                              background: '#000',
                            }}
                          />
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Film size={14} color="#a78bfa" /> Vídeo em Loop Ativo
                            </div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                              Este vídeo será reproduzido de forma contínua, silenciosa (muted) e otimizada na página {getPlacementMeta(bannerDraft.placement).label}.
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div>
                        <label style={labelSt}>URL da Imagem do Banner</label>
                        <input
                          style={inputSt}
                          value={bannerDraft.image || ''}
                          onChange={(e) => setBannerDraft((b) => ({ ...b, image: e.target.value }))}
                          placeholder="Cole a URL da imagem (/banner_estupidamente_geladas.png ou https://...)"
                        />
                      </div>

                      {bannerDraft.image && (
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingTop: 4 }}>
                          <img
                            src={sanitizeBannerImageUrl(bannerDraft.image)}
                            alt="Preview"
                            style={{
                              width: 140,
                              height: 68,
                              objectFit: 'cover',
                              borderRadius: 8,
                              flexShrink: 0,
                              border: `1px solid ${crmTheme.border}`,
                            }}
                          />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: crmTheme.textPrimary }}>
                              {bannerDraft.title || 'Pré-visualização do Banner'}
                            </div>
                            <div style={{ fontSize: 11, color: crmTheme.textSecondary }}>
                              {bannerDraft.subtitle || 'A imagem será exibida com o estilo Hero na página selecionada.'}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelSt}>Texto do botão</label>
                    <input
                      style={inputSt}
                      value={bannerDraft.buttonText || ''}
                      onChange={(e) => setBannerDraft((b) => ({ ...b, buttonText: e.target.value }))}
                      placeholder="Ex: Ver Ofertas"
                    />
                  </div>
                  <div>
                    <label style={labelSt}>Badge texto (opcional)</label>
                    <input
                      style={inputSt}
                      value={bannerDraft.badgeText || ''}
                      onChange={(e) => setBannerDraft((b) => ({ ...b, badgeText: e.target.value }))}
                      placeholder="Ex: 🔥 Trincando"
                    />
                  </div>
                  <div>
                    <label style={labelSt}>Ordem de Exibição</label>
                    <input
                      style={inputSt}
                      type="number"
                      value={bannerDraft.order ?? 0}
                      onChange={(e) => setBannerDraft((b) => ({ ...b, order: parseInt(e.target.value) || 0 }))}
                      min="0"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                  <button
                    type="button"
                    style={toggle(bannerDraft.active !== false)}
                    onClick={() => setBannerDraft((b) => ({ ...b, active: b.active === false ? true : false }))}
                  >
                    <div style={toggleKnob(bannerDraft.active !== false)} />
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 700, color: bannerDraft.active !== false ? crmTheme.success : crmTheme.textMuted }}>
                    {bannerDraft.active !== false ? 'Banner Ativo na Página' : 'Banner Desativado (Oculto)'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: `1px solid ${crmTheme.border}` }}>
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingBanner(false);
                      setEditingBannerId(null);
                      setBannerDraft({});
                    }}
                    style={btnGhost}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveBanner}
                    disabled={saving || uploadingBannerImg}
                    style={{ ...btnGold, opacity: saving || uploadingBannerImg ? 0.6 : 1 }}
                  >
                    {saving ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
                    {saving ? 'Salvando...' : 'Salvar Banner'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Banner List filtered by selected page */}
          {heroBanners.length === 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: crmTheme.accentLight, border: `1px solid ${crmTheme.accent}`, borderRadius: 10, padding: '10px 14px' }}>
              <AlertCircle size={15} color={crmTheme.accent} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: crmTheme.textSecondary, fontWeight: 600 }}>
                Exibindo banners padrão do sistema. Você pode substituir a imagem de qualquer um deles via upload ou clicar em <strong>Carregar Banners das Páginas</strong> para personalizar livremente.
              </span>
            </div>
          )}

          {(() => {
            const allBanners = heroBanners.length > 0 ? heroBanners : DEFAULT_HERO_BANNERS;
            const displayed = allBanners.filter((b) => {
              if (bannerPageFilter === 'all') return true;
              return (b.placement || 'home').toLowerCase() === bannerPageFilter.toLowerCase();
            });

            if (displayed.length === 0) {
              return (
                <div style={{ ...card, textAlign: 'center', padding: '24px 16px', color: crmTheme.textMuted, fontSize: 12 }}>
                  Nenhum banner cadastrado para a página selecionada (<strong>{BANNER_PAGES.find(p => p.id === bannerPageFilter)?.label}</strong>).
                  <div style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const baseCount = allBanners.length;
                        setCreatingBanner(true);
                        setBannerDraft({
                          order: baseCount,
                          active: true,
                          placement: bannerPageFilter,
                          link: bannerPageFilter === 'home' ? '/promotions' : `/${bannerPageFilter}`,
                          buttonText: 'Ver Ofertas',
                        });
                      }}
                      style={{ ...btnGhost, display: 'inline-flex', margin: '0 auto' }}
                    >
                      <Plus size={12} /> Criar Primeiro Banner desta Página
                    </button>
                  </div>
                </div>
              );
            }

            return displayed.map((banner, index, arr) => {
              const isActive = banner.active !== false;
              const isUploadingThisRow = uploadingBannerRowId === banner.id;
              const meta = getPlacementMeta(banner.placement);
              const isVideoExt = (url?: string) => Boolean(url && (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url) || url.startsWith('data:video/')));
              const isVideo = banner.mediaType === 'video' || Boolean(banner.videoUrl) || isVideoExt(banner.image);
              const videoSrc = banner.videoUrl || (isVideoExt(banner.image) ? banner.image : '');

              return (
                <div
                  key={banner.id}
                  style={{
                    ...card,
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    padding: '12px 14px',
                    opacity: isActive ? 1 : 0.6,
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      width: 96,
                      height: 54,
                      borderRadius: 8,
                      overflow: 'hidden',
                      background: '#000',
                      border: `1px solid ${crmTheme.border}`,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isVideo && videoSrc ? (
                      <AdminVideoPreview
                        videoSrc={videoSrc}
                        poster={banner.posterImage ? sanitizeBannerImageUrl(banner.posterImage) : undefined}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : banner.image ? (
                      <img
                        src={sanitizeBannerImageUrl(banner.image)}
                        alt={banner.title}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <Image size={18} color={crmTheme.textMuted} />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 180, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 900,
                          color: crmTheme.textPrimary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {banner.title || `Banner #${index + 1}`}
                      </span>

                      {/* Video Loop Indicator Badge */}
                      {isVideo && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 900,
                            padding: '2px 7px',
                            borderRadius: 99,
                            background: 'rgba(139, 92, 246, 0.15)',
                            color: '#7c3aed',
                            border: '1px solid rgba(139, 92, 246, 0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <Film size={10} /> VÍDEO LOOP
                        </span>
                      )}

                      {/* Page Placement Badge */}
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 900,
                          padding: '2px 8px',
                          borderRadius: 99,
                          background: meta.bg,
                          color: meta.text,
                          border: `1px solid ${meta.border}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <span>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </span>

                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: 99,
                          background: isActive ? crmTheme.successLight : crmTheme.borderLight,
                          color: isActive ? crmTheme.success : crmTheme.textMuted,
                        }}
                      >
                        {isActive ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </div>

                    <div style={{ fontSize: 10, color: crmTheme.textSecondary, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Link2 size={9} /> {banner.link || '/'} · Ordem {banner.order ?? index}
                      {banner.badgeText && (
                        <span style={{ background: crmTheme.primaryLight, color: crmTheme.primary, padding: '1px 6px', borderRadius: 99, fontSize: 8, fontWeight: 900 }}>
                          {banner.badgeText}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      title="Substituir imagem deste banner diretamente via upload"
                      onClick={() => {
                        uploadingBannerRowTarget.current = banner;
                        if (rowFileInputRef.current) rowFileInputRef.current.value = '';
                        rowFileInputRef.current?.click();
                      }}
                      disabled={isUploadingThisRow}
                      style={{
                        ...btnGhost,
                        height: 30,
                        padding: '0 10px',
                        fontSize: 11,
                        fontWeight: 800,
                        color: crmTheme.primary,
                        borderColor: crmTheme.primary,
                        cursor: isUploadingThisRow ? 'wait' : 'pointer',
                        opacity: isUploadingThisRow ? 0.7 : 1,
                      }}
                    >
                      <UploadCloud size={12} />
                      {isUploadingThisRow ? 'Enviando...' : 'Trocar Imagem'}
                    </button>

                    <button
                      type="button"
                      title={isActive ? 'Desativar banner' : 'Ativar banner'}
                      style={btnIconSm(isActive ? crmTheme.success : crmTheme.textMuted)}
                      onClick={() => toggleBannerActive(banner)}
                    >
                      {isActive ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>

                    <button
                      type="button"
                      title="Mover para cima"
                      disabled={index === 0}
                      style={{ ...btnIconSm(crmTheme.textSecondary), opacity: index === 0 ? 0.35 : 1 }}
                      onClick={() => moveBanner(index, 'up')}
                    >
                      <ArrowUp size={12} />
                    </button>

                    <button
                      type="button"
                      title="Mover para baixo"
                      disabled={index === arr.length - 1}
                      style={{ ...btnIconSm(crmTheme.textSecondary), opacity: index === arr.length - 1 ? 0.35 : 1 }}
                      onClick={() => moveBanner(index, 'down')}
                    >
                      <ArrowDown size={12} />
                    </button>

                    <button
                      type="button"
                      title="Editar texto, página, link e imagem"
                      style={btnIconSm(crmTheme.primary)}
                      onClick={() => {
                        setEditingBannerId(banner.id);
                        setCreatingBanner(false);
                        setBannerDraft({ ...banner, active: banner.active !== false, placement: banner.placement || 'home' });
                      }}
                    >
                      <Edit2 size={12} />
                    </button>

                    <button
                      type="button"
                      title="Excluir banner"
                      style={{ ...btnIconSm(crmTheme.danger), border: `1px solid ${crmTheme.dangerLight}` }}
                      onClick={() => deleteBanner(banner.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            });
          })()}

          <input
            ref={rowFileInputRef}
            type="file"
            accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime"
            onChange={handleRowFileSelected}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SUB-ABA: CAMPANHAS                                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'campanhas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ margin: '0 0 2px', color: crmTheme.textPrimary, fontSize: 16, fontWeight: 900 }}>📣 Central de Campanhas</h3>
            <p style={{ margin: 0, fontSize: 11, color: crmTheme.textSecondary }}>Gerencie campanhas temporárias e promoções segmentadas</p>
          </div>

          <div style={{ ...card, background: `linear-gradient(135deg, ${crmTheme.primaryLight} 0%, ${crmTheme.cardBg} 100%)`, border: `1px solid ${crmTheme.primary}` }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: crmTheme.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Megaphone size={22} color={crmTheme.primary} />
              </div>
              <div>
                <h4 style={{ margin: '0 0 6px', color: crmTheme.primary, fontSize: 15, fontWeight: 900 }}>Em Desenvolvimento</h4>
                <p style={{ margin: 0, fontSize: 12, color: crmTheme.textSecondary, lineHeight: 1.6 }}>O sistema de campanhas está sendo planejado com os seguintes recursos:</p>
              </div>
            </div>
          </div>

          {[
            { icon: Target, title: 'Campanhas por Segmento', desc: 'Crie promoções exclusivas para Clientes VIP, Bronze, Novos Clientes ou segmentos personalizados.', color: crmTheme.warning, colorLight: crmTheme.warningLight },
            { icon: Clock, title: 'Campanhas com Agendamento', desc: 'Defina datas de início e fim. A campanha ativa e desativa automaticamente.', color: crmTheme.success, colorLight: crmTheme.successLight },
            { icon: Zap, title: 'Promoções Flash', desc: 'Ofertas relâmpago com cronômetro visível na Home — cria urgência e aumenta conversão.', color: '#f97316', colorLight: 'rgba(249,115,22,0.08)' },
            { icon: Star, title: 'Programa de Indicação', desc: 'Configure recompensas em diamantes para clientes que indicam amigos.', color: crmTheme.primary, colorLight: crmTheme.primaryLight },
            { icon: Tag, title: 'Cupons e Códigos', desc: 'Gere cupons de desconto fixo ou percentual vinculados a campanhas específicas.', color: '#ec4899', colorLight: 'rgba(236,72,153,0.08)' },
          ].map((item, i) => {
            const ItemIcon = item.icon;
            return (
              <div key={i} style={{ ...card, display: 'flex', gap: 12, alignItems: 'flex-start', opacity: 0.9 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: item.colorLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ItemIcon size={17} color={item.color} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: crmTheme.textPrimary, marginBottom: 3 }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: crmTheme.textSecondary, fontWeight: 600, lineHeight: 1.5 }}>{item.desc}</div>
                </div>
                <span style={{ flexShrink: 0, fontSize: 8, fontWeight: 900, background: crmTheme.bg, color: crmTheme.textMuted, border: `1px solid ${crmTheme.border}`, padding: '3px 8px', borderRadius: 99, marginLeft: 'auto' }}>EM BREVE</span>
              </div>
            );
          })}
        </div>
      )}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SUB-ABA: ESTRUTURA HOME (NO-CODE PAGE BUILDER)                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'layout' && (
        <AdminHomeLayoutBuilder
          homeLayout={homeLayout}
          vitrines={vitrines}
          heroBanners={heroBanners}
          onGoToBanners={() => setActiveSubTab('heroBanners')}
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SUB-ABA: MARCAS (CARDS REDONDOS)                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'brands' && (
        <AdminRoundCardsManager
          collectionName="home-brands"
          title="Marcas em Destaque (Cards Redondos)"
          description="Gerencie a lista vertical de cards redondos de Marcas exibida na Home. Suba logos, ordene e defina links de destino."
          items={brands}
          defaultSeedItems={DEFAULT_BRANDS}
          accentColor="#d97706"
        />
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SUB-ABA: PARCEIROS LOCAIS (CARDS REDONDOS)                             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeSubTab === 'partners' && (
        <AdminRoundCardsManager
          collectionName="home-partners"
          title="Parceiros Locais (Cards Redondos)"
          description="Gerencie a lista vertical de cards redondos de Parceiros Locais exibida na Home. Cadastre negócios locais, selos e links."
          items={localPartners}
          defaultSeedItems={DEFAULT_LOCAL_PARTNERS}
          accentColor="#059669"
        />
      )}
    </div>
  );
};
