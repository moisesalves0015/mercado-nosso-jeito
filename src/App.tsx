import React, { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { db } from './firebase';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './contexts/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { BottomNav } from './components/BottomNav';
import { AgeVerificationModal } from './components/AgeVerificationModal';
// Eager: small, always-needed pages
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { Search } from './pages/Search';
import { Cart } from './pages/Cart';
import { Onboarding } from './pages/Onboarding';
import { ProductDetail } from './pages/ProductDetail';
import { Promotions } from './pages/Promotions';
import { Categories } from './pages/Categories';
import { Tabacaria } from './pages/Tabacaria';
import { Bebidas } from './pages/Bebidas';
import { Eletronicos } from './pages/Eletronicos';
import { Padaria } from './pages/Padaria';
// Lazy: heavy pages — loaded only when navigated to
const Orders          = lazy(() => import('./pages/Orders').then(m => ({ default: m.Orders })));
const Profile         = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Checkout        = lazy(() => import('./pages/Checkout').then(m => ({ default: m.Checkout })));
const Admin           = lazy(() => import('./pages/Admin').then(m => ({ default: m.Admin })));
const AdminProductDetail = lazy(() => import('./pages/AdminProductDetail').then(m => ({ default: m.AdminProductDetail })));
const Clube           = lazy(() => import('./pages/Clube').then(m => ({ default: m.Clube })));
const Roleta          = lazy(() => import('./pages/Roleta').then(m => ({ default: m.Roleta })));
const Addresses       = lazy(() => import('./pages/Addresses').then(m => ({ default: m.Addresses })));
const Coupons         = lazy(() => import('./pages/Coupons').then(m => ({ default: m.Coupons })));
const Support         = lazy(() => import('./pages/Support').then(m => ({ default: m.Support })));
const BadgesCenter    = lazy(() => import('./pages/BadgesCenter').then(m => ({ default: m.BadgesCenter })));

// Fallback shown while a lazy page is loading
function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', color: 'var(--text-secondary)', fontSize: 14,
      fontFamily: "'Manrope','Outfit',sans-serif",
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 28, height: 28, border: '2px solid var(--border-gold)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span>Carregando...</span>
      </div>
    </div>
  );
}

function PageTransitionLayout() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="route-transition-wrapper">
      <Outlet />
    </div>
  );
}

function GlobalOnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading, profileLoading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading || profileLoading) return null; // Wait for profile

  const isExemptRoute = ['/login', '/register', '/forgot-password', '/onboarding'].includes(location.pathname) || location.pathname.startsWith('/admin');

  if (user && userProfile && !isAdmin && !userProfile.onboardingComplete && !isExemptRoute) {
    const returnPath = `${location.pathname}${location.search}`;
    return <Navigate to={`/onboarding?returnUrl=${encodeURIComponent(returnPath)}`} state={{ from: returnPath }} replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    const handleThemeChange = () => {
      setTheme(localStorage.getItem('theme') || 'dark');
    };
    window.addEventListener('theme-changed', handleThemeChange);
    if (theme === 'light') {
      document.body.classList.add('light-mode');
    } else {
      document.body.classList.remove('light-mode');
    }
    return () => window.removeEventListener('theme-changed', handleThemeChange);
  }, [theme]);

  useEffect(() => {
    const splash = document.getElementById('pwa-splash-screen');
    if (splash) {
      // Small delay to ensure the DOM has fully rendered
      const timeout = setTimeout(() => {
        splash.classList.add('fade-out');
        const removeTimeout = setTimeout(() => {
          splash.remove();
        }, 400); // matches the CSS transition duration
        return () => clearTimeout(removeTimeout);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, []);

  // Capture referral code from URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const refCode = params.get('ref');
    if (refCode) {
      localStorage.setItem('referred_by', refCode);
    }
  }, [location.search]);

  // Real-time Firestore sync of products to localStorage
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'products'), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      localStorage.setItem('app-products', JSON.stringify(list));
      window.dispatchEvent(new Event('app-products-updated'));
    });
    return () => unsub();
  }, []);

  // Ocultar gatilho na roleta, admin, login e register
  const showTrigger = !['/login', '/register', '/roleta', '/onboarding'].includes(location.pathname) && !location.pathname.startsWith('/admin');

  // Determinar cor do status bar com base na rota e tema
  const isBlackHeader = ['/', '/bebidas', '/padaria', '/tabacaria', '/eletronicos', '/promotions'].includes(location.pathname);
  const isLight = theme === 'light';
  const safeAreaBg = isLight 
    ? (isBlackHeader ? '#ffffff' : '#f8fafc')
    : (isBlackHeader ? '#000000' : '#090705');

  return (
    <>
      <div className="bg"></div>
      <div className="overlay"></div>
      <div 
        className="safe-area-top-fixed" 
        style={{ 
          background: safeAreaBg,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 'env(safe-area-inset-top, 0px)',
          zIndex: 2000,
          pointerEvents: 'none'
        }} 
      />

      <AgeVerificationModal />

      <GlobalOnboardingGuard>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<PageTransitionLayout />}>
            {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/promotions" element={<Promotions />} />
          <Route path="/clube" element={<Clube />} />
          <Route path="/tabacaria" element={<Tabacaria />} />
          <Route path="/bebidas" element={<Bebidas />} />
          <Route path="/eletronicos" element={<Eletronicos />} />
          <Route path="/padaria" element={<Padaria />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/product/:productId" element={<ProductDetail />} />
          <Route path="/roleta" element={<Roleta />} />
          
          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/onboarding" element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          } />
          
          {/* Protected Client Routes */}
          <Route path="/checkout" element={
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          } />
          <Route path="/orders" element={
            <ProtectedRoute>
              <Orders />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/colecoes" element={
            <ProtectedRoute>
              <BadgesCenter />
            </ProtectedRoute>
          } />
          <Route path="/addresses" element={
            <ProtectedRoute>
              <Addresses />
            </ProtectedRoute>
          } />
          <Route path="/coupons" element={
            <ProtectedRoute>
              <Coupons />
            </ProtectedRoute>
          } />
          <Route path="/support" element={<Support />} />
          
          {/* Protected Admin Route */}
          <Route path="/admin" element={
            <ProtectedRoute adminOnly>
              <Admin />
            </ProtectedRoute>
          } />
          <Route path="/admin/:tab" element={
            <ProtectedRoute adminOnly>
              <Admin />
            </ProtectedRoute>
          } />
          <Route path="/admin/produto/:id" element={
            <ProtectedRoute adminOnly>
              <AdminProductDetail />
            </ProtectedRoute>
          } />
        </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </GlobalOnboardingGuard>

      {location.pathname !== '/onboarding' && <BottomNav />}

      {showTrigger && (
        <div 
          className="floating-roulette-trigger"
          onClick={() => navigate('/roleta')}
          title="Jogar Roleta da Sorte 🎰"
        >
          <div className="floating-roulette-wheel">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#FFDF73" strokeWidth="2.5" strokeDasharray="3 3" />
              <circle cx="12" cy="12" r="6" stroke="#D4AF37" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="2" fill="#FFDF73" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="#FFDF73" strokeWidth="1.5" />
            </svg>
          </div>
          <span className="floating-roulette-text">ROLETA</span>
        </div>
      )}
    </>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <ScrollToTop />
            <AppContent />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
