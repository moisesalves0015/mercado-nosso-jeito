import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, adminOnly = false }) => {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AuthLoadingSkeleton />;
  }

  if (!user) {
    // Preserve "from" location so Login can redirect back after auth
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// ──────────────────────────────────────────────────────────────
// Full-screen loading screen matching Home / Login aesthetic
// ──────────────────────────────────────────────────────────────
const AuthLoadingSkeleton: React.FC = () => (
  <div style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden' }}>

    {/* ── Background: same supermarket photo as Home & Login ── */}
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundImage: 'url("/bg-supermercado.jpeg")',
      backgroundSize: 'cover',
      backgroundPosition: 'center 65%',
      filter: 'brightness(0.28)',
      zIndex: 0,
    }} />

    {/* Deep gradient overlay */}
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'linear-gradient(160deg, rgba(9,7,5,0.50) 0%, rgba(9,7,5,0.80) 55%, rgba(9,7,5,0.97) 100%)',
      zIndex: 0,
    }} />

    {/* Gold glow — top right */}
    <div style={{
      position: 'fixed',
      top: '-100px',
      right: '-100px',
      width: '420px',
      height: '420px',
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(212,175,55,0.14) 0%, transparent 70%)',
      filter: 'blur(50px)',
      zIndex: 0,
      pointerEvents: 'none',
      animation: 'loadGlowPulse 3s ease-in-out infinite',
    }} />

    {/* Blue glow — bottom left */}
    <div style={{
      position: 'fixed',
      bottom: '-80px',
      left: '-80px',
      width: '350px',
      height: '350px',
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
      filter: 'blur(60px)',
      zIndex: 0,
      pointerEvents: 'none',
    }} />

    {/* ── Centered content ── */}
    <div style={{
      position: 'relative',
      zIndex: 1,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '36px',
      fontFamily: "'Manrope', 'Outfit', sans-serif",
      padding: '32px 16px',
    }}>

      {/* ── Logo block ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', animation: 'loadFadeIn 0.6s ease' }}>
        <span style={{
          fontSize: '16px',
          fontWeight: 800,
          color: '#fff',
          lineHeight: 1.1,
          letterSpacing: '-0.3px',
          textTransform: 'lowercase',
          fontFamily: "'Manrope', 'Outfit', sans-serif",
        }}>
          mercado do
        </span>
        <span className="loading-logo-sub" style={{
          fontSize: '38px',
          fontWeight: 'normal',
          lineHeight: 1.0,
          letterSpacing: '0.5px',
          textTransform: 'lowercase',
          padding: '0 6px',
        }}>
          nosso jeito
        </span>
      </div>

      {/* ── Spinner card ── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(212,175,55,0.18)',
        borderRadius: '24px',
        padding: '36px 48px',
        boxShadow: '0 8px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)',
        animation: 'loadFadeIn 0.6s ease 0.1s both',
      }}>

        {/* Spinning ring + icon */}
        <div style={{ position: 'relative', width: '64px', height: '64px' }}>
          {/* Outer spinning ring */}
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2px solid rgba(212,175,55,0.12)',
            borderTopColor: '#D4AF37',
            borderRightColor: 'rgba(212,175,55,0.4)',
            animation: 'loadSpin 1s linear infinite',
          }} />
          {/* Inner glow ring */}
          <div style={{
            position: 'absolute',
            inset: '6px',
            borderRadius: '50%',
            border: '1px solid rgba(212,175,55,0.08)',
            borderTopColor: 'rgba(212,175,55,0.25)',
            animation: 'loadSpin 1.5s linear infinite reverse',
          }} />
          {/* Center icon */}
          <div style={{
            position: 'absolute',
            inset: '13px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #D4AF37 0%, #FFDF73 50%, #F59E0B 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(212,175,55,0.5)',
            animation: 'loadGlowPulse 2s ease-in-out infinite',
          }}>
            {/* Shopping cart icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#090705" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
          </div>
        </div>

        {/* Loading text */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '14px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.85)',
            letterSpacing: '0.3px',
          }}>
            Verificando acesso...
          </span>

          {/* Animated dots */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#D4AF37',
                animation: `loadDotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom progress bar ── */}
      <div style={{
        width: '140px',
        height: '2px',
        borderRadius: '2px',
        background: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
        animation: 'loadFadeIn 0.6s ease 0.2s both',
      }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg, transparent, #D4AF37, #FFDF73, #D4AF37, transparent)',
          backgroundSize: '200% 100%',
          animation: 'loadShimmer 1.8s linear infinite',
          borderRadius: '2px',
        }} />
      </div>
    </div>

    {/* ── Keyframe styles ── */}
    <style>{`
      @font-face {
        font-family: 'Granesta';
        src: url('/Granesta.otf') format('opentype'),
             url('/Granesta.ttf') format('truetype');
        font-weight: normal;
        font-style: normal;
        font-display: block;
      }
      @keyframes megaGoldShineLoad {
        0% { background-position: 0% center; }
        100% { background-position: 200% center; }
      }
      .loading-logo-sub {
        font-family: 'Granesta', cursive !important;
        background: linear-gradient(90deg, #D4AF37, #FFDF73, #F59E0B, #FFDF73, #D4AF37) !important;
        background-size: 200% auto !important;
        -webkit-background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        background-clip: text !important;
        animation: megaGoldShineLoad 3s linear infinite !important;
        display: inline-block !important;
      }
      @keyframes loadSpin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
      @keyframes loadGlowPulse {
        0%, 100% { opacity: 0.8; transform: scale(1); }
        50%       { opacity: 1;   transform: scale(1.06); }
      }
      @keyframes loadDotBounce {
        0%, 80%, 100% { transform: translateY(0);    opacity: 0.4; }
        40%            { transform: translateY(-6px); opacity: 1; }
      }
      @keyframes loadShimmer {
        0%   { background-position: -200% center; }
        100% { background-position:  200% center; }
      }
      @keyframes loadFadeIn {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `}</style>
  </div>
);
