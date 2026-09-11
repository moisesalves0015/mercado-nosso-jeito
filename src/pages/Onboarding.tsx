import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, onSnapshot, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { DEFAULT_SHIPPING } from '../hooks/useShippingConfig';
import { AuthBackground, AuthStyles, MercadoLogo } from './Login';
import { MapPin, Phone, User, Check, Building2 } from 'lucide-react';

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: '48px',
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  borderRadius: '12px',
  padding: '0 16px',
  color: 'var(--text-primary)',
  fontSize: '14px',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'all 0.25s ease',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--text-muted)',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
};

// Masks
const maskCPF = (v: string) => {
  return v
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    .slice(0, 14);
};

const maskPhone = (v: string) => {
  return v
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .slice(0, 15);
};

export const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { user, userProfile, updateUserProfile } = useAuth();
  const { error, success } = useToast();

  const [cpf, setCpf] = useState(userProfile?.cpf || '');
  const [telefone, setTelefone] = useState(userProfile?.telefone || '');
  const [condominio, setCondominio] = useState('');
  const [customCondo, setCustomCondo] = useState('');
  const [complemento, setComplemento] = useState('');

  const [condos, setCondos] = useState<{ name: string; fee: number }[]>([]);
  const [loadingCondos, setLoadingCondos] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // If user somehow lands here but is already fully onboarded, redirect
    if (userProfile?.onboardingComplete) {
      navigate('/', { replace: true });
    }
  }, [userProfile, navigate]);

  useEffect(() => {
    const parseCondosData = (data: any): { name: string; fee: number }[] => {
      if (!data) return [];
      if (Array.isArray(data.condosList) && data.condosList.length > 0) {
        return data.condosList.map((c: any) => ({
          name: typeof c === 'string' ? c.trim() : (c.name || '').trim(),
          fee: Number(c.fee) || 0
        })).filter((c: any) => c.name);
      }
      if (Array.isArray(data.condos) && data.condos.length > 0) {
        return data.condos.map((c: any) => ({
          name: typeof c === 'string' ? c.trim() : (c.name || '').trim(),
          fee: Number(c.fee) || 0
        })).filter((c: any) => c.name);
      }
      if (data.condos && typeof data.condos === 'object') {
        return Object.entries(data.condos).map(([name, fee]) => ({
          name: name.trim(),
          fee: Number(fee) || 0
        })).filter(c => c.name);
      }
      return [];
    };

    const docRef = doc(db, 'settings', 'shipping');
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const parsed = parseCondosData(docSnap.data());
        if (parsed.length > 0) {
          setCondos(parsed);
          setLoadingCondos(false);
          return;
        }
      }
      // If settings/shipping doesn't exist or has no condos, check configs/shipping
      getDoc(doc(db, 'configs', 'shipping')).then(configSnap => {
        if (configSnap.exists()) {
          const parsed = parseCondosData(configSnap.data());
          if (parsed.length > 0) {
            setCondos(parsed);
            setLoadingCondos(false);
            return;
          }
        }
        // Default fallback
        setCondos(Object.entries(DEFAULT_SHIPPING.condos).map(([name, fee]) => ({ name, fee })));
        setLoadingCondos(false);
      }).catch(() => {
        setCondos(Object.entries(DEFAULT_SHIPPING.condos).map(([name, fee]) => ({ name, fee })));
        setLoadingCondos(false);
      });
    }, (err) => {
      console.warn('Realtime subscription error in onboarding, falling back:', err);
      getDoc(doc(db, 'configs', 'shipping')).then(configSnap => {
        if (configSnap.exists()) {
          const parsed = parseCondosData(configSnap.data());
          if (parsed.length > 0) {
            setCondos(parsed);
            setLoadingCondos(false);
            return;
          }
        }
        setCondos(Object.entries(DEFAULT_SHIPPING.condos).map(([name, fee]) => ({ name, fee })));
        setLoadingCondos(false);
      }).catch(() => {
        setCondos(Object.entries(DEFAULT_SHIPPING.condos).map(([name, fee]) => ({ name, fee })));
        setLoadingCondos(false);
      });
    });

    return () => unsub();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const finalCondo = condominio === '__other__' ? customCondo.trim() : (condominio.trim() || customCondo.trim());

    if (cpf.length < 14) return error('Erro', 'CPF inválido');
    if (telefone.length < 14) return error('Erro', 'Telefone inválido');
    if (!finalCondo) return error('Erro', 'Selecione ou informe o seu condomínio');
    if (!complemento.trim()) return error('Erro', 'Informe o seu bloco e apartamento');

    setSaving(true);
    try {
      // 1. Save address (with fallback catch so address error doesn't block onboarding)
      try {
        await addDoc(collection(db, 'users', user.uid, 'addresses'), {
          type: 'home',
          label: 'Casa',
          street: finalCondo,
          number: 'S/N',
          complement: complemento.trim(),
          neighborhood: 'Condomínio',
          city: '',
          state: '',
          cep: '00000-000',
          isDefault: true,
          createdAt: serverTimestamp(),
        });
      } catch (addrErr) {
        console.warn('Could not save address to subcollection:', addrErr);
      }

      // 2. Update user profile and complete onboarding
      await updateUserProfile({
        cpf,
        telefone,
        onboardingComplete: true,
      });

      success('Tudo certo!', 'Seu cadastro foi concluído com sucesso.');
      navigate('/', { replace: true });
    } catch (e: any) {
      console.error(e);
      error('Erro ao salvar', e?.message || 'Não foi possível concluir o cadastro.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', fontFamily: "'Manrope','Outfit',sans-serif", display: 'flex', flexDirection: 'column' }}>
      <AuthBackground />
      <AuthStyles />
      
      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ marginBottom: '32px', animation: 'authFadeIn 0.6s ease' }}>
          <MercadoLogo size="lg" />
        </div>

        <div style={{
          background: 'var(--card-gradient)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: '1px solid var(--border-gold)',
          borderRadius: '24px',
          padding: '32px 24px',
          width: '100%',
          maxWidth: '420px',
          boxShadow: 'var(--card-shadow)',
          animation: 'authFadeIn 0.6s ease 0.1s both',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              Falta pouco!
            </h1>
            <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Precisamos de alguns detalhes para garantir as entregas no seu condomínio.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* CPF */}
            <div>
              <label style={labelStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={13} /> CPF
                </div>
              </label>
              <input
                type="text"
                value={cpf}
                onChange={e => setCpf(maskCPF(e.target.value))}
                style={inputStyle}
                placeholder="000.000.000-00"
                inputMode="numeric"
                required
              />
            </div>

            {/* Telefone */}
            <div>
              <label style={labelStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={13} /> WhatsApp / Telefone
                </div>
              </label>
              <input
                type="text"
                value={telefone}
                onChange={e => setTelefone(maskPhone(e.target.value))}
                style={inputStyle}
                placeholder="(00) 00000-0000"
                inputMode="numeric"
                required
              />
            </div>

            <div style={{ height: '1px', background: 'var(--border-primary)', margin: '4px 0' }} />

            {/* Condomínio */}
            <div>
              <label style={labelStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Building2 size={13} /> Condomínio
                </div>
              </label>

              <select
                value={condominio}
                onChange={e => setCondominio(e.target.value)}
                style={{
                  ...inputStyle,
                  cursor: 'pointer',
                  appearance: 'none',
                  background: 'var(--input-bg) url("data:image/svg+xml;utf8,<svg fill=%27%23a1a1aa%27 height=%2724%27 viewBox=%270 0 24 24%27 width=%2724%27 xmlns=%27http://www.w3.org/2000/svg%27><path d=%27M7 10l5 5 5-5z%27/></svg>") no-repeat right 8px center'
                }}
                required
              >
                <option value="" disabled>Selecione seu condomínio...</option>
                {condos.map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
                <option value="__other__">Outro condomínio (não listado)</option>
              </select>

              {(condominio === '__other__' || (condos.length === 0 && !loadingCondos)) && (
                <div style={{ marginTop: '10px' }}>
                  <input
                    type="text"
                    value={customCondo}
                    onChange={e => setCustomCondo(e.target.value)}
                    style={inputStyle}
                    placeholder="Digite o nome do seu condomínio"
                    required
                    autoFocus
                  />
                </div>
              )}

              {loadingCondos && (
                <span style={{ fontSize: '11px', color: '#D4AF37', marginTop: '4px', display: 'block' }}>
                  Carregando condomínios...
                </span>
              )}
            </div>

            {/* Complemento */}
            <div>
              <label style={labelStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={13} /> Bloco e Apartamento
                </div>
              </label>
              <input
                type="text"
                value={complemento}
                onChange={e => setComplemento(e.target.value)}
                style={inputStyle}
                placeholder="Ex: Bloco B, Apto 101"
                required
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                marginTop: '8px',
                height: '52px',
                background: 'linear-gradient(135deg, #D4AF37, #FFDF73)',
                border: 'none',
                borderRadius: '14px',
                color: '#000',
                fontWeight: 800,
                fontSize: '15px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 6px 20px rgba(212,175,55,0.3)',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? (
                <>
                  <span className="auth-spinner" style={{ borderTopColor: '#000', borderColor: 'rgba(0,0,0,0.2)' }} />
                  Salvando...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Concluir Cadastro
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
