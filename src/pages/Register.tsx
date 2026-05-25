import React, { useState, useId, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../contexts/ToastContext';
import {
  validateEmail, validateName, validatePassword,
  validatePhone, validateCPF, getPasswordStrength,
} from '../utils/validators';
import { maskPhone, maskCPF } from '../utils/masks';
import { Mail, Lock, User, Phone, CreditCard, Eye, EyeOff, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import {
  MercadoLogo, GoogleSignInButton, AuthBackground, AuthStyles, authStyles as s,
} from './Login';

// ──────────────────────────────────────────────────────────────
// Register Page
// ──────────────────────────────────────────────────────────────
export const Register: React.FC = () => {
  const id = useId();
  const { register, loginWithGoogle } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  // Scroll to top on mount (register card is tall)
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const passwordStrength = getPasswordStrength(password);

  const validateField = (field: string, value: string): string => {
    switch (field) {
      case 'name': return validateName(value) ? '' : 'Digite nome e sobrenome';
      case 'email': return validateEmail(value) ? '' : 'E-mail inválido';
      case 'telefone': return !value.trim() ? 'Telefone obrigatório' : (validatePhone(value) ? '' : 'Telefone inválido');
      case 'cpf': return !value.trim() ? 'CPF obrigatório' : (validateCPF(value) ? '' : 'CPF inválido');
      case 'password': { const r = validatePassword(value); return r.valid ? '' : r.message; }
      case 'confirmPassword': return value === password ? '' : 'As senhas não coincidem';
      default: return '';
    }
  };

  const handleBlur = (field: string, value: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    setErrors(prev => ({ ...prev, [field]: validateField(field, value) }));
  };

  const handleChange = (field: string, value: string) => {
    if (touched[field]) setErrors(prev => ({ ...prev, [field]: validateField(field, value) }));
  };

  const validateAll = (): boolean => {
    const fields: Record<string, string> = { name, email, telefone, cpf, password, confirmPassword };
    const newErrors: Record<string, string> = {};
    let valid = true;
    for (const [field, value] of Object.entries(fields)) {
      const err = validateField(field, value);
      if (err) { newErrors[field] = err; valid = false; }
    }
    setErrors(newErrors);
    setTouched({ name: true, email: true, telefone: true, cpf: true, password: true, confirmPassword: true });
    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;
    setLoading(true);
    try {
      await register({ name: name.trim(), email: email.trim(), password, telefone, cpf });
      success('Conta criada!', `Bem-vindo ao Mercado Nosso Jeito, ${name.split(' ')[0]}! 🎉`);
      navigate('/');
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e?.code === 'auth/email-already-in-use') {
        setErrors(prev => ({ ...prev, email: 'E-mail já cadastrado' }));
        toastError('E-mail já cadastrado', 'Tente fazer login ou use outro e-mail.');
      } else if (e?.code === 'auth/weak-password') {
        setErrors(prev => ({ ...prev, password: 'Senha muito fraca' }));
      } else {
        toastError('Erro ao criar conta', 'Tente novamente em instantes.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoadingGoogle(true);
    try {
      const user = await loginWithGoogle();
      success('Conta criada com Google!', `Bem-vindo, ${user.displayName?.split(' ')[0] || ''} 🎉`);
      navigate('/');
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e?.code !== 'auth/popup-closed-by-user') {
        toastError('Erro com Google', 'Não foi possível cadastrar com Google. Tente novamente.');
      }
    } finally {
      setLoadingGoogle(false);
    }
  };

  const borderColor = (field: string) => {
    if (errors[field]) return 'rgba(239,68,68,0.5)';
    const values: Record<string, string> = { name, email, telefone, cpf, password, confirmPassword };
    if (touched[field] && !errors[field] && !!values[field]) return 'rgba(16,185,129,0.4)';
    return 'rgba(255,255,255,0.1)';
  };

  const isValid = (field: string) => touched[field] && !errors[field];

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <AuthBackground />
      <div style={{ ...s.page, paddingTop: '28px', paddingBottom: '40px' }}>
        <Link to="/login" style={s.backBtn} className="auth-back-btn" aria-label="Voltar para login">
          <ArrowLeft size={18} />
        </Link>

        {/* Brand */}
        <div style={{ ...s.brand, marginBottom: '20px' }}>
          <MercadoLogo size="md" />
          <div style={s.statusBadge}>
            <span style={s.statusDot} />
            <span>Cadastro grátis</span>
          </div>
        </div>

        {/* Card */}
        <div style={{ ...s.card, maxWidth: '420px' }}>
          <h2 style={{ ...s.sectionTitle, marginBottom: '16px' }}>Criar sua conta</h2>

          {/* Google button */}
          <GoogleSignInButton onClick={handleGoogle} loading={loadingGoogle} label="Cadastrar com Google" />

          <div style={s.divider}>
            <div style={s.dividerLine} />
            <span style={s.dividerText}>ou com e-mail</span>
            <div style={s.dividerLine} />
          </div>

          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>

            {/* Nome */}
            <FieldWrap id={`${id}-name`} label="Nome Completo" icon={<User size={15} color="rgba(255,255,255,0.35)" />} error={errors.name} valid={isValid('name')}>
              <input id={`${id}-name`} type="text" autoComplete="name" placeholder="João da Silva"
                value={name}
                onChange={e => { setName(e.target.value); handleChange('name', e.target.value); }}
                onBlur={() => handleBlur('name', name)}
                style={{ ...s.input, borderColor: borderColor('name') }}
                className="auth-input" disabled={loading} />
            </FieldWrap>

            {/* Email */}
            <FieldWrap id={`${id}-email`} label="E-mail" icon={<Mail size={15} color="rgba(255,255,255,0.35)" />} error={errors.email} valid={isValid('email')}>
              <input id={`${id}-email`} type="email" autoComplete="email" placeholder="seuemail@exemplo.com"
                value={email}
                onChange={e => { setEmail(e.target.value); handleChange('email', e.target.value); }}
                onBlur={() => handleBlur('email', email)}
                style={{ ...s.input, borderColor: borderColor('email') }}
                className="auth-input" disabled={loading} />
            </FieldWrap>

            {/* Telefone + CPF side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <FieldWrap id={`${id}-phone`} label="Telefone *" icon={<Phone size={15} color="rgba(255,255,255,0.35)" />} error={errors.telefone} valid={isValid('telefone')}>
                <input id={`${id}-phone`} type="tel" autoComplete="tel" placeholder="(11) 99999-9999"
                  value={telefone}
                  onChange={e => { const m = maskPhone(e.target.value); setTelefone(m); handleChange('telefone', m); }}
                  onBlur={() => handleBlur('telefone', telefone)}
                  style={{ ...s.input, borderColor: borderColor('telefone'), fontSize: '12.5px' }}
                  className="auth-input" disabled={loading} />
              </FieldWrap>

              <FieldWrap id={`${id}-cpf`} label="CPF *" icon={<CreditCard size={15} color="rgba(255,255,255,0.35)" />} error={errors.cpf} valid={isValid('cpf')}>
                <input id={`${id}-cpf`} type="text" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00"
                  value={cpf}
                  onChange={e => { const m = maskCPF(e.target.value); setCpf(m); handleChange('cpf', m); }}
                  onBlur={() => handleBlur('cpf', cpf)}
                  style={{ ...s.input, borderColor: borderColor('cpf'), fontSize: '12.5px' }}
                  className="auth-input" disabled={loading} />
              </FieldWrap>
            </div>

            {/* Senha */}
            <div>
              <FieldWrap id={`${id}-pw`} label="Senha" icon={<Lock size={15} color="rgba(255,255,255,0.35)" />} error={errors.password} valid={isValid('password')}
                eye={<button type="button" onClick={() => setShowPassword(v => !v)} style={s.eyeBtn} tabIndex={-1}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button>}>
                <input id={`${id}-pw`} type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={e => { setPassword(e.target.value); handleChange('password', e.target.value); if (confirmPassword) handleChange('confirmPassword', confirmPassword); }}
                  onBlur={() => handleBlur('password', password)}
                  style={{ ...s.input, borderColor: borderColor('password'), paddingRight: '44px' }}
                  className="auth-input" disabled={loading} />
              </FieldWrap>
              {/* Strength bar */}
              {password && (
                <div style={{ marginTop: '7px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Força</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: passwordStrength.color }}>{passwordStrength.label}</span>
                  </div>
                  <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: passwordStrength.width, background: passwordStrength.color, transition: 'all 0.4s ease' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Confirmar Senha */}
            <FieldWrap id={`${id}-confirm`} label="Confirmar Senha" icon={<Lock size={15} color="rgba(255,255,255,0.35)" />} error={errors.confirmPassword} valid={isValid('confirmPassword')}
              eye={<button type="button" onClick={() => setShowConfirm(v => !v)} style={s.eyeBtn} tabIndex={-1}>{showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}</button>}>
              <input id={`${id}-confirm`} type={showConfirm ? 'text' : 'password'} autoComplete="new-password" placeholder="Repita a senha"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); handleChange('confirmPassword', e.target.value); }}
                onBlur={() => handleBlur('confirmPassword', confirmPassword)}
                style={{ ...s.input, borderColor: borderColor('confirmPassword'), paddingRight: '44px' }}
                className="auth-input" disabled={loading} />
            </FieldWrap>

            {/* Privacy note */}
            <p style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.3)', lineHeight: 1.5, margin: '2px 0 0' }}>
              Ao se cadastrar você concorda com os{' '}
              <span style={{ color: '#D4AF37' }}>Termos de Uso</span>
              {' '}e a{' '}
              <span style={{ color: '#D4AF37' }}>Política de Privacidade</span>.
            </p>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || loadingGoogle}
              style={{ ...s.submitBtn, opacity: loading ? 0.8 : 1 }}
              className="auth-submit-btn"
            >
              {loading ? <><span style={s.spinner} /> Criando conta...</> : 'Criar minha conta agora'}
            </button>
          </form>

          <p style={{ textAlign: 'center', margin: '18px 0 0' }}>
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>Já tem conta? </span>
            <Link to="/login" style={s.authLink}>Faça login</Link>
          </p>
        </div>
      </div>
      <AuthStyles />
    </div>
  );
};

// ──────────────────────────────────────────────────────────────
// FieldWrap helper
// ──────────────────────────────────────────────────────────────
interface FieldWrapProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  error?: string;
  valid?: boolean;
  eye?: React.ReactNode;
  children: React.ReactNode;
}

const FieldWrap: React.FC<FieldWrapProps> = ({ id, label, icon, error, valid, eye, children }) => {
  return (
    <div>
      <label htmlFor={id} style={s.label}>{label}</label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>{icon}</span>
        {children}
        {/* validation icon (right side, only if no eye btn) */}
        {!eye && (error || valid) && (
          <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
            {error ? <XCircle size={14} color="#ef4444" /> : <CheckCircle size={14} color="#10b981" />}
          </span>
        )}
        {eye && <span style={{ position: 'absolute', right: '0', top: '0', height: '100%', display: 'flex', alignItems: 'center' }}>{eye}</span>}
      </div>
      {error && <span style={s.fieldError}>{error}</span>}
    </div>
  );
};
