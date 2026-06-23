import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { validateName, validatePhone, validatePassword, getPasswordStrength } from '../utils/validators';
import { maskPhone } from '../utils/masks';
import {
  User, Mail, Phone, CreditCard, MapPin, ShoppingBag, Ticket,
  HelpCircle, LogOut, ChevronRight, Edit3, Check, X,
  Camera, Lock, Eye, EyeOff, Calendar, Clock, AlertTriangle, ArrowLeft, ShieldAlert, SlidersHorizontal,
  Sun, Moon,
} from 'lucide-react';
import { MercadoLogo, AuthBackground, AuthStyles } from './Login';
// ──────────────────────────────────────────────────────────────
// Shared card & token styles
// ──────────────────────────────────────────────────────────────
const t = {
  card: {
    background: 'var(--card-gradient)',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    border: '1px solid var(--border-primary)',
    borderRadius: '20px',
    padding: '18px',
    boxShadow: 'var(--card-shadow)',
  },
  sectionHeader: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '8px',
    marginBottom: '14px',
    paddingBottom: '12px',
    borderBottom: '1px solid var(--border-primary)',
  },
  sectionHeaderText: {
    fontSize: '10.5px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
  },
  label: {
    display: 'block' as const,
    fontSize: '10px',
    fontWeight: 700,
    color: 'var(--text-muted)',
    marginBottom: '5px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.4px',
  },
  input: {
    width: '100%',
    height: '44px',
    background: 'var(--input-bg)',
    border: '1px solid var(--input-border)',
    borderRadius: '11px',
    paddingLeft: '14px',
    paddingRight: '14px',
    color: 'var(--text-primary)',
    fontSize: '13.5px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'all 0.25s ease',
    fontFamily: 'inherit',
  },
  fieldErr: {
    display: 'block' as const,
    fontSize: '11px',
    color: '#ef4444',
    marginTop: '4px',
    fontWeight: 600,
  },
  saveBtn: {
    flex: 1,
    height: '42px',
    background: 'linear-gradient(135deg, #D4AF37, #FFDF73)',
    border: 'none',
    borderRadius: '11px',
    color: '#000',
    fontWeight: 800,
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: '6px',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 16px rgba(212,175,55,0.3)',
  },
  cancelBtn: {
    flex: 1,
    height: '42px',
    background: 'var(--input-bg)',
    border: '1px solid var(--input-border)',
    borderRadius: '11px',
    color: 'var(--text-secondary)',
    fontWeight: 700,
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: '6px',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  },
  eyeBtn: {
    position: 'absolute' as const,
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex' as const,
    alignItems: 'center' as const,
    padding: '4px',
  },
  miniSpinner: {
    display: 'inline-block' as const,
    width: '14px',
    height: '14px',
    border: '2px solid rgba(0,0,0,0.15)',
    borderTopColor: '#000',
    borderRadius: '50%',
    animation: 'profileSpin 0.7s linear infinite',
    flexShrink: 0,
  },
};

// ──────────────────────────────────────────────────────────────
// Profile Page
// ──────────────────────────────────────────────────────────────
export const Profile: React.FC = () => {
  const { user, userProfile, profileLoading, updateUserProfile, uploadProfilePhoto, changePassword, logout, isAdmin } = useAuth();
  const { success, error: toastError, warning } = useToast();
  const navigate = useNavigate();

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const isLight = theme === 'light';

  const toggleTheme = () => {
    const nextTheme = isLight ? 'dark' : 'light';
    localStorage.setItem('theme', nextTheme);
    setTheme(nextTheme);
    window.dispatchEvent(new Event('theme-changed'));
  };

  // Edit profile
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTelefone, setEditTelefone] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [savingProfile, setSavingProfile] = useState(false);

  // Change password
  const [pwSection, setPwSection] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [savingPw, setSavingPw] = useState(false);

  // Photo
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Logout modal
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setEditName(userProfile.name || '');
      setEditTelefone(userProfile.telefone || '');
    }
  }, [userProfile]);

  // ── Photo ────────────────────────────────────────────────
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setUploadingPhoto(true);
    try {
      await uploadProfilePhoto(file);
      success('Foto atualizada!', 'Sua foto foi salva com sucesso.');
    } catch (err: unknown) {
      const e = err as Error;
      setPhotoPreview(null);
      toastError('Erro no upload', e?.message?.includes('5MB') ? 'A imagem deve ter menos de 5MB.' : 'Não foi possível salvar a foto.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ── Save Profile ─────────────────────────────────────────
  const handleSaveProfile = async () => {
    const newErrors: Record<string, string> = {};
    if (!validateName(editName)) newErrors.name = 'Digite nome e sobrenome';
    if (!validatePhone(editTelefone)) newErrors.telefone = 'Telefone inválido';
    if (Object.keys(newErrors).length > 0) { setEditErrors(newErrors); return; }
    setSavingProfile(true);
    try {
      await updateUserProfile({ name: editName.trim(), telefone: editTelefone });
      success('Perfil salvo!', 'Suas informações foram atualizadas.');
      setEditMode(false); setEditErrors({});
    } catch { toastError('Erro ao salvar', 'Tente novamente.'); }
    finally { setSavingProfile(false); }
  };

  // ── Change Password ──────────────────────────────────────
  const handleChangePw = async () => {
    const errs: Record<string, string> = {};
    if (!currentPw) errs.currentPw = 'Informe a senha atual';
    const r = validatePassword(newPw);
    if (!r.valid) errs.newPw = r.message;
    if (newPw !== confirmPw) errs.confirmPw = 'As senhas não coincidem';
    if (Object.keys(errs).length > 0) { setPwErrors(errs); return; }
    setSavingPw(true);
    try {
      await changePassword(currentPw, newPw);
      success('Senha alterada!', 'Sua senha foi atualizada.');
      setPwSection(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwErrors({});
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential') {
        setPwErrors({ currentPw: 'Senha atual incorreta' });
      } else { toastError('Erro ao alterar senha', 'Tente novamente.'); }
    } finally { setSavingPw(false); }
  };

  // ── Logout ───────────────────────────────────────────────
  const handleLogout = async () => {
    try { await logout(); navigate('/login', { replace: true }); }
    catch { toastError('Erro ao sair', 'Tente novamente.'); }
  };

  const passwordStrength = getPasswordStrength(newPw);
  const avatarUrl = photoPreview || userProfile?.foto || user?.photoURL || '';
  const initials = (userProfile?.name || user?.displayName || 'U')
    .split(' ').slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
  const fmtDate = (d?: Date) => d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const fmtTime = (d?: Date) => d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div style={{ position: 'relative', minHeight: '100vh', fontFamily: "'Manrope','Outfit',sans-serif" }}>
      {/* Supermarket background — same as Home + Login */}
      <AuthBackground />

      {/* Scrollable content */}
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', paddingBottom: '110px' }}>

        {/* ── TOP BAR ──────────────────────────────────────── */}
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'var(--bg-secondary)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-gold)',
        }}>
          <div className="safe-area-top-bg" style={{ background: 'var(--bg-secondary)' }} />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px 12px',
          }}>
            <button
              onClick={() => navigate('/')}
              style={{
                background: 'var(--back-btn-bg)',
                border: '1px solid var(--border-primary)',
                borderRadius: '50%',
                width: '38px', height: '38px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'var(--text-primary)', flexShrink: 0,
              }}
            >
              <ArrowLeft size={18} />
            </button>

            {/* Center logo */}
            <MercadoLogo size="sm" />

            {/* Edit toggle */}
            {!editMode ? (
              <button
                onClick={() => setEditMode(true)}
                style={{
                  background: 'var(--back-btn-bg)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '50%',
                  width: '38px', height: '38px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text-primary)', flexShrink: 0,
                }}
                title="Editar perfil"
              >
                <Edit3 size={16} />
              </button>
            ) : (
              <div style={{ width: '38px' }} /> /* spacer */
            )}
          </div>
        </div>

        <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* ── SKELETON ──────────────────────────────────── */}
          {profileLoading && !userProfile ? (
            <ProfileSkeleton />
          ) : (
            <>
              {/* ── AVATAR CARD ──────────────────────────── */}
              <div style={t.card}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '4px 0 6px' }}>

                  {/* Avatar */}
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      width: '90px', height: '90px', borderRadius: '50%',
                      border: '3px solid rgba(255,255,255,0.2)',
                      overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: avatarUrl ? 'transparent' : 'linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))',
                      boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
                      position: 'relative',
                    }}>
                      {avatarUrl
                        ? <img src={avatarUrl} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '30px', fontWeight: 800, color: '#fff' }}>{initials}</span>
                      }
                      {uploadingPhoto && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ width: '22px', height: '22px', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'profileSpin 0.8s linear infinite', display: 'block' }} />
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      style={{
                        position: 'absolute', bottom: 0, right: 0,
                        width: '30px', height: '30px', borderRadius: '50%',
                        background: 'rgba(255,255,255,0.15)',
                        border: '1.5px solid rgba(255,255,255,0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
                      }}
                      title="Alterar foto"
                    >
                      <Camera size={14} color="#fff" />
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoSelect} />
                  </div>

                  {/* Name & role — view mode */}
                  {!editMode ? (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '19px', fontWeight: 800, color: '#fff', marginBottom: '5px' }}>
                        {userProfile?.name || user?.displayName || 'Usuário'}
                      </div>
                      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginBottom: '10px' }}>
                        {userProfile?.email || user?.email}
                      </div>
                      <span style={{
                        fontSize: '10px', fontWeight: 800,
                        color: userProfile?.role === 'admin' ? '#D4AF37' : '#10b981',
                        background: userProfile?.role === 'admin' ? 'rgba(212,175,55,0.12)' : 'rgba(16,185,129,0.1)',
                        border: `1px solid ${userProfile?.role === 'admin' ? 'rgba(212,175,55,0.3)' : 'rgba(16,185,129,0.25)'}`,
                        padding: '4px 12px', borderRadius: '99px',
                        textTransform: 'uppercase', letterSpacing: '0.8px',
                      }}>
                        {userProfile?.role === 'admin' ? '⚡ Admin' : '✓ Cliente Verificado'}
                      </span>
                    </div>
                  ) : (
                    /* ── Edit mode ──────────────────────── */
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label style={t.label}>Nome Completo</label>
                        <input type="text" value={editName}
                          onChange={e => { setEditName(e.target.value); if (editErrors.name) setEditErrors(p => ({ ...p, name: '' })); }}
                          style={{ ...t.input, borderColor: editErrors.name ? 'rgba(239,68,68,0.5)' : undefined }}
                          className="profile-edit-input" placeholder="Seu nome completo"
                        />
                        {editErrors.name && <span style={t.fieldErr}>{editErrors.name}</span>}
                      </div>
                      <div>
                        <label style={t.label}>Telefone</label>
                        <input type="tel" value={editTelefone}
                          onChange={e => { const m = maskPhone(e.target.value); setEditTelefone(m); if (editErrors.telefone) setEditErrors(p => ({ ...p, telefone: '' })); }}
                          style={{ ...t.input, borderColor: editErrors.telefone ? 'rgba(239,68,68,0.5)' : undefined }}
                          className="profile-edit-input" placeholder="(11) 99999-9999"
                        />
                        {editErrors.telefone && <span style={t.fieldErr}>{editErrors.telefone}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={handleSaveProfile} disabled={savingProfile} style={t.saveBtn} className="profile-save-btn">
                          {savingProfile ? <><span style={t.miniSpinner} /> Salvando...</> : <><Check size={15} /> Salvar</>}
                        </button>
                        <button onClick={() => { setEditMode(false); setEditErrors({}); setEditName(userProfile?.name || ''); setEditTelefone(userProfile?.telefone || ''); }} style={t.cancelBtn} className="profile-cancel-btn">
                          <X size={15} /> Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── CENTRAL DE COLEÇÕES BOTÃO ────────────── */}
              <button
                onClick={() => navigate('/colecoes')}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, rgba(255, 193, 7, 0.15), rgba(212, 175, 55, 0.05))',
                  border: '1px solid rgba(255, 193, 7, 0.3)',
                  borderRadius: 20,
                  padding: '20px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  marginBottom: 16,
                  boxShadow: '0 4px 16px rgba(255, 193, 7, 0.1)',
                  transition: 'all 0.3s ease',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 193, 7, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(255, 193, 7, 0.1)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: 'rgba(255, 193, 7, 0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid rgba(255, 193, 7, 0.4)'
                  }}>
                    <span style={{ fontSize: 22 }}>🏆</span>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#FFC107' }}>
                      Visitar Minha Estante
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                      Acompanhe sua história e selos
                    </p>
                  </div>
                </div>
                <div style={{ color: '#FFC107', opacity: 0.8 }}>
                  <ChevronRight size={20} />
                </div>
              </button>

              {/* ── THEME SWITCHER CARD ────────────────────────── */}
              <div style={t.card}>
                <div style={t.sectionHeader}>
                  {isLight ? <Sun size={14} color="var(--text-primary)" /> : <Moon size={14} color="var(--text-primary)" />}
                  <span style={t.sectionHeaderText}>Aparência</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-primary)' }}>
                    {isLight ? <Sun size={17} color="#D4AF37" /> : <Moon size={17} color="#6366F1" />}
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>Modo Claro</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ativar tema com cores claras</div>
                    </div>
                  </div>
                  <button
                    onClick={toggleTheme}
                    style={{
                      width: '46px',
                      height: '24px',
                      borderRadius: '99px',
                      background: isLight ? 'linear-gradient(135deg, #D4AF37, #FFDF73)' : 'rgba(255,255,255,0.1)',
                      border: '1px solid var(--border-primary)',
                      position: 'relative',
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: isLight ? '#000' : '#fff',
                      position: 'absolute',
                      top: '2px',
                      left: isLight ? '24px' : '2px',
                      transition: 'all 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }} />
                  </button>
                </div>
              </div>

              {/* ── INFO CARD ────────────────────────────── */}
              <div style={t.card}>
                <div style={t.sectionHeader}>
                  <User size={14} color="var(--text-secondary)" />
                  <span style={t.sectionHeaderText}>Dados da Conta</span>
                </div>
                <InfoRow icon={<Mail size={15} color="var(--text-secondary)" />} label="E-mail" value={userProfile?.email || user?.email || '—'} />
                <InfoRow icon={<Phone size={15} color="var(--text-secondary)" />} label="Telefone" value={userProfile?.telefone || 'Não informado'} faded={!userProfile?.telefone} />
                <InfoRow icon={<CreditCard size={15} color="var(--text-secondary)" />} label="CPF" value={userProfile?.cpf || 'Não informado'} faded={!userProfile?.cpf} />
                <InfoRow icon={<Calendar size={15} color="var(--text-secondary)" />} label="Membro desde" value={fmtDate(userProfile?.createdAt)} />
                <InfoRow icon={<Clock size={15} color="var(--text-secondary)" />} label="Último acesso" value={fmtTime(userProfile?.lastLogin)} last />
              </div>

              {/* ── CHANGE PASSWORD ──────────────────────── */}
              <div style={t.card}>
                <button
                  onClick={() => { setPwSection(v => !v); setPwErrors({}); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
                  className="profile-section-toggle"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Lock size={15} color="var(--text-primary)" />
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Alterar Senha</span>
                  </div>
                  <ChevronRight size={17} color="var(--text-muted)" style={{ transform: pwSection ? 'rotate(90deg)' : 'none', transition: 'transform 0.25s ease' }} />
                </button>

                {pwSection && (
                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Current */}
                    <div>
                      <label style={t.label}>Senha Atual</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showPw.current ? 'text' : 'password'} value={currentPw}
                          onChange={e => { setCurrentPw(e.target.value); if (pwErrors.currentPw) setPwErrors(p => ({ ...p, currentPw: '' })); }}
                          style={{ ...t.input, borderColor: pwErrors.currentPw ? 'rgba(239,68,68,0.5)' : undefined, paddingRight: '42px' }}
                          className="profile-edit-input" placeholder="Senha atual"
                        />
                        <button type="button" onClick={() => setShowPw(v => ({ ...v, current: !v.current }))} style={t.eyeBtn}>
                          {showPw.current ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {pwErrors.currentPw && <span style={t.fieldErr}>{pwErrors.currentPw}</span>}
                    </div>
                    {/* New */}
                    <div>
                      <label style={t.label}>Nova Senha</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showPw.new ? 'text' : 'password'} value={newPw}
                          onChange={e => { setNewPw(e.target.value); if (pwErrors.newPw) setPwErrors(p => ({ ...p, newPw: '' })); }}
                          style={{ ...t.input, borderColor: pwErrors.newPw ? 'rgba(239,68,68,0.5)' : undefined, paddingRight: '42px' }}
                          className="profile-edit-input" placeholder="Mínimo 8 caracteres"
                        />
                        <button type="button" onClick={() => setShowPw(v => ({ ...v, new: !v.new }))} style={t.eyeBtn}>
                          {showPw.new ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {newPw && (
                        <div style={{ marginTop: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Força</span>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: passwordStrength.color }}>{passwordStrength.label}</span>
                          </div>
                          <div style={{ height: '3px', background: 'var(--border-primary)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: passwordStrength.width, background: passwordStrength.color, transition: 'all 0.4s ease' }} />
                          </div>
                        </div>
                      )}
                      {pwErrors.newPw && <span style={t.fieldErr}>{pwErrors.newPw}</span>}
                    </div>
                    {/* Confirm */}
                    <div>
                      <label style={t.label}>Confirmar Nova Senha</label>
                      <div style={{ position: 'relative' }}>
                        <input type={showPw.confirm ? 'text' : 'password'} value={confirmPw}
                          onChange={e => { setConfirmPw(e.target.value); if (pwErrors.confirmPw) setPwErrors(p => ({ ...p, confirmPw: '' })); }}
                          style={{ ...t.input, borderColor: pwErrors.confirmPw ? 'rgba(239,68,68,0.5)' : undefined, paddingRight: '42px' }}
                          className="profile-edit-input" placeholder="Repita a nova senha"
                        />
                        <button type="button" onClick={() => setShowPw(v => ({ ...v, confirm: !v.confirm }))} style={t.eyeBtn}>
                          {showPw.confirm ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                      {pwErrors.confirmPw && <span style={t.fieldErr}>{pwErrors.confirmPw}</span>}
                    </div>

                    <button onClick={handleChangePw} disabled={savingPw} style={{ ...t.saveBtn, width: '100%' }} className="profile-save-btn">
                      {savingPw ? <><span style={t.miniSpinner} /> Alterando...</> : <><Lock size={14} /> Alterar senha</>}
                    </button>
                  </div>
                )}
              </div>

              {/* ── ADMIN CRM PORTAL CARD ──────────────────────── */}
              {isAdmin && (
                <div style={t.card}>
                  <div style={t.sectionHeader}>
                    <ShieldAlert size={14} color="var(--text-primary)" />
                    <span style={t.sectionHeaderText}>Portal do Administrador</span>
                  </div>
                  <button
                    onClick={() => navigate('/admin')}
                    style={{
                      width: '100%',
                      height: '46px',
                      background: 'var(--card-gradient)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: '12px',
                      color: 'var(--text-primary)',
                      fontWeight: 800,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontFamily: 'inherit',
                      boxShadow: 'var(--card-shadow)',
                      transition: 'all 0.2s ease',
                    }}
                    className="profile-save-btn"
                  >
                    <SlidersHorizontal size={14} />
                    <span>Acessar Portal do CRM</span>
                  </button>
                </div>
              )}

              {/* ── NAV MENU ─────────────────────────────── */}
              <div style={t.card}>
                <div style={t.sectionHeader}>
                  <ShoppingBag size={14} color="var(--text-primary)" />
                  <span style={t.sectionHeaderText}>Minha Conta</span>
                </div>
                {[
                  { icon: <ShoppingBag size={17} />, label: 'Meus Pedidos', path: '/orders' },
                  { icon: <MapPin size={17} />, label: 'Meus Endereços', path: '/addresses' },
                  { icon: <Ticket size={17} />, label: 'Cupons e Descontos', path: '/coupons' },
                  { icon: <HelpCircle size={17} />, label: 'Ajuda e Suporte', path: '/support' },
                ].map((item, i, arr) => (
                  <button
                    key={item.label}
                    onClick={() => item.path ? navigate(item.path) : warning('Em breve', `${item.label} estará disponível em breve.`)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '13px 0',
                      background: 'none', border: 'none',
                      borderBottom: i < arr.length - 1 ? '1px solid var(--border-primary)' : 'none',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                    className="profile-menu-item"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--text-secondary)', display: 'flex' }}>{item.icon}</span>
                      <span style={{ fontSize: '14px', fontWeight: 600 }}>{item.label}</span>
                    </div>
                    <ChevronRight size={15} color="var(--text-muted)" />
                  </button>
                ))}
              </div>

              {/* ── LOGOUT BUTTON ────────────────────────── */}
              <button
                onClick={() => setShowLogoutModal(true)}
                style={{
                  width: '100%', height: '50px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: '16px',
                  color: '#ef4444', fontWeight: 800, fontSize: '14px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '10px', fontFamily: 'inherit', transition: 'all 0.2s ease',
                  backdropFilter: 'blur(12px)',
                }}
                className="profile-logout-btn"
              >
                <LogOut size={17} />
                Sair da conta
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── LOGOUT MODAL ────────────────────────────────────── */}
      {showLogoutModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '24px', animation: 'profileFadeIn 0.2s ease' }}
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-gold)', borderRadius: '22px', padding: '30px 24px', width: '100%', maxWidth: '320px', boxShadow: 'var(--card-shadow)', animation: 'modalPop 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <div style={{ width: '54px', height: '54px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={24} color="#ef4444" />
              </div>
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', margin: '0 0 8px' }}>Sair da conta?</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 24px', lineHeight: 1.5 }}>
              Você será desconectado do Mercado Nosso Jeito.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowLogoutModal(false)} style={{ ...t.cancelBtn }} className="profile-cancel-btn">Cancelar</button>
              <button onClick={handleLogout} style={{ ...t.saveBtn, flex: 1, background: 'rgba(239,68,68,0.85)', boxShadow: 'none', color: '#fff' }} className="profile-logout-confirm-btn">
                <LogOut size={14} /> Sair
              </button>
            </div>
          </div>
        </div>
      )}

      <ProfileStyles />
      <AuthStyles />
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// InfoRow
// ──────────────────────────────────────────────────────────────
const InfoRow: React.FC<{ icon: React.ReactNode; label: string; value: string; faded?: boolean; last?: boolean }> = ({ icon, label, value, faded, last }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: last ? 'none' : '1px solid var(--border-primary)' }}>
    <span style={{ display: 'flex', flexShrink: 0 }}>{icon}</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '13.5px', color: faded ? 'var(--text-muted)' : 'var(--text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  </div>
);

// ──────────────────────────────────────────────────────────────
// Skeleton
// ──────────────────────────────────────────────────────────────
const ProfileSkeleton: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
    {[1, 2].map(i => (
      <div key={i} style={{ background: 'rgba(9,7,5,0.5)', backdropFilter: 'blur(20px)', border: '1px solid rgba(212,175,55,0.1)', borderRadius: '20px', padding: '20px' }}>
        {i === 1 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: 'rgba(255,255,255,0.07)', animation: 'skeletonPulse 1.5s ease-in-out infinite' }} />
            <div style={{ width: '140px', height: '18px', borderRadius: '8px', background: 'rgba(255,255,255,0.07)', animation: 'skeletonPulse 1.5s ease-in-out infinite' }} />
            <div style={{ width: '100px', height: '13px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', animation: 'skeletonPulse 1.5s ease-in-out infinite' }} />
          </div>
        ) : (
          Array.from({ length: 4 }).map((_, j) => (
            <div key={j} style={{ height: '14px', borderRadius: '7px', background: 'rgba(255,255,255,0.06)', marginBottom: j < 3 ? '14px' : 0, width: j % 2 === 0 ? '60%' : '85%', animation: 'skeletonPulse 1.5s ease-in-out infinite' }} />
          ))
        )}
      </div>
    ))}
  </div>
);

// ──────────────────────────────────────────────────────────────
// CSS
// ──────────────────────────────────────────────────────────────
const ProfileStyles: React.FC = () => (
  <style>{`
    @keyframes profileSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes profileFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes modalPop {
      from { transform: scale(0.85); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    @keyframes skeletonPulse {
      0%, 100% { opacity: 0.35; }
      50% { opacity: 0.75; }
    }
    .profile-edit-input:focus {
      border-color: rgba(212,175,55,0.55) !important;
      box-shadow: 0 0 0 3px rgba(212,175,55,0.08) !important;
      background: rgba(255,255,255,0.08) !important;
    }
    .profile-edit-input::placeholder { color: rgba(255,255,255,0.2); }
    .profile-save-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(212,175,55,0.4) !important; }
    .profile-save-btn:disabled { opacity: 0.65; cursor: not-allowed; }
    .profile-cancel-btn:hover { background: rgba(255,255,255,0.09) !important; }
    .profile-logout-btn:hover { background: rgba(239,68,68,0.14) !important; border-color: rgba(239,68,68,0.35) !important; }
    .profile-logout-confirm-btn:hover { background: rgb(239,68,68) !important; }
    .profile-menu-item:hover { background: rgba(212,175,55,0.05) !important; border-radius: 8px; }
    .profile-section-toggle:hover { opacity: 0.85; }

    body.light-mode .profile-edit-input {
      color: #000 !important;
      background: #fff !important;
      border-color: #cbd5e1 !important;
    }
    body.light-mode .profile-edit-input:focus {
      border-color: #D4AF37 !important;
      background: #fff !important;
      box-shadow: 0 0 0 3px rgba(212,175,55,0.15) !important;
    }
    body.light-mode .profile-edit-input::placeholder {
      color: #94a3b8 !important;
    }
    body.light-mode .profile-menu-item:hover {
      background: rgba(0, 0, 0, 0.04) !important;
    }
    body.light-mode .profile-logout-btn:hover {
      background: rgba(239,68,68,0.05) !important;
    }
    body.light-mode .profile-cancel-btn:hover {
      background: rgba(0, 0, 0, 0.04) !important;
    }
  `}</style>
);

// Suppress unused import warning
void Link;
