import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Mail, Lock, ShieldCheck, ArrowLeft, Gem } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loadingLocal, setLoadingLocal] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setError('');
    setLoadingLocal(true);

    try {
      await login(email, password);
      // If admin, go to Admin, else go to Home
      const emailLower = email.toLowerCase();
      if (emailLower === 'admin@mercado.com' || emailLower.startsWith('admin@')) {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/invalid-email') {
        setError('E-mail inválido.');
      } else {
        setError('Ocorreu um erro ao fazer login. Tente novamente.');
      }
    } finally {
      setLoadingLocal(false);
    }
  };

  // Quick 1-Click login as Admin
  const handleAdminQuickLogin = async () => {
    setError('');
    setLoadingLocal(true);
    try {
      await login('admin@mercado.com', 'admin123');
      navigate('/admin');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao simular login de Admin. Certifique-se de cadastrar este usuário ou tente novamente.');
    } finally {
      setLoadingLocal(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px 16px',
      background: 'linear-gradient(135deg, #020617 0%, #0b0f19 50%, #020617 100%)',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'Manrope, sans-serif'
    }}>
      {/* Decorative Gold Glowing Orbs */}
      <div style={{
        position: 'absolute',
        width: '280px',
        height: '280px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, rgba(212,175,55,0) 70%)',
        top: '10%',
        left: '-10%',
        filter: 'blur(40px)',
        pointerEvents: 'none'
      }}></div>
      <div style={{
        position: 'absolute',
        width: '320px',
        height: '320px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(14,165,233,0.06) 0%, rgba(14,165,233,0) 70%)',
        bottom: '10%',
        right: '-10%',
        filter: 'blur(50px)',
        pointerEvents: 'none'
      }}></div>

      {/* Floating Back Button */}
      <Link to="/" style={{
        position: 'absolute',
        top: '24px',
        left: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        color: 'rgba(255, 255, 255, 0.7)',
        textDecoration: 'none',
        zIndex: 10
      }}>
        <ArrowLeft size={18} />
      </Link>

      {/* BRAND HEADER */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px', zIndex: 2 }}>
        <div style={{
          background: 'linear-gradient(135deg, #D4AF37 0%, #FFDF73 100%)',
          borderRadius: '16px',
          width: '52px',
          height: '52px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(212, 175, 55, 0.35)',
          marginBottom: '12px'
        }}>
          <Gem size={26} color="#000" />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#fff', margin: '0 0 4px', letterSpacing: '-0.3px' }}>
          Mercado Nosso Jeito
        </h2>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Faça login para comprar
        </span>
      </div>

      {/* GLASSMORPHIC CARD */}
      <div style={{
        width: '100%',
        maxWidth: '380px',
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1.2px solid rgba(212, 175, 55, 0.22)',
        borderRadius: '20px',
        padding: '24px',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7), inset 0 1px 2px rgba(255, 255, 255, 0.05)',
        zIndex: 2
      }}>
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '10px',
            padding: '10px 12px',
            color: '#ef4444',
            fontSize: '12px',
            fontWeight: 600,
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '14px' }}>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Email Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.6)' }}>E-mail</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  height: '42px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  paddingLeft: '38px',
                  paddingRight: '12px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.3s ease'
                }}
                className="login-input"
              />
            </div>
          </div>

          {/* Password Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.6)' }}>Senha</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="rgba(255,255,255,0.4)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="password"
                placeholder="Sua senha secreta"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  height: '42px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  paddingLeft: '38px',
                  paddingRight: '12px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.3s ease'
                }}
                className="login-input"
              />
            </div>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loadingLocal}
            style={{
              height: '44px',
              background: 'linear-gradient(135deg, #D4AF37 0%, #FFDF73 100%)',
              border: 'none',
              borderRadius: '10px',
              color: '#000',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 20px rgba(212, 175, 55, 0.25)',
              marginTop: '8px',
              transition: 'all 0.3s ease'
            }}
          >
            {loadingLocal ? (
              <div style={{
                width: '18px',
                height: '18px',
                border: '2px solid rgba(0,0,0,0.1)',
                borderTopColor: '#000',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }}></div>
            ) : (
              'Entrar na minha conta'
            )}
          </button>
        </form>

        <div style={{ margin: '20px 0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>OU</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
        </div>

        {/* Administrative Quick Action */}
        <button
          onClick={handleAdminQuickLogin}
          disabled={loadingLocal}
          style={{
            width: '100%',
            height: '42px',
            background: 'rgba(212, 175, 55, 0.08)',
            border: '1.2px dashed rgba(212, 175, 55, 0.45)',
            borderRadius: '10px',
            color: '#FFDF73',
            fontSize: '12.5px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.3s ease'
          }}
          className="admin-quick-login-btn"
        >
          <ShieldCheck size={16} />
          <span>Acesso Admin Rápido (1-Clique)</span>
        </button>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <span style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.5)' }}>Não tem uma conta? </span>
          <Link to="/register" style={{ fontSize: '12.5px', color: '#FFDF73', fontWeight: 800, textDecoration: 'none', marginLeft: '4px' }}>
            Cadastre-se grátis
          </Link>
        </div>
      </div>

      <style>{`
        .login-input:focus {
          border-color: rgba(212, 175, 55, 0.6) !important;
          box-shadow: 0 0 8px rgba(212, 175, 55, 0.25) !important;
          background: rgba(0, 0, 0, 0.3) !important;
        }
        .admin-quick-login-btn:hover {
          background: rgba(212, 175, 55, 0.15) !important;
          border-style: solid !important;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
