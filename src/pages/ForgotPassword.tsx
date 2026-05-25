import React, { useState, useId } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import { validateEmail } from '../utils/validators';
import { Mail, ArrowLeft, Send, CheckCircle } from 'lucide-react';
import { MercadoLogo, AuthBackground, AuthStyles, authStyles as s } from './Login';

// ──────────────────────────────────────────────────────────────
// ForgotPassword Page
// ──────────────────────────────────────────────────────────────
export const ForgotPassword: React.FC = () => {
  const id = useId();
  const { sendPasswordReset } = useAuth();
  const { success, error: toastError } = useToast();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setEmailError('E-mail é obrigatório'); return; }
    if (!validateEmail(email)) { setEmailError('E-mail inválido'); return; }
    setEmailError('');
    setLoading(true);
    try {
      await sendPasswordReset(email.trim());
      setSent(true);
      success('E-mail enviado!', 'Verifique sua caixa de entrada.');
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e?.code === 'auth/user-not-found') {
        // Security: don't reveal if email exists
        setSent(true);
      } else if (e?.code === 'auth/too-many-requests') {
        toastError('Muitas tentativas', 'Aguarde alguns minutos antes de tentar novamente.');
      } else {
        toastError('Erro ao enviar', 'Tente novamente em instantes.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <AuthBackground />
      <div style={s.page}>
        <Link to="/login" style={s.backBtn} className="auth-back-btn" aria-label="Voltar para login">
          <ArrowLeft size={18} />
        </Link>

        {/* Brand */}
        <div style={s.brand}>
          <MercadoLogo size="md" />
        </div>

        {/* Card */}
        <div style={s.card}>
          {!sent ? (
            <>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: '22px' }}>
                <div style={{
                  width: '54px', height: '54px', borderRadius: '50%',
                  background: 'rgba(212,175,55,0.1)',
                  border: '1.5px solid rgba(212,175,55,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px',
                }}>
                  <Mail size={24} color="#D4AF37" />
                </div>
                <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>
                  Esqueceu sua senha?
                </h2>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.55 }}>
                  Digite seu e-mail e enviaremos um link para criar uma nova senha.
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label htmlFor={`${id}-email`} style={s.label}>Seu e-mail</label>
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
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                  {emailError && <span style={s.fieldError}>{emailError}</span>}
                </div>

                <button type="submit" disabled={loading} style={{ ...s.submitBtn, opacity: loading ? 0.8 : 1 }} className="auth-submit-btn">
                  {loading
                    ? <><span style={s.spinner} /> Enviando...</>
                    : <><Send size={15} /> Enviar link de recuperação</>
                  }
                </button>
              </form>

              <div style={s.divider}>
                <div style={s.dividerLine} />
                <span style={s.dividerText}>OU</span>
                <div style={s.dividerLine} />
              </div>

              <p style={{ textAlign: 'center', margin: 0 }}>
                <Link to="/login" style={s.authLink}>Voltar para o login</Link>
              </p>
            </>
          ) : (
            /* ── Success state ─────────────────────────── */
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%',
                background: 'rgba(16,185,129,0.1)',
                border: '1.5px solid rgba(16,185,129,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 18px',
                animation: 'successPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
              }}>
                <CheckCircle size={30} color="#10b981" />
              </div>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', margin: '0 0 10px' }}>E-mail enviado!</h2>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: '0 0 6px', lineHeight: 1.6 }}>
                Enviamos instruções para{' '}
                <strong style={{ color: '#FFDF73' }}>{email}</strong>.
              </p>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', margin: '0 0 24px' }}>
                Verifique a pasta de spam. O link expira em{' '}
                <strong style={{ color: 'rgba(255,255,255,0.5)' }}>1 hora</strong>.
              </p>

              <button
                onClick={() => { setSent(false); setEmail(''); }}
                style={{
                  width: '100%', height: '42px',
                  background: 'rgba(212,175,55,0.08)',
                  border: '1px solid rgba(212,175,55,0.25)',
                  borderRadius: '10px',
                  color: '#FFDF73', fontSize: '13px', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit', marginBottom: '14px',
                  transition: 'all 0.2s ease',
                }}
              >
                Reenviar e-mail
              </button>
              <Link to="/login" style={{ ...s.authLink, display: 'block', fontSize: '13px' }}>
                Voltar para o login
              </Link>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes successPop {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <AuthStyles />
    </div>
  );
};
