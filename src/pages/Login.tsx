import React, { useState, useId } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { validateEmail } from '../utils/validators';
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';

// ──────────────────────────────────────────────────────────────
// Shared Logo — identical to Home Topbar
// ──────────────────────────────────────────────────────────────
export const MercadoLogo: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const scales = { sm: 0.75, md: 1, lg: 1.25 };
  const s = scales[size];
  return (
    <>
      <style>{`
        @font-face {
          font-family: 'Granesta';
          src: url('/Granesta.otf') format('opentype'),
               url('/Granesta.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: block;
        }
        @keyframes megaGoldShine {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        .auth-logo-sub {
          font-family: 'Granesta', cursive !important;
          background: linear-gradient(90deg, #D4AF37, #FFDF73, #F59E0B, #FFDF73, #D4AF37) !important;
          background-size: 200% auto !important;
          -webkit-background-clip: text !important;
          -webkit-text-fill-color: transparent !important;
          background-clip: text !important;
          animation: megaGoldShine 3s linear infinite !important;
          display: inline-block !important;
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <h1 style={{
          fontSize: `${17 * s}px`,
          fontWeight: 800,
          color: '#fff',
          lineHeight: 1.1,
          letterSpacing: '-0.3px',
          margin: 0,
          textTransform: 'lowercase',
          fontFamily: "'Manrope', 'Outfit', sans-serif",
        }}>
          mercado do
        </h1>
        <span
          className="auth-logo-sub"
          style={{
            fontSize: `${32 * s}px`,
            fontWeight: 'normal',
            lineHeight: 1.0,
            letterSpacing: '0.5px',
            textTransform: 'lowercase',
            padding: '0 6px',
          }}
        >
          nosso jeito
        </span>
      </div>
    </>
  );
};

// ──────────────────────────────────────────────────────────────
// Google Button
// ──────────────────────────────────────────────────────────────
export const GoogleSignInButton: React.FC<{ onClick: () => void; loading: boolean; label?: string }> = ({ onClick, loading, label = 'Entrar com Google' }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={loading}
    style={{
      width: '100%',
      height: '46px',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '12px',
      color: '#fff',
      fontWeight: 700,
      fontSize: '13.5px',
      cursor: loading ? 'not-allowed' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      fontFamily: "'Manrope', 'Outfit', sans-serif",
      transition: 'all 0.2s ease',
      opacity: loading ? 0.7 : 1,
    }}
    className="google-btn"
  >
    {loading ? (
      <span style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'authSpin 0.7s linear infinite' }} />
    ) : (
      // Google G SVG
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    )}
    {!loading && label}
  </button>
);

// ──────────────────────────────────────────────────────────────
// Shared auth page background — bg-supermercado + overlay
// ──────────────────────────────────────────────────────────────
export const AuthBackground: React.FC = () => (
  <>
    {/* Real supermarket photo — same as Home */}
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundImage: 'url("/bg-supermercado.jpeg")',
      backgroundSize: 'cover',
      backgroundPosition: 'center 65%',
      filter: 'brightness(0.35)',
      zIndex: 0,
    }} />
    {/* Deep gradient overlay so card stays readable */}
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'linear-gradient(160deg, rgba(9,7,5,0.55) 0%, rgba(9,7,5,0.82) 60%, rgba(9,7,5,0.97) 100%)',
      zIndex: 0,
    }} />
    {/* Subtle gold glow top-right */}
    <div style={{
      position: 'fixed',
      top: '-80px',
      right: '-80px',
      width: '340px',
      height: '340px',
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(212,175,55,0.12) 0%, transparent 70%)',
      filter: 'blur(40px)',
      zIndex: 0,
      pointerEvents: 'none',
    }} />
    {/* Blue glow bottom-left */}
    <div style={{
      position: 'fixed',
      bottom: '-60px',
      left: '-60px',
      width: '280px',
      height: '280px',
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
      filter: 'blur(50px)',
      zIndex: 0,
      pointerEvents: 'none',
    }} />
  </>
);

// ──────────────────────────────────────────────────────────────
// Shared styles
// ──────────────────────────────────────────────────────────────
export const authStyles = {
  page: {
    minHeight: '100vh',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    padding: '32px 16px',
    position: 'relative' as const,
    overflow: 'hidden',
    fontFamily: "'Manrope', 'Outfit', sans-serif",
    zIndex: 1,
  },
  orb: { position: 'absolute' as const, borderRadius: '50%', pointerEvents: 'none' as const },
  backBtn: {
    position: 'absolute' as const,
    top: '20px',
    left: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.8)',
    textDecoration: 'none',
    transition: 'all 0.2s ease',
    zIndex: 10,
    backdropFilter: 'blur(8px)',
  },
  brand: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    marginBottom: '24px',
    zIndex: 2,
    gap: '10px',
  },
  // Status badge matching Home topbar
  statusBadge: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '5px',
    background: 'rgba(46,204,113,0.08)',
    border: '1px solid rgba(46,204,113,0.3)',
    borderRadius: '99px',
    padding: '4px 10px',
    fontSize: '9px',
    fontWeight: 800,
    color: '#2ecc71',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  statusDot: {
    width: '5px',
    height: '5px',
    background: '#2ecc71',
    borderRadius: '50%',
    animation: 'pulse-dot-anim 2s infinite',
  },
  card: {
    width: '100%',
    maxWidth: '390px',
    background: 'rgba(9,7,5,0.6)',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    border: '1px solid rgba(212,175,55,0.2)',
    borderRadius: '22px',
    padding: '26px 22px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
    zIndex: 2,
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: 800,
    color: '#fff',
    marginBottom: '14px',
    textAlign: 'center' as const,
  },
  label: {
    display: 'block' as const,
    fontSize: '10.5px',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '5px',
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
  },
  inputWrapper: { position: 'relative' as const },
  inputIcon: {
    position: 'absolute' as const,
    left: '13px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none' as const,
  },
  input: {
    width: '100%',
    height: '46px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    paddingLeft: '42px',
    paddingRight: '14px',
    color: '#fff',
    fontSize: '13.5px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'all 0.25s ease',
    fontFamily: 'inherit',
  },
  eyeBtn: {
    position: 'absolute' as const,
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    transition: 'color 0.2s',
  },
  fieldError: {
    display: 'block' as const,
    fontSize: '11px',
    color: '#ef4444',
    marginTop: '4px',
    fontWeight: 600,
  },
  forgotLink: {
    fontSize: '11px',
    color: '#D4AF37',
    textDecoration: 'none',
    fontWeight: 700,
    opacity: 0.9,
  },
  submitBtn: {
    width: '100%',
    height: '48px',
    background: 'linear-gradient(135deg, #D4AF37 0%, #FFDF73 50%, #D4AF37 100%)',
    backgroundSize: '200% 100%',
    border: 'none',
    borderRadius: '12px',
    color: '#000',
    fontWeight: 800,
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    boxShadow: '0 6px 24px rgba(212,175,55,0.35)',
    transition: 'all 0.3s ease',
    fontFamily: 'inherit',
    letterSpacing: '0.2px',
    gap: '8px',
  },
  spinner: {
    display: 'inline-block' as const,
    width: '16px',
    height: '16px',
    border: '2px solid rgba(0,0,0,0.15)',
    borderTopColor: '#000',
    borderRadius: '50%',
    animation: 'authSpin 0.7s linear infinite',
    flexShrink: 0,
  },
  divider: {
    display: 'flex' as const,
    alignItems: 'center' as const,
    gap: '12px',
    margin: '20px 0',
  },
  dividerLine: { flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' },
  dividerText: {
    fontSize: '10px',
    fontWeight: 700,
    color: 'rgba(255,255,255,0.25)',
    textTransform: 'uppercase' as const,
    letterSpacing: '1px',
  },
  authLink: { fontSize: '13px', color: '#FFDF73', fontWeight: 800, textDecoration: 'none' },
};

// ──────────────────────────────────────────────────────────────
// Shared CSS
// ──────────────────────────────────────────────────────────────
export const AuthStyles: React.FC = () => (
  <style>{`
    @keyframes authSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes pulse-dot-anim {
      0% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.4); opacity: 0.4; }
      100% { transform: scale(1); opacity: 1; }
    }
    .auth-input:focus {
      border-color: rgba(212,175,55,0.6) !important;
      box-shadow: 0 0 0 3px rgba(212,175,55,0.1) !important;
      background: rgba(255,255,255,0.08) !important;
    }
    .auth-input::placeholder { color: rgba(255,255,255,0.22); }
    .auth-input:disabled { opacity: 0.55; cursor: not-allowed; }
    .auth-submit-btn:hover:not(:disabled) {
      background-position: 100% 0 !important;
      box-shadow: 0 8px 32px rgba(212,175,55,0.5) !important;
      transform: translateY(-1px);
    }
    .auth-submit-btn:active:not(:disabled) { transform: translateY(0); }
    .google-btn:hover:not(:disabled) {
      background: rgba(255,255,255,0.1) !important;
      border-color: rgba(255,255,255,0.25) !important;
    }
    .auth-back-btn:hover {
      background: rgba(255,255,255,0.12) !important;
      color: #fff !important;
    }
  `}</style>
);

// ══════════════════════════════════════════════════════════════
// LOGIN PAGE
// ══════════════════════════════════════════════════════════════
export const Login: React.FC = () => {
  const id = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loadingLocal, setLoadingLocal] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const { login, loginWithGoogle } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from || '/';

  const validateFields = (): boolean => {
    let valid = true;
    if (!email.trim()) { setEmailError('E-mail é obrigatório'); valid = false; }
    else if (!validateEmail(email)) { setEmailError('E-mail inválido'); valid = false; }
    else setEmailError('');
    if (!password) { setPasswordError('Senha é obrigatória'); valid = false; }
    else setPasswordError('');
    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateFields()) return;
    setLoadingLocal(true);
    try {
      const user = await login(email, password, rememberMe);
      success('Login realizado!', `Bem-vindo de volta 👋`);
      navigate(user.email?.toLowerCase().startsWith('admin@') ? '/admin' : (from === '/login' ? '/' : from), { replace: true });
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e?.code === 'auth/user-not-found' || e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential') {
        toastError('Credenciais incorretas', 'E-mail ou senha não conferem.');
      } else if (e?.code === 'auth/too-many-requests') {
        toastError('Muitas tentativas', 'Aguarde alguns minutos antes de tentar novamente.');
      } else {
        toastError('Erro ao entrar', 'Tente novamente em instantes.');
      }
    } finally {
      setLoadingLocal(false);
    }
  };

  const handleGoogle = async () => {
    setLoadingGoogle(true);
    try {
      const user = await loginWithGoogle();
      success('Login com Google!', `Bem-vindo, ${user.displayName?.split(' ')[0] || ''} 👋`);
      navigate(user.email?.toLowerCase().startsWith('admin@') ? '/admin' : (from === '/login' ? '/' : from), { replace: true });
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e?.code === 'auth/popup-closed-by-user') {
        // User closed the popup, no need to show error
      } else if (e?.code === 'auth/popup-blocked') {
        toastError('Popup bloqueado', 'Permita popups para usar o login com Google.');
      } else {
        toastError('Erro com Google', 'Não foi possível entrar com Google. Tente novamente.');
      }
    } finally {
      setLoadingGoogle(false);
    }
  };

  const s = authStyles;

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <AuthBackground />
      <div style={s.page}>
        <Link to="/" style={s.backBtn} className="auth-back-btn" aria-label="Voltar">
          <ArrowLeft size={18} />
        </Link>

        {/* Brand — exact Home logo + status badge */}
        <div style={s.brand}>
          <MercadoLogo size="md" />
          <div style={s.statusBadge}>
            <span style={s.statusDot} />
            <span>Aberto agora</span>
          </div>
        </div>

        {/* Card */}
        <div style={s.card}>
          <h2 style={{ ...s.sectionTitle, marginBottom: '18px' }}>Entrar na sua conta</h2>

          {/* Google button — above the form */}
          <GoogleSignInButton onClick={handleGoogle} loading={loadingGoogle} />

          {/* Divider */}
          <div style={s.divider}>
            <div style={s.dividerLine} />
            <span style={s.dividerText}>ou com e-mail</span>
            <div style={s.dividerLine} />
          </div>

          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Email */}
            <div>
              <label htmlFor={`${id}-email`} style={s.label}>E-mail</label>
              <div style={s.inputWrapper}>
                <Mail size={16} color="rgba(255,255,255,0.35)" style={s.inputIcon} />
                <input
                  id={`${id}-email`}
                  type="email"
                  autoComplete="email"
                  placeholder="seuemail@exemplo.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                  onBlur={() => { if (email && !validateEmail(email)) setEmailError('E-mail inválido'); }}
                  style={{ ...s.input, borderColor: emailError ? 'rgba(239,68,68,0.5)' : undefined }}
                  className="auth-input"
                  disabled={loadingLocal}
                />
              </div>
              {emailError && <span style={s.fieldError}>{emailError}</span>}
            </div>

            {/* Password */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <label htmlFor={`${id}-pw`} style={{ ...s.label, marginBottom: 0 }}>Senha</label>
                <Link to="/forgot-password" style={s.forgotLink}>Esqueci minha senha</Link>
              </div>
              <div style={s.inputWrapper}>
                <Lock size={16} color="rgba(255,255,255,0.35)" style={s.inputIcon} />
                <input
                  id={`${id}-pw`}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Sua senha secreta"
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (passwordError) setPasswordError(''); }}
                  style={{ ...s.input, borderColor: passwordError ? 'rgba(239,68,68,0.5)' : undefined, paddingRight: '44px' }}
                  className="auth-input"
                  disabled={loadingLocal}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} style={s.eyeBtn} tabIndex={-1} aria-label="Mostrar/ocultar senha">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordError && <span style={s.fieldError}>{passwordError}</span>}
            </div>

            {/* Remember me */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
              <div
                role="checkbox"
                aria-checked={rememberMe}
                tabIndex={0}
                onClick={() => setRememberMe(v => !v)}
                onKeyDown={e => e.key === ' ' && setRememberMe(v => !v)}
                style={{
                  width: '18px', height: '18px', borderRadius: '5px',
                  border: rememberMe ? '2px solid #D4AF37' : '2px solid rgba(255,255,255,0.2)',
                  background: rememberMe ? 'rgba(212,175,55,0.18)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.2s ease',
                }}
              >
                {rememberMe && <span style={{ color: '#FFDF73', fontSize: '11px', fontWeight: 800, lineHeight: 1 }}>✓</span>}
              </div>
              <span style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.55)', userSelect: 'none' }}>Lembrar de mim</span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loadingLocal || loadingGoogle}
              style={{ ...s.submitBtn, opacity: loadingLocal ? 0.8 : 1, marginTop: '2px' }}
              className="auth-submit-btn"
            >
              {loadingLocal ? <><span style={s.spinner} /> Entrando...</> : 'Entrar na minha conta'}
            </button>
          </form>

          <p style={{ textAlign: 'center', margin: '20px 0 0' }}>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>Não tem conta? </span>
            <Link to="/register" style={s.authLink}>Cadastre-se grátis</Link>
          </p>
        </div>
      </div>
      <AuthStyles />
    </div>
  );
};
