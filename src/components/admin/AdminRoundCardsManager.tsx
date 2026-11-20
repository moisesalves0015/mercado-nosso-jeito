import React, { useState, useCallback, useRef } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  UploadCloud,
  Sparkles,
  Award,
  Store,
} from 'lucide-react';
import { collection, addDoc, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { RoundCardItem } from '../../types/home';
import { uploadOrCompressImage } from '../../services/imageUploadService';
import { cleanImageUrl, handleImageError } from '../../utils/imageUrl';

interface AdminRoundCardsManagerProps {
  collectionName: 'home-brands' | 'home-partners';
  title: string;
  description: string;
  items: RoundCardItem[];
  defaultSeedItems: RoundCardItem[];
  accentColor: string;
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 16,
  padding: 20,
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.04)',
};

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

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  display: 'block',
  marginBottom: 4,
};

const btnPrimary = (bg = '#4f46e5'): React.CSSProperties => ({
  background: bg,
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
});

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

export const AdminRoundCardsManager: React.FC<AdminRoundCardsManagerProps> = ({
  collectionName,
  title,
  description,
  items,
  defaultSeedItems,
  accentColor,
}) => {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<RoundCardItem>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const Icon = collectionName === 'home-brands' ? Award : Store;
  const sorted = [...items].sort((a, b) => a.order - b.order);

  const handleUploadImage = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await uploadOrCompressImage(file, {
        folder: 'banners',
        maxDimension: 420,
        quality: 0.85,
      });
      setDraft((prev) => ({ ...prev, image: dataUrl }));
    } catch (err) {
      alert('Erro ao enviar imagem: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  }, [collectionName]);

  const handleSeedDefaults = useCallback(async () => {
    setSaving(true);
    try {
      for (const item of defaultSeedItems) {
        await setDoc(doc(db, 'home-config', 'data', collectionName, item.id), {
          name: item.name,
          subtitle: item.subtitle || '',
          image: item.image || '',
          link: item.link || '',
          badge: item.badge || '',
          order: item.order,
          active: true,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      alert('Erro ao carregar exemplos: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }, [collectionName, defaultSeedItems]);

  const handleSave = useCallback(async () => {
    const name = (draft.name || '').trim();
    if (!name) {
      alert('Informe o nome do card.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        subtitle: (draft.subtitle || '').trim(),
        image: (draft.image || '').trim(),
        link: (draft.link || '').trim(),
        badge: (draft.badge || '').trim(),
        order: draft.order ?? sorted.length,
        active: draft.active !== false,
        updatedAt: new Date().toISOString(),
      };
      if (editingId) {
        await setDoc(doc(db, 'home-config', 'data', collectionName, editingId), payload, {
          merge: true,
        });
      } else {
        await addDoc(collection(db, 'home-config', 'data', collectionName), payload);
      }
      setCreating(false);
      setEditingId(null);
      setDraft({});
    } catch (err) {
      alert('Erro ao salvar card: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }, [draft, editingId, collectionName, sorted.length]);

  const handleMove = useCallback(
    async (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= sorted.length) return;
      const a = sorted[index];
      const b = sorted[target];
      setSaving(true);
      try {
        await setDoc(
          doc(db, 'home-config', 'data', collectionName, a.id),
          { order: target },
          { merge: true },
        );
        await setDoc(
          doc(db, 'home-config', 'data', collectionName, b.id),
          { order: index },
          { merge: true },
        );
      } finally {
        setSaving(false);
      }
    },
    [sorted, collectionName],
  );

  const handleToggleActive = useCallback(
    async (item: RoundCardItem) => {
      setSaving(true);
      try {
        await setDoc(
          doc(db, 'home-config', 'data', collectionName, item.id),
          { active: item.active === false },
          { merge: true },
        );
      } finally {
        setSaving(false);
      }
    },
    [collectionName],
  );

  const handleDelete = useCallback(
    async (item: RoundCardItem) => {
      if (!window.confirm(`Excluir "${item.name}"?`)) return;
      setSaving(true);
      try {
        await deleteDoc(doc(db, 'home-config', 'data', collectionName, item.id));
      } finally {
        setSaving(false);
      }
    },
    [collectionName],
  );

  const isFormOpen = creating || editingId !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div
        style={{
          ...cardStyle,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon size={18} color={accentColor} />
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0f172a' }}>{title}</h3>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#475569' }}>{description}</p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {sorted.length === 0 && (
            <button type="button" onClick={handleSeedDefaults} disabled={saving} style={btnGhost}>
              <Sparkles size={13} /> Carregar Exemplos
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setCreating(true);
              setEditingId(null);
              setDraft({
                name: '',
                subtitle: '',
                image: '',
                link: '',
                badge: collectionName === 'home-partners' ? 'Local' : '',
                active: true,
              });
            }}
            style={btnPrimary(accentColor)}
          >
            <Plus size={14} /> Novo Card Redondo
          </button>
        </div>
      </div>

      {/* Create / Edit Form */}
      {isFormOpen && (
        <div
          style={{
            ...cardStyle,
            border: `1.5px solid ${accentColor}`,
            background: '#fafbff',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 900, color: accentColor }}>
              {editingId ? 'Editar Card Redondo' : 'Novo Card Redondo'}
            </h4>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setEditingId(null);
                setDraft({});
              }}
              style={iconBtn('#64748b')}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Live Round Card Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 96 }}>
              <div
                style={{
                  width: 78,
                  height: 78,
                  borderRadius: '50%',
                  padding: 3,
                  background: `linear-gradient(145deg, ${accentColor}, ${accentColor}33)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {draft.image ? (
                    <img
                      src={cleanImageUrl(draft.image)}
                      alt="Preview"
                      onError={handleImageError}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: 20 }}>
                      {(draft.name || '?').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                {draft.badge && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: -4,
                      background: accentColor,
                      color: '#fff',
                      fontSize: 8.5,
                      fontWeight: 900,
                      padding: '2px 7px',
                      borderRadius: 99,
                    }}
                  >
                    {draft.badge}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#0f172a' }}>
                {draft.name || 'Prévia'}
              </span>
            </div>

            {/* Form fields */}
            <div
              style={{
                flex: 1,
                minWidth: 240,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: 10,
              }}
            >
              <div>
                <label style={labelStyle}>Nome *</label>
                <input
                  value={draft.name || ''}
                  onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                  placeholder={collectionName === 'home-brands' ? 'Ex.: Heineken' : 'Ex.: Padaria Artesanal'}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Subtítulo (opcional)</label>
                <input
                  value={draft.subtitle || ''}
                  onChange={(e) => setDraft((p) => ({ ...p, subtitle: e.target.value }))}
                  placeholder={collectionName === 'home-brands' ? 'Ex.: Cervejas' : 'Ex.: Pães & Doces'}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Link de Destino</label>
                <input
                  value={draft.link || ''}
                  onChange={(e) => setDraft((p) => ({ ...p, link: e.target.value }))}
                  placeholder="/search?q=Heineken ou /padaria"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Selo / Badge (opcional)</label>
                <input
                  value={draft.badge || ''}
                  onChange={(e) => setDraft((p) => ({ ...p, badge: e.target.value }))}
                  placeholder="Ex.: Local, VIP, Novo"
                  style={inputStyle}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Logo / Foto (Upload ou URL)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={draft.image || ''}
                    onChange={(e) => setDraft((p) => ({ ...p, image: e.target.value }))}
                    placeholder="/heineken.png ou https://..."
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadImage}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={btnGhost}
                  >
                    <UploadCloud size={14} /> {uploading ? 'Enviando...' : 'Subir Foto'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setEditingId(null);
                setDraft({});
              }}
              style={btnGhost}
            >
              Cancelar
            </button>
            <button type="button" onClick={handleSave} disabled={saving} style={btnPrimary(accentColor)}>
              <Check size={14} /> {saving ? 'Salvando...' : 'Salvar Card'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {sorted.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '36px 20px' }}>
          <Icon size={32} color="#94a3b8" style={{ marginBottom: 10 }} />
          <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>
            Nenhum item cadastrado no Firestore ainda. A Home exibe os exemplos padrão até você cadastrar ou carregar exemplos.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map((item, idx) => (
            <div
              key={item.id}
              style={{
                background: item.active === false ? '#f8fafc' : '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                opacity: item.active === false ? 0.6 : 1,
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: `2px solid ${accentColor}`,
                  background: '#0f172a',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.image ? (
                  <img
                    src={cleanImageUrl(item.image)}
                    alt={item.name}
                    onError={handleImageError}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>
                    {item.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a' }}>{item.name}</span>
                  {item.badge && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 900,
                        padding: '2px 7px',
                        borderRadius: 99,
                        background: `${accentColor}15`,
                        color: accentColor,
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                  {item.subtitle ? `${item.subtitle} • ` : ''}
                  {item.link || 'Sem link'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                <button
                  type="button"
                  disabled={idx === 0 || saving}
                  onClick={() => handleMove(idx, -1)}
                  style={{ ...iconBtn('#334155'), opacity: idx === 0 ? 0.35 : 1 }}
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  disabled={idx === sorted.length - 1 || saving}
                  onClick={() => handleMove(idx, 1)}
                  style={{ ...iconBtn('#334155'), opacity: idx === sorted.length - 1 ? 0.35 : 1 }}
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(item.id);
                    setCreating(false);
                    setDraft(item);
                  }}
                  style={iconBtn('#4f46e5')}
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleToggleActive(item)}
                  style={iconBtn(item.active === false ? '#94a3b8' : '#10b981')}
                >
                  {item.active === false ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleDelete(item)}
                  style={iconBtn('#ef4444')}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

