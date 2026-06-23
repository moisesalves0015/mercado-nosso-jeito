import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Plus, ArrowLeft, Home, Briefcase, MoreHorizontal,
  Edit3, Trash2, Check, X, Star, Building2, Navigation,
  AlertTriangle
} from 'lucide-react';
import { MercadoLogo, AuthBackground, AuthStyles } from './Login';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../hooks/useAuth';
import { db } from '../firebase';
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore';

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────
export type AddressType = 'home' | 'work' | 'other';

export interface Address {
  id: string;
  label: string;
  type: AddressType;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
  isDefault: boolean;
  createdAt?: Date;
}

// ──────────────────────────────────────────────────────────────
// Design tokens
// ──────────────────────────────────────────────────────────────
const card = {
  background: 'var(--card-gradient)',
  backdropFilter: 'blur(28px)',
  WebkitBackdropFilter: 'blur(28px)',
  border: '1px solid var(--border-gold)',
  borderRadius: '20px',
  boxShadow: 'var(--card-shadow)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '44px',
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  borderRadius: '11px',
  padding: '0 14px',
  color: 'var(--text-primary)',
  fontSize: '13.5px',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'all 0.25s ease',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '10px',
  fontWeight: 700,
  color: 'var(--text-muted)',
  marginBottom: '5px',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
};

// ──────────────────────────────────────────────────────────────
// Address type config
// ──────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<AddressType, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
  home:  { icon: <Home size={16} />,      label: 'Casa',     color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  work:  { icon: <Briefcase size={16} />, label: 'Trabalho', color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
  other: { icon: <Building2 size={16} />, label: 'Outro',    color: '#D4AF37', bg: 'rgba(212,175,55,0.12)' },
};

// ──────────────────────────────────────────────────────────────
// CEP mask
// ──────────────────────────────────────────────────────────────
const maskCep = (v: string) => v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');

// ──────────────────────────────────────────────────────────────
// Fetch address from ViaCEP
// ──────────────────────────────────────────────────────────────
const fetchCep = async (cep: string) => {
  const raw = cep.replace(/\D/g, '');
  if (raw.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return data;
  } catch { return null; }
};

// ──────────────────────────────────────────────────────────────
// Empty form factory
// ──────────────────────────────────────────────────────────────
const emptyForm = (): Omit<Address, 'id' | 'createdAt'> => ({
  label: '',
  type: 'home',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  cep: '',
  isDefault: false,
});

// ──────────────────────────────────────────────────────────────
// Address Form
// ──────────────────────────────────────────────────────────────
interface FormProps {
  initial?: Partial<Address>;
  onSave: (data: Omit<Address, 'id' | 'createdAt'>) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

const AddressForm: React.FC<FormProps> = ({ initial, onSave, onCancel, saving }) => {
  const [form, setForm] = useState<Omit<Address, 'id' | 'createdAt'>>({ ...emptyForm(), ...initial });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cepLoading, setCepLoading] = useState(false);

  const set = (k: keyof typeof form, v: string | boolean | AddressType) =>
    setForm(p => ({ ...p, [k]: v }));

  const handleCep = async (raw: string) => {
    const masked = maskCep(raw);
    set('cep', masked);
    if (masked.replace(/\D/g, '').length === 8) {
      setCepLoading(true);
      const data = await fetchCep(masked);
      if (data) {
        setForm(p => ({
          ...p,
          street: data.logradouro || p.street,
          neighborhood: data.bairro || p.neighborhood,
          city: data.localidade || p.city,
          state: data.uf || p.state,
        }));
      }
      setCepLoading(false);
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.cep || form.cep.replace(/\D/g,'').length < 8) e.cep = 'CEP inválido';
    if (!form.street.trim()) e.street = 'Logradouro obrigatório';
    if (!form.number.trim()) e.number = 'Número obrigatório';
    if (!form.neighborhood.trim()) e.neighborhood = 'Bairro obrigatório';
    if (!form.city.trim()) e.city = 'Cidade obrigatória';
    if (!form.state.trim()) e.state = 'Estado obrigatório';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    await onSave(form);
  };

  const inputClass = (key: string): React.CSSProperties => ({
    ...inputStyle,
    borderColor: errors[key] ? 'rgba(239,68,68,0.5)' : undefined,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Type selector */}
      <div>
        <label style={labelStyle}>Tipo de endereço</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(Object.keys(TYPE_CONFIG) as AddressType[]).map(t => {
            const cfg = TYPE_CONFIG[t];
            const active = form.type === t;
            return (
              <button
                key={t}
                onClick={() => set('type', t)}
                className="addr-type-btn"
                style={{
                  flex: 1, height: '40px',
                  background: active ? cfg.bg : 'var(--input-bg)',
                  border: `1px solid ${active ? cfg.color + '60' : 'var(--border-primary)'}`,
                  borderRadius: '10px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  color: active ? cfg.color : 'var(--text-secondary)',
                  fontSize: '11.5px', fontWeight: 700, fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                }}
              >
                {cfg.icon} {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Label */}
      <div>
        <label style={labelStyle}>Apelido (opcional)</label>
        <input
          type="text"
          placeholder="Ex: Minha casa, Escritório..."
          value={form.label}
          onChange={e => set('label', e.target.value)}
          style={inputStyle}
          className="addr-input"
        />
      </div>

      {/* CEP */}
      <div>
        <label style={labelStyle}>CEP {cepLoading && <span style={{ color: '#D4AF37', marginLeft: '6px', fontSize: '9px' }}>Buscando...</span>}</label>
        <input
          type="text"
          placeholder="00000-000"
          value={form.cep}
          onChange={e => handleCep(e.target.value)}
          style={inputClass('cep')}
          className="addr-input"
          inputMode="numeric"
        />
        {errors.cep && <span style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.cep}</span>}
      </div>

      {/* Street + Number */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <div style={{ flex: 3 }}>
          <label style={labelStyle}>Logradouro</label>
          <input type="text" placeholder="Rua, Av., Alameda..." value={form.street}
            onChange={e => { set('street', e.target.value); if (errors.street) setErrors(p => ({ ...p, street: '' })); }}
            style={inputClass('street')} className="addr-input" />
          {errors.street && <span style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.street}</span>}
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Número</label>
          <input type="text" placeholder="Nº" value={form.number}
            onChange={e => { set('number', e.target.value); if (errors.number) setErrors(p => ({ ...p, number: '' })); }}
            style={inputClass('number')} className="addr-input" />
          {errors.number && <span style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.number}</span>}
        </div>
      </div>

      {/* Complement */}
      <div>
        <label style={labelStyle}>Complemento (opcional)</label>
        <input type="text" placeholder="Apto, Bloco, Casa..." value={form.complement || ''}
          onChange={e => set('complement', e.target.value)}
          style={inputStyle} className="addr-input" />
      </div>

      {/* Neighborhood */}
      <div>
        <label style={labelStyle}>Bairro</label>
        <input type="text" placeholder="Bairro" value={form.neighborhood}
          onChange={e => { set('neighborhood', e.target.value); if (errors.neighborhood) setErrors(p => ({ ...p, neighborhood: '' })); }}
          style={inputClass('neighborhood')} className="addr-input" />
        {errors.neighborhood && <span style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.neighborhood}</span>}
      </div>

      {/* City + State */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <div style={{ flex: 3 }}>
          <label style={labelStyle}>Cidade</label>
          <input type="text" placeholder="Cidade" value={form.city}
            onChange={e => { set('city', e.target.value); if (errors.city) setErrors(p => ({ ...p, city: '' })); }}
            style={inputClass('city')} className="addr-input" />
          {errors.city && <span style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.city}</span>}
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>UF</label>
          <input type="text" placeholder="SP" maxLength={2} value={form.state}
            onChange={e => { set('state', e.target.value.toUpperCase()); if (errors.state) setErrors(p => ({ ...p, state: '' })); }}
            style={inputClass('state')} className="addr-input" />
          {errors.state && <span style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px', display: 'block' }}>{errors.state}</span>}
        </div>
      </div>

      {/* Default toggle */}
      <button
        onClick={() => set('isDefault', !form.isDefault)}
        className="addr-toggle-btn"
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: form.isDefault ? 'rgba(212,175,55,0.08)' : 'var(--input-bg)',
          border: `1px solid ${form.isDefault ? 'rgba(212,175,55,0.3)' : 'var(--border-primary)'}`,
          borderRadius: '11px', padding: '11px 14px', cursor: 'pointer',
          width: '100%', textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        <div style={{
          width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
          background: form.isDefault ? 'linear-gradient(135deg, #D4AF37, #FFDF73)' : 'var(--input-bg)',
          border: `1.5px solid ${form.isDefault ? 'transparent' : 'var(--border-primary)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s ease',
        }}>
          {form.isDefault && <Check size={12} color="#000" strokeWidth={3} />}
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: form.isDefault ? '#D4AF37' : 'var(--text-primary)' }}>
            Endereço padrão
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
            Usado automaticamente no checkout
          </div>
        </div>
      </button>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
        <button onClick={onCancel} className="addr-cancel-btn" style={{
          flex: 1, height: '44px',
          background: 'var(--input-bg)', border: '1px solid var(--input-border)',
          borderRadius: '12px', color: 'var(--text-secondary)', fontWeight: 700,
          fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <X size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Cancelar
        </button>
        <button onClick={handleSubmit} disabled={saving} className="addr-save-btn" style={{
          flex: 2, height: '44px',
          background: 'linear-gradient(135deg, #D4AF37, #FFDF73)',
          border: 'none', borderRadius: '12px', color: '#000',
          fontWeight: 800, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          boxShadow: '0 4px 16px rgba(212,175,55,0.3)',
          opacity: saving ? 0.7 : 1,
        }}>
          {saving ? <><span className="addr-spinner" /> Salvando...</> : <><Check size={14} /> Salvar endereço</>}
        </button>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// Address Card
// ──────────────────────────────────────────────────────────────
const AddressCard: React.FC<{
  addr: Address;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}> = ({ addr, onEdit, onDelete, onSetDefault }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const cfg = TYPE_CONFIG[addr.type];

  return (
    <div style={{
      ...card,
      padding: '14px 16px',
      position: 'relative',
      border: addr.isDefault ? '1px solid rgba(212,175,55,0.4)' : '1px solid var(--border-gold)',
    }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        {/* Type icon */}
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
          background: cfg.bg, border: `1px solid ${cfg.color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: cfg.color,
        }}>
          {cfg.icon}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {addr.label || cfg.label}
            </span>
            {addr.isDefault && (
              <span style={{
                fontSize: '9px', fontWeight: 800,
                background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)',
                color: '#D4AF37', borderRadius: '99px', padding: '2px 8px',
                textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                ★ Padrão
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {addr.street}, {addr.number}
            {addr.complement ? `, ${addr.complement}` : ''}<br />
            {addr.neighborhood} · {addr.city}/{addr.state}<br />
            <span style={{ color: 'var(--text-muted)' }}>CEP {addr.cep}</span>
          </div>
        </div>

        {/* Menu */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="addr-menu-btn"
            style={{
              width: '32px', height: '32px', borderRadius: '10px',
              background: 'var(--input-bg)', border: '1px solid var(--border-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-secondary)',
            }}
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setMenuOpen(false)} />
              <div style={{
                position: 'absolute', right: 0, top: '38px', zIndex: 100,
                background: 'var(--bg-secondary)', backdropFilter: 'blur(20px)',
                border: '1px solid var(--border-gold)', borderRadius: '14px',
                overflow: 'hidden', minWidth: '160px',
                boxShadow: 'var(--card-shadow)',
              }}>
                {!addr.isDefault && (
                  <button onClick={() => { onSetDefault(); setMenuOpen(false); }} className="addr-menu-item" style={{
                    width: '100%', padding: '12px 14px', background: 'none', border: 'none',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    color: '#D4AF37', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'inherit', textAlign: 'left',
                  }}>
                    <Star size={14} /> Definir como padrão
                  </button>
                )}
                <button onClick={() => { onEdit(); setMenuOpen(false); }} className="addr-menu-item" style={{
                  width: '100%', padding: '12px 14px', background: 'none', border: 'none',
                  display: 'flex', alignItems: 'center', gap: '10px',
                  color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  borderTop: addr.isDefault ? 'none' : '1px solid var(--border-primary)',
                }}>
                  <Edit3 size={14} /> Editar
                </button>
                <button onClick={() => { onDelete(); setMenuOpen(false); }} className="addr-menu-item" style={{
                  width: '100%', padding: '12px 14px', background: 'none', border: 'none',
                  display: 'flex', alignItems: 'center', gap: '10px',
                  color: '#ef4444', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  borderTop: '1px solid var(--border-primary)',
                }}>
                  <Trash2 size={14} /> Remover
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// Delete Confirm Modal
// ──────────────────────────────────────────────────────────────
const DeleteModal: React.FC<{ onConfirm: () => void; onCancel: () => void; deleting: boolean }> = ({ onConfirm, onCancel, deleting }) => (
  <div style={{
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, padding: '24px', animation: 'addrFadeIn 0.2s ease',
  }} onClick={onCancel}>
    <div style={{
      background: 'var(--bg-secondary)', border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: '22px', padding: '28px 22px', width: '100%', maxWidth: '300px',
      boxShadow: 'var(--card-shadow)', animation: 'addrModalPop 0.25s cubic-bezier(0.34,1.56,0.64,1)',
    }} onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '50%',
          background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <AlertTriangle size={22} color="#ef4444" />
        </div>
      </div>
      <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', margin: '0 0 8px' }}>
        Remover endereço?
      </h3>
      <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', textAlign: 'center', margin: '0 0 22px', lineHeight: 1.5 }}>
        Esta ação não pode ser desfeita.
      </p>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onCancel} className="addr-cancel-btn" style={{
          flex: 1, height: '42px',
          background: 'var(--input-bg)', border: '1px solid var(--input-border)',
          borderRadius: '12px', color: 'var(--text-secondary)', fontWeight: 700,
          fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
        }}>Cancelar</button>
        <button onClick={onConfirm} disabled={deleting} style={{
          flex: 1, height: '42px',
          background: 'rgba(239,68,68,0.85)', border: 'none',
          borderRadius: '12px', color: '#fff', fontWeight: 800,
          fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          opacity: deleting ? 0.7 : 1,
        }}>
          {deleting ? <span className="addr-spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.2)' }} /> : <Trash2 size={13} />}
          Remover
        </button>
      </div>
    </div>
  </div>
);

// ──────────────────────────────────────────────────────────────
// Empty State
// ──────────────────────────────────────────────────────────────
const EmptyAddresses: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '52px 24px', textAlign: 'center', gap: '16px',
  }}>
    <div style={{
      width: '70px', height: '70px', borderRadius: '22px',
      background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Navigation size={28} color="rgba(212,175,55,0.4)" />
    </div>
    <div>
      <h3 style={{ fontSize: '17px', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 6px' }}>
        Nenhum endereço ainda
      </h3>
      <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5, maxWidth: '220px' }}>
        Adicione seus endereços para agilizar as entregas.
      </p>
    </div>
    <button onClick={onAdd} className="addr-save-btn" style={{
      height: '46px', padding: '0 28px',
      background: 'linear-gradient(135deg, #D4AF37, #FFDF73)',
      border: 'none', borderRadius: '14px', color: '#000',
      fontWeight: 800, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
      display: 'flex', alignItems: 'center', gap: '8px',
      boxShadow: '0 6px 20px rgba(212,175,55,0.35)',
    }}>
      <Plus size={16} /> Adicionar endereço
    </button>
  </div>
);

// ──────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────
export const Addresses: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState(false);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Firestore listener ──────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'users', user.uid, 'addresses'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setAddresses(snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() ?? undefined,
      } as Address)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [user?.uid]);

  // ── Save address ────────────────────────────────────────────
  const handleSave = async (data: Omit<Address, 'id' | 'createdAt'>) => {
    if (!user?.uid) return;
    setSavingId(true);
    try {
      // If setting as default, unset others first
      if (data.isDefault) {
        await Promise.all(
          addresses
            .filter(a => a.isDefault && a.id !== editingId)
            .map(a => updateDoc(doc(db, 'users', user.uid, 'addresses', a.id), { isDefault: false }))
        );
      }

      if (editingId) {
        await updateDoc(doc(db, 'users', user.uid, 'addresses', editingId), {
          ...data, updatedAt: serverTimestamp(),
        });
        success('Endereço atualizado!', 'As alterações foram salvas.');
      } else {
        await addDoc(collection(db, 'users', user.uid, 'addresses'), {
          ...data, createdAt: serverTimestamp(),
        });
        success('Endereço adicionado!', 'Endereço salvo com sucesso.');
      }
      setShowForm(false);
      setEditingId(null);
    } catch { toastError('Erro ao salvar', 'Tente novamente.'); }
    finally { setSavingId(false); }
  };

  // ── Delete address ──────────────────────────────────────────
  const handleDelete = async () => {
    if (!user?.uid || !deleteTargetId) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'addresses', deleteTargetId));
      success('Removido', 'Endereço excluído com sucesso.');
      setDeleteTargetId(null);
    } catch { toastError('Erro', 'Não foi possível remover.'); }
    finally { setDeleting(false); }
  };

  // ── Set default ─────────────────────────────────────────────
  const handleSetDefault = async (id: string) => {
    if (!user?.uid) return;
    try {
      await Promise.all([
        ...addresses.filter(a => a.isDefault).map(a =>
          updateDoc(doc(db, 'users', user.uid, 'addresses', a.id), { isDefault: false })
        ),
        updateDoc(doc(db, 'users', user.uid, 'addresses', id), { isDefault: true }),
      ]);
      success('Padrão atualizado!', 'Endereço padrão alterado.');
    } catch { toastError('Erro', 'Não foi possível atualizar.'); }
  };

  const startEdit = (addr: Address) => {
    setEditingId(addr.id);
    setShowForm(true);
  };

  const cancelForm = () => { setShowForm(false); setEditingId(null); };

  const editingAddr = editingId ? addresses.find(a => a.id === editingId) : undefined;

  const skeletonCard = (
    <div style={{ ...card, padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--input-bg)', animation: 'addrShimmer 1.4s ease-in-out infinite' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ width: '55%', height: 14, borderRadius: 7, background: 'var(--border-primary)', animation: 'addrShimmer 1.4s ease-in-out infinite' }} />
        <div style={{ width: '80%', height: 11, borderRadius: 6, background: 'var(--input-bg)', animation: 'addrShimmer 1.4s ease-in-out infinite 0.1s' }} />
        <div style={{ width: '65%', height: 11, borderRadius: 6, background: 'var(--input-bg)', animation: 'addrShimmer 1.4s ease-in-out infinite 0.2s' }} />
      </div>
    </div>
  );

  return (
    <div style={{ position: 'relative', minHeight: '100vh', fontFamily: "'Manrope','Outfit',sans-serif" }}>
      <AuthBackground />
      <AuthStyles />

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', paddingBottom: '110px' }}>

        {/* ── Topbar ─────────────────────────────────────────── */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 20,
          background: 'var(--bg-secondary)', backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-primary)',
        }}>
          <div className="safe-area-top-bg" style={{ background: 'var(--bg-secondary)' }} />
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
          }}>
            <button onClick={() => navigate(-1)} className="addr-back-btn" style={{
              background: 'var(--back-btn-bg)', border: '1px solid var(--border-primary)',
              borderRadius: '50%', width: 38, height: 38,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-primary)',
            }}>
              <ArrowLeft size={18} />
            </button>
            <MercadoLogo size="sm" />
            <button
              onClick={() => { cancelForm(); setShowForm(true); }}
              className="addr-add-header-btn"
              style={{
                background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)',
                borderRadius: '10px', width: 38, height: 38,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#D4AF37',
              }}
              title="Adicionar endereço"
            >
              <Plus size={17} />
            </button>
          </div>
        </div>

        {/* ── Page header ────────────────────────────────────── */}
        <div style={{ padding: '18px 16px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '10px',
              background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MapPin size={16} color="#D4AF37" />
            </div>
            <h1 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
              Meus Endereços
            </h1>
          </div>
          <p style={{ fontSize: '11px', color: '#D4AF37', margin: '0 0 0 42px', fontWeight: 600 }}>
            {addresses.length} endereço{addresses.length !== 1 ? 's' : ''} cadastrado{addresses.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div style={{ padding: '8px 16px 0', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* ── Add Form ──────────────────────────────────────── */}
          {showForm && (
            <div style={{ ...card, padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '8px',
                  background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {editingId ? <Edit3 size={13} color="#D4AF37" /> : <Plus size={13} color="#D4AF37" />}
                </div>
                <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {editingId ? 'Editar endereço' : 'Novo endereço'}
                </span>
              </div>
              <AddressForm
                initial={editingAddr}
                onSave={handleSave}
                onCancel={cancelForm}
                saving={savingId}
              />
            </div>
          )}

          {/* ── Loading ───────────────────────────────────────── */}
          {loading && [1, 2].map(i => <div key={i}>{skeletonCard}</div>)}

          {/* ── List ─────────────────────────────────────────── */}
          {!loading && addresses.length === 0 && !showForm && (
            <EmptyAddresses onAdd={() => setShowForm(true)} />
          )}

          {!loading && addresses.map(addr => (
            <AddressCard
              key={addr.id}
              addr={addr}
              onEdit={() => startEdit(addr)}
              onDelete={() => setDeleteTargetId(addr.id)}
              onSetDefault={() => handleSetDefault(addr.id)}
            />
          ))}

          {/* ── Add button at bottom (when there are addresses) ── */}
          {!loading && addresses.length > 0 && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="addr-add-btn"
              style={{
                width: '100%', height: '48px',
                background: 'var(--input-bg)',
                border: '1.5px dashed var(--border-gold)',
                borderRadius: '16px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                color: '#D4AF37', fontSize: '13px', fontWeight: 700, fontFamily: 'inherit',
                transition: 'all 0.2s ease',
              }}
            >
              <Plus size={16} /> Adicionar novo endereço
            </button>
          )}

          {/* ── Tip card ─────────────────────────────────────── */}
          {!loading && (
            <div style={{ ...card, padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'center', border: '1px solid var(--border-primary)' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
                background: 'rgba(99,102,241,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Navigation size={16} color="#6366F1" />
              </div>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                  Entrega no endereço certo
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  O endereço padrão é selecionado automaticamente no checkout. Você pode alterar antes de confirmar.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Delete Modal ─────────────────────────────────────── */}
      {deleteTargetId && (
        <DeleteModal
          onConfirm={handleDelete}
          onCancel={() => setDeleteTargetId(null)}
          deleting={deleting}
        />
      )}

      <AddressStyles />
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// Styles
// ──────────────────────────────────────────────────────────────
const AddressStyles: React.FC = () => (
  <style>{`
    @keyframes addrFadeIn { from { opacity:0 } to { opacity:1 } }
    @keyframes addrModalPop { from { transform: scale(0.85); opacity:0 } to { transform: scale(1); opacity:1 } }
    @keyframes addrShimmer { 0%,100% { opacity:0.4 } 50% { opacity:0.85 } }
    @keyframes addrSpin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
    .addr-spinner {
      display: inline-block; width: 14px; height: 14px;
      border: 2px solid rgba(0,0,0,0.15); border-top-color: #000;
      border-radius: 50%; animation: addrSpin 0.7s linear infinite; flex-shrink: 0;
    }
    .addr-input:focus {
      border-color: rgba(212,175,55,0.5) !important;
      box-shadow: 0 0 0 3px rgba(212,175,55,0.08) !important;
      background: var(--input-bg) !important;
    }
    .addr-input::placeholder { color: var(--text-muted); }
    .addr-save-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(212,175,55,0.4) !important; }
    .addr-save-btn:disabled { opacity: 0.65; cursor: not-allowed; }
    .addr-cancel-btn:hover { background: var(--input-bg) !important; opacity: 0.9; }
    .addr-add-btn:hover { background: rgba(212,175,55,0.1) !important; border-color: rgba(212,175,55,0.5) !important; color: #D4AF37 !important; }
    .addr-menu-btn:hover { background: var(--input-bg) !important; opacity: 0.9; }
    .addr-menu-item:hover { background: var(--input-bg) !important; opacity: 0.9; }
    .addr-back-btn:hover { background: var(--back-btn-bg) !important; opacity: 0.9; }
    .addr-add-header-btn:hover { background: rgba(212,175,55,0.18) !important; }
    .addr-type-btn:active { transform: scale(0.97); }
    .addr-toggle-btn:hover { opacity: 0.85; }
  `}</style>
);
