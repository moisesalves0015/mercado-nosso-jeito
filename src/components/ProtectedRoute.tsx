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
// Premium skeleton loading screen
// ──────────────────────────────────────────────────────────────
const AuthLoadingSkeleton: React.FC = () => (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #020617 0%, #080e1c 100%)',
    fontFamily: "'Manrope', 'Outfit', sans-serif",
    gap: '28px',
  }}>
    {/* Logo spinner */}
    <div style={{ position: 'relative', width: '60px', height: '60px' }}>
      {/* Spinning ring */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        border: '2.5px solid rgba(212,175,55,0.15)',
        borderTopColor: '#D4AF37',
        animation: 'authLoadSpin 1s linear infinite',
      }} />
      {/* Logo center */}
      <div style={{
        position: 'absolute',
        inset: '10px',
        borderRadius: '12px',
        background: 'linear-gradient(135deg, #D4AF37 0%, #FFDF73 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(212,175,55,0.3)',
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#000" />
        </svg>
      </div>
    </div>

    {/* Text & skeleton */}
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
      <span style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.5px' }}>
        Carregando mercado...
      </span>
      {/* Skeleton bars */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
        {[40, 56, 32].map((w, i) => (
          <div key={i} style={{
            height: '4px',
            width: `${w}px`,
            borderRadius: '4px',
            background: 'rgba(212,175,55,0.2)',
            animation: `skeletonBar 1.4s ease-in-out ${i * 0.15}s infinite`,
          }} />
        ))}
      </div>
    </div>

    <style>{`
      @keyframes authLoadSpin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes skeletonBar {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 0.9; }
      }
    `}</style>
  </div>
);
