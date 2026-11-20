import React, { useState, useCallback, useMemo } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  RefreshCw,
  Image as ImageIcon,
  Layers,
  LayoutList,
  Sparkles,
  Check,
  Edit2,
  X,
} from 'lucide-react';
import { doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import type {
  HeroBannerConfig,
  HomeBlockType,
  HomeLayoutBlock,
  VitrineConfig,
} from '../../types/home';
import { buildDefaultHomeLayout } from '../../data/defaultHomeExtras';

interface AdminHomeLayoutBuilderProps {
  homeLayout: HomeLayoutBlock[];
  vitrines: VitrineConfig[];
  heroBanners: HeroBannerConfig[];
  onGoToBanners?: () => void;
}

const BLOCK_TYPE_META: Record<
  HomeBlockType,
  { label: string; color: string; bg: string; tag: string }
> = {
  hero:             { label: 'Banner Principal (Hero)',       color: '#4f46e5', bg: 'rgba(79,70,229,0.08)',  tag: 'HERO' },
  quick_categories: { label: 'Atalhos Rápidos',               color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)', tag: 'NAVEGAÇÃO' },
  search:           { label: 'Barra de Busca',                color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)', tag: 'BUSCA' },
  period_selector:  { label: 'Mais Pedidos por Horário',      color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', tag: 'PERÍODO' },
  social_proof:     { label: 'Faixa Editorial / Prova Social',color: '#64748b', bg: 'rgba(100,116,139,0.1)', tag: 'EDITORIAL' },
  vitrine:          { label: 'Vitrine de Produtos',           color: '#10b981', bg: 'rgba(16,185,129,0.08)', tag: 'VITRINE' },
  banner:           { label: 'Banner Entre Vitrines',         color: '#ec4899', bg: 'rgba(236,72,153,0.08)', tag: 'BANNER' },
  mega_ofertas:     { label: 'Mega Ofertas',                  color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  tag: 'OFERTAS' },
  brands:           { label: 'Marcas (Cards Redondos)',       color: '#d97706', bg: 'rgba(217,119,6,0.08)',  tag: 'MARCAS' },
  local_partners:   { label: 'Parceiros Locais (Redondos)',   color: '#059669', bg: 'rgba(5,150,105,0.08)',  tag: 'PARCEIROS' },
  promo_banners:    { label: 'Banners Frete / Indicação',     color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', tag: 'PROMO' },
  benefit_cards:    { label: 'Cartões de Benefícios',         color: '#64748b', bg: 'rgba(100,116,139,0.1)', tag: 'BENEFÍCIOS' },
  categories:       { label: 'Categorias Ilustradas',         color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)', tag: 'CATEGORIAS' },
  condo_favorites:  { label: 'Favoritos do Condomínio',       color: '#e11d48', bg: 'rgba(225,29,72,0.08)',  tag: 'FAVORITOS' },
};

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: 20,
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04)',
};

const btnPrimary: React.CSSProperties = {
  background: '#4f46e5',
  border: 'none',
  borderRadius: 10,
  color: '#fff',
  fontWeight: 800,
  fontSize: 12,
  padding: '0 14px',
  height: 36,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
  fontFamily: 'Manrope, sans-serif',
};

const btnGhost: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  color: '#475569',
  fontWeight: 800,
  fontSize: 11,
  padding: '0 12px',
  height: 34,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  cursor: 'pointer',
  fontFamily: 'Manrope, sans-serif',
};

const iconBtn = (color = '#475569'): React.CSSProperties => ({
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 7,
  width: 30,
  height: 30,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color,
  cursor: 'pointer',
});

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 38,
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '0 12px',
  color: '#0f172a',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'Manrope, sans-serif',
};

export const AdminHomeLayoutBuilder: React.FC<AdminHomeLayoutBuilderProps> = ({
  homeLayout,
  vitrines,
  heroBanners,
  onGoToBanners,
}) => {
  const [saving, setSaving] = useState(false);
  const [addMode, setAddMode] = useState<'none' | 'banner' | 'vitrine' | 'section'>('none');
  const [selectedRefId, setSelectedRefId] = useState('');
  const [selectedSectionType, setSelectedSectionType] = useState<HomeBlockType>('brands');
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');

  const inlineBanners = useMemo(
    () => heroBanners.filter((b) => b.placement === 'home-inline'),
    [heroBanners],
  );

  // Lista exibida: usa o layout salvo ou uma prévia do layout padrão
  const isCustomLayoutSaved = homeLayout.length > 0;
  const displayBlocks = useMemo<HomeLayoutBlock[]>(() => {
    if (isCustomLayoutSaved) {
      return [...homeLayout].sort((a, b) => a.order - b.order);
    }
    return buildDefaultHomeLayout(
      vitrines.map((v) => ({ id: v.id, title: v.title })),
      inlineBanners,
    );
  }, [isCustomLayoutSaved, homeLayout, vitrines, inlineBanners]);

  const persistFullLayout = useCallback(async (blocks: HomeLayoutBlock[]) => {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      blocks.forEach((b, idx) => {
        const ref = doc(db, 'home-config', 'data', 'home-layout', b.id);
        batch.set(ref, {
          type: b.type,
          label: b.label,
          refId: b.refId || '',
          title: b.title || '',
          subtitle: b.subtitle || '',
          order: idx,
          active: b.active !== false,
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
    } catch (err) {
      alert('Erro ao salvar estrutura da Home: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }, []);

  const ensureLayoutInitialized = useCallback(async (): Promise<HomeLayoutBlock[]> => {
    if (homeLayout.length > 0) {
      return [...homeLayout].sort((a, b) => a.order - b.order);
    }
    const defaults = buildDefaultHomeLayout(
      vitrines.map((v) => ({ id: v.id, title: v.title })),
      inlineBanners,
    );
    await persistFullLayout(defaults);
    return defaults;
  }, [homeLayout, vitrines, inlineBanners, persistFullLayout]);

  const moveBlock = useCallback(
    async (index: number, direction: -1 | 1) => {
      const list = await ensureLayoutInitialized();
      const target = index + direction;
      if (target < 0 || target >= list.length) return;
      const reordered = [...list];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(target, 0, moved);
      await persistFullLayout(reordered);
    },
    [ensureLayoutInitialized, persistFullLayout],
  );

  const toggleBlock = useCallback(
    async (block: HomeLayoutBlock) => {
      const list = await ensureLayoutInitialized();
      const updated = list.map((b) =>
        b.id === block.id ? { ...b, active: b.active === false } : b,
      );
      await persistFullLayout(updated);
    },
    [ensureLayoutInitialized, persistFullLayout],
  );

  const removeBlock = useCallback(
    async (block: HomeLayoutBlock) => {
      if (!window.confirm(`Remover o bloco "${block.label}" da estrutura da Home?`)) return;
      setSaving(true);
      try {
        await ensureLayoutInitialized();
        await deleteDoc(doc(db, 'home-config', 'data', 'home-layout', block.id));
      } catch (err) {
        alert('Erro ao remover bloco: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setSaving(false);
      }
    },
    [ensureLayoutInitialized],
  );

  const handleResetDefault = useCallback(async () => {
    if (
      !window.confirm(
        'Restaurar a ordem padrão da Home (incluindo todas as vitrines ativas, Marcas, Parceiros Locais e banners entre vitrines)?',
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      // Remove documentos antigos para evitar sobras
      for (const existing of homeLayout) {
        await deleteDoc(doc(db, 'home-config', 'data', 'home-layout', existing.id));
      }
      const defaults = buildDefaultHomeLayout(
        vitrines.map((v) => ({ id: v.id, title: v.title })),
        inlineBanners,
      );
      await persistFullLayout(defaults);
    } catch (err) {
      alert('Erro ao restaurar estrutura: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }, [homeLayout, vitrines, inlineBanners, persistFullLayout]);

  const handleAddBlock = useCallback(async () => {
    const list = await ensureLayoutInitialized();
    const newId = `block-${addMode}-${Date.now()}`;
    let newBlock: HomeLayoutBlock | null = null;

    if (addMode === 'banner') {
      if (!selectedRefId) {
        alert('Selecione um banner para inserir na Home.');
        return;
      }
      const matchedBanner = heroBanners.find((b) => b.id === selectedRefId);
      const label =
        selectedRefId === 'home-inline'
          ? 'Carrossel: Todos os Banners Entre Vitrines'
          : `Banner: ${matchedBanner?.title || 'Promocional'}`;
      newBlock = {
        id: newId,
        type: 'banner',
        label,
        refId: selectedRefId,
        order: list.length,
        active: true,
      };
    } else if (addMode === 'vitrine') {
      if (!selectedRefId) {
        alert('Selecione uma vitrine para inserir na Home.');
        return;
      }
      const matchedVitrine = vitrines.find((v) => v.id === selectedRefId);
      newBlock = {
        id: `block-vitrine-${selectedRefId}-${Date.now()}`,
        type: 'vitrine',
        label: `Vitrine: ${matchedVitrine?.title || selectedRefId}`,
        refId: selectedRefId,
        order: list.length,
        active: true,
      };
    } else if (addMode === 'section') {
      const meta = BLOCK_TYPE_META[selectedSectionType];
      newBlock = {
        id: `block-${selectedSectionType}-${Date.now()}`,
        type: selectedSectionType,
        label: meta.label,
        title:
          selectedSectionType === 'brands'
            ? 'Principais Marcas'
            : selectedSectionType === 'local_partners'
            ? 'Parceiros Locais'
            : undefined,
        subtitle:
          selectedSectionType === 'brands'
            ? 'As marcas que você confia sempre geladas e fresquinhas'
            : selectedSectionType === 'local_partners'
            ? 'Comércios e produtores selecionados perto de você'
            : undefined,
        order: list.length,
        active: true,
      };
    }

    if (!newBlock) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'home-config', 'data', 'home-layout', newBlock.id), {
        type: newBlock.type,
        label: newBlock.label,
        refId: newBlock.refId || '',
        title: newBlock.title || '',
        subtitle: newBlock.subtitle || '',
        order: list.length,
        active: true,
        updatedAt: new Date().toISOString(),
      });
      setAddMode('none');
      setSelectedRefId('');
    } catch (err) {
      alert('Erro ao adicionar bloco: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }, [addMode, selectedRefId, selectedSectionType, heroBanners, vitrines, ensureLayoutInitialized]);

  const handleSaveTitleEdit = useCallback(
    async (block: HomeLayoutBlock) => {
      await ensureLayoutInitialized();
      setSaving(true);
      try {
        await setDoc(
          doc(db, 'home-config', 'data', 'home-layout', block.id),
          {
            title: editTitle.trim(),
            subtitle: editSubtitle.trim(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
        setEditingBlockId(null);
      } catch (err) {
        alert('Erro ao salvar título: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setSaving(false);
      }
    },
    [ensureLayoutInitialized, editTitle, editSubtitle],
  );

  // Vitrines que ainda não estão no layout atual
  const missingVitrines = useMemo(() => {
    const usedIds = new Set(displayBlocks.filter((b) => b.type === 'vitrine').map((b) => b.refId));
    return vitrines.filter((v) => !usedIds.has(v.id));
  }, [displayBlocks, vitrines]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayoutList size={18} color="#4f46e5" />
            <h3 style={{ margin: 0, color: '#0f172a', fontSize: 16, fontWeight: 900 }}>
              Construtor No-Code da Home (Ordem & Blocos)
            </h3>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#475569' }}>
            Controle 100% da estrutura da página inicial: mova vitrines, insira banners entre vitrines, ative ou oculte qualquer seção em tempo real.
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              setAddMode(addMode === 'banner' ? 'none' : 'banner');
              setSelectedRefId(heroBanners[0]?.id || 'home-inline');
            }}
            style={{ ...btnPrimary, background: '#ec4899' }}
          >
            <ImageIcon size={14} /> + Inserir Banner Entre Vitrines
          </button>
          <button
            type="button"
            onClick={() => {
              setAddMode(addMode === 'vitrine' ? 'none' : 'vitrine');
              setSelectedRefId(missingVitrines[0]?.id || vitrines[0]?.id || '');
            }}
            style={{ ...btnPrimary, background: '#10b981' }}
          >
            <Layers size={14} /> + Inserir Vitrine
          </button>
          <button
            type="button"
            onClick={() => setAddMode(addMode === 'section' ? 'none' : 'section')}
            style={btnPrimary}
          >
            <Plus size={14} /> + Inserir Seção
          </button>
          <button type="button" onClick={handleResetDefault} disabled={saving} style={btnGhost}>
            <RefreshCw size={13} /> Restaurar Padrão
          </button>
        </div>
      </div>

      {/* Add block panel */}
      {addMode !== 'none' && (
        <div
          style={{
            ...cardStyle,
            border: '1.5px solid #4f46e5',
            background: 'rgba(79,70,229,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: '#4f46e5' }}>
              {addMode === 'banner'
                ? 'Inserir Banner na Home (entre vitrines)'
                : addMode === 'vitrine'
                ? 'Inserir Vitrine de Produtos na Home'
                : 'Inserir Seção Especial na Home'}
            </h4>
            <button type="button" onClick={() => setAddMode('none')} style={iconBtn('#64748b')}>
              <X size={14} />
            </button>
          </div>

          {addMode === 'banner' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                Escolha qual Banner exibir neste bloco:
              </label>
              <select
                value={selectedRefId}
                onChange={(e) => setSelectedRefId(e.target.value)}
                style={inputStyle}
              >
                <option value="home-inline">Carrossel: Todos os banners marcados como "Home (Entre Vitrines)"</option>
                {heroBanners.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.mediaType === 'video' ? '🎥 [Vídeo] ' : '🖼️ [Imagem] '}
                    {b.title || b.id} ({b.placement || 'home'})
                  </option>
                ))}
              </select>
              {onGoToBanners && (
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  Quer cadastrar uma nova imagem ou vídeo primeiro?{' '}
                  <button
                    type="button"
                    onClick={onGoToBanners}
                    style={{ background: 'none', border: 'none', color: '#4f46e5', fontWeight: 800, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                  >
                    Ir para Banners por Página
                  </button>
                </div>
              )}
            </div>
          )}

          {addMode === 'vitrine' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                Escolha a Vitrine:
              </label>
              <select
                value={selectedRefId}
                onChange={(e) => setSelectedRefId(e.target.value)}
                style={inputStyle}
              >
                {vitrines.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title} ({v.productIds.length} produtos){v.active ? '' : ' [INATIVA]'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {addMode === 'section' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                Tipo de Seção:
              </label>
              <select
                value={selectedSectionType}
                onChange={(e) => setSelectedSectionType(e.target.value as HomeBlockType)}
                style={inputStyle}
              >
                <option value="brands">Principais Marcas (Cards Redondos)</option>
                <option value="local_partners">Parceiros Locais (Cards Redondos)</option>
                <option value="mega_ofertas">Mega Ofertas</option>
                <option value="period_selector">Mais Pedidos por Horário</option>
                <option value="hero">Banner Principal (Hero)</option>
                <option value="quick_categories">Atalhos Rápidos</option>
                <option value="search">Barra de Busca</option>
                <option value="social_proof">Faixa Editorial / Prova Social</option>
                <option value="promo_banners">Banners Frete Grátis / Indicação</option>
                <option value="benefit_cards">Cartões de Benefícios</option>
                <option value="categories">Categorias Ilustradas</option>
                <option value="condo_favorites">Favoritos do Condomínio</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setAddMode('none')} style={btnGhost}>
              Cancelar
            </button>
            <button type="button" onClick={handleAddBlock} disabled={saving} style={btnPrimary}>
              <Check size={14} /> {saving ? 'Salvando...' : 'Adicionar à Home'}
            </button>
          </div>
        </div>
      )}

      {/* Status info if not customized yet */}
      {!isCustomLayoutSaved && (
        <div
          style={{
            background: 'rgba(14,165,233,0.06)',
            border: '1px solid rgba(14,165,233,0.25)',
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 12,
            color: '#0369a1',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Sparkles size={15} />
          <span>
            Exibindo a estrutura padrão. Assim que você mover, ocultar ou inserir qualquer bloco abaixo, sua estrutura personalizada será salva automaticamente no Firebase!
          </span>
        </div>
      )}

      {/* Ordered block list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {displayBlocks.map((block, index) => {
          const meta = BLOCK_TYPE_META[block.type] || {
            label: block.type,
            color: '#64748b',
            bg: '#f1f5f9',
            tag: 'BLOCO',
          };
          const vitrineMatch =
            block.type === 'vitrine' && block.refId
              ? vitrines.find((v) => v.id === block.refId)
              : undefined;
          const bannerMatch =
            block.type === 'banner' && block.refId
              ? heroBanners.find((b) => b.id === block.refId)
              : undefined;
          const isEditingTitle = editingBlockId === block.id;
          const canEditHeading = block.type === 'brands' || block.type === 'local_partners';

          return (
            <div
              key={block.id}
              style={{
                background: block.active === false ? '#f8fafc' : '#ffffff',
                border: '1px solid #e2e8f0',
                borderLeft: `4px solid ${block.active === false ? '#cbd5e1' : meta.color}`,
                borderRadius: 12,
                padding: '12px 14px',
                opacity: block.active === false ? 0.65 : 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 7,
                    background: '#f1f5f9',
                    color: '#475569',
                    fontSize: 11,
                    fontWeight: 900,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </span>

                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 900,
                    padding: '3px 8px',
                    borderRadius: 99,
                    background: meta.bg,
                    color: meta.color,
                    border: `1px solid ${meta.color}33`,
                    letterSpacing: 0.4,
                    flexShrink: 0,
                  }}
                >
                  {meta.tag}
                </span>

                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                    {vitrineMatch
                      ? `Vitrine: ${vitrineMatch.title}`
                      : bannerMatch
                      ? `Banner: ${bannerMatch.title || 'Sem título'}`
                      : block.title || block.label || meta.label}
                  </div>
                  {(block.subtitle || vitrineMatch || bannerMatch) && (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                      {block.subtitle
                        ? block.subtitle
                        : vitrineMatch
                        ? `${vitrineMatch.productIds.length} produtos • Tema: ${vitrineMatch.theme}`
                        : bannerMatch
                        ? `${bannerMatch.mediaType === 'video' ? 'Vídeo em loop' : 'Imagem'} • Destino: ${bannerMatch.link || 'Informativo'}`
                        : ''}
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                  <button
                    type="button"
                    title="Mover para cima"
                    disabled={index === 0 || saving}
                    onClick={() => moveBlock(index, -1)}
                    style={{ ...iconBtn('#334155'), opacity: index === 0 ? 0.35 : 1 }}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    title="Mover para baixo"
                    disabled={index === displayBlocks.length - 1 || saving}
                    onClick={() => moveBlock(index, 1)}
                    style={{
                      ...iconBtn('#334155'),
                      opacity: index === displayBlocks.length - 1 ? 0.35 : 1,
                    }}
                  >
                    <ArrowDown size={13} />
                  </button>
                  {canEditHeading && (
                    <button
                      type="button"
                      title="Editar título e subtítulo"
                      onClick={() => {
                        setEditingBlockId(isEditingTitle ? null : block.id);
                        setEditTitle(
                          block.title ||
                            (block.type === 'brands' ? 'Principais Marcas' : 'Parceiros Locais'),
                        );
                        setEditSubtitle(block.subtitle || '');
                      }}
                      style={iconBtn('#4f46e5')}
                    >
                      <Edit2 size={13} />
                    </button>
                  )}
                  <button
                    type="button"
                    title={block.active === false ? 'Exibir na Home' : 'Ocultar da Home'}
                    disabled={saving}
                    onClick={() => toggleBlock(block)}
                    style={iconBtn(block.active === false ? '#94a3b8' : '#10b981')}
                  >
                    {block.active === false ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button
                    type="button"
                    title="Remover bloco"
                    disabled={saving}
                    onClick={() => removeBlock(block)}
                    style={iconBtn('#ef4444')}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {isEditingTitle && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 10,
                    paddingTop: 10,
                    borderTop: '1px solid #f1f5f9',
                  }}
                >
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                      TÍTULO DA SEÇÃO
                    </label>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>
                      SUBTÍTULO DA SEÇÃO
                    </label>
                    <input
                      value={editSubtitle}
                      onChange={(e) => setEditSubtitle(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleSaveTitleEdit(block)}
                      disabled={saving}
                      style={btnPrimary}
                    >
                      <Check size={13} /> Salvar
                    </button>
                    <button type="button" onClick={() => setEditingBlockId(null)} style={btnGhost}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

