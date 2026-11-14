import React, { useEffect, useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams, Outlet } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { db } from './firebase';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './contexts/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { BottomNav } from './components/BottomNav';
import { AgeVerificationModal } from './components/AgeVerificationModal';
import { Topbar } from './components/Topbar';
import { LEGACY_ADMIN_REDIRECTS } from './admin/routes';
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
const AdminProductDetail = lazy(() => import('./pages/AdminProductDetail').then(m => ({ default: m.AdminProductDetail })));
const Clube           = lazy(() => import('./pages/Clube').then(m => ({ default: m.Clube })));
const Roleta          = lazy(() => import('./pages/Roleta').then(m => ({ default: m.Roleta })));
const Addresses       = lazy(() => import('./pages/Addresses').then(m => ({ default: m.Addresses })));
const Coupons         = lazy(() => import('./pages/Coupons').then(m => ({ default: m.Coupons })));
const Support         = lazy(() => import('./pages/Support').then(m => ({ default: m.Support })));
const BadgesCenter    = lazy(() => import('./pages/BadgesCenter').then(m => ({ default: m.BadgesCenter })));

// Lazy: Modular Admin CRM Shell & Route Pages
const AdminLayout             = lazy(() => import('./admin/AdminLayout').then(m => ({ default: m.AdminLayout })));
const AdminDashboardPage      = lazy(() => import('./admin/pages/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const AdminOrdersPage         = lazy(() => import('./admin/pages/AdminOrdersPage').then(m => ({ default: m.AdminOrdersPage })));
const AdminOrderDetailPage    = lazy(() => import('./admin/pages/AdminOrderDetailPage').then(m => ({ default: m.AdminOrderDetailPage })));
const AdminCustomersPage      = lazy(() => import('./admin/pages/AdminCustomersPage').then(m => ({ default: m.AdminCustomersPage })));
const AdminCustomerDetailPage = lazy(() => import('./admin/pages/AdminCustomerDetailPage').then(m => ({ default: m.AdminCustomerDetailPage })));
const AdminSupportPage        = lazy(() => import('./admin/pages/AdminSupportPage').then(m => ({ default: m.AdminSupportPage })));
const AdminSupportDetailPage  = lazy(() => import('./admin/pages/AdminSupportDetailPage').then(m => ({ default: m.AdminSupportDetailPage })));
const AdminProductsPage       = lazy(() => import('./admin/pages/AdminProductsPage').then(m => ({ default: m.AdminProductsPage })));
const AdminInventoryPage      = lazy(() => import('./admin/pages/AdminInventoryPage').then(m => ({ default: m.AdminInventoryPage })));
const AdminFinancePage        = lazy(() => import('./admin/pages/AdminFinancePage').then(m => ({ default: m.AdminFinancePage })));
const AdminMarketingPage      = lazy(() => import('./admin/pages/AdminMarketingPage').then(m => ({ default: m.AdminMarketingPage })));
const AdminSponsoredCampaignsPage = lazy(() => import('./admin/pages/AdminSponsoredCampaignsPage').then(m => ({ default: m.AdminSponsoredCampaignsPage })));
const AdminLoyaltyPage        = lazy(() => import('./admin/pages/AdminLoyaltyPage').then(m => ({ default: m.AdminLoyaltyPage })));
const AdminReportsPage        = lazy(() => import('./admin/pages/AdminReportsPage').then(m => ({ default: m.AdminReportsPage })));
const AdminUsersPage          = lazy(() => import('./admin/pages/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const AdminUserDetailPage     = lazy(() => import('./admin/pages/AdminUserDetailPage').then(m => ({ default: m.AdminUserDetailPage })));
const AdminRolesPage          = lazy(() => import('./admin/pages/AdminRolesPage').then(m => ({ default: m.AdminRolesPage })));
const AdminAuditPage          = lazy(() => import('./admin/pages/AdminAuditPage').then(m => ({ default: m.AdminAuditPage })));
const AdminSettingsPage       = lazy(() => import('./admin/pages/AdminSettingsPage').then(m => ({ default: m.AdminSettingsPage })));
const AdminNotFoundPage       = lazy(() => import('./admin/pages/AdminNotFoundPage').then(m => ({ default: m.AdminNotFoundPage })));

function LegacyProductRedirect() {
  const { id } = useParams<{ id: string }>();
  if (!id || id === 'novo' || id === 'new') {
    return <Navigate to="/admin/products/new" replace />;
  }
  return <Navigate to={`/admin/products/${encodeURIComponent(id)}`} replace />;
}

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
  const isCategoryRoute = ['/', '/bebidas', '/padaria', '/tabacaria', '/eletronicos', '/promotions'].includes(location.pathname);

  if (isCategoryRoute) {
    return (
      <>
        <div className="category-topbar-wrapper">
          <div className="app" style={{ paddingBottom: 0 }}>
            <Topbar />
          </div>
        </div>
        <div key={location.pathname} className="route-transition-wrapper">
          <Outlet />
        </div>
      </>
    );
  }

  return (
    <div key={location.pathname} className="route-transition-wrapper">
      <Outlet />
    </div>
  );
}

function GlobalOnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading, profileLoading, isAdmin } = useAuth();
  const location = useLocation();

  const isExemptRoute = ['/login', '/register', '/forgot-password', '/onboarding'].includes(location.pathname) || location.pathname.startsWith('/admin');
  if (isExemptRoute) return <>{children}</>;

  if (loading || profileLoading) return null; // Wait for profile

  if (user && userProfile && !isAdmin && !userProfile.onboardingComplete) {
    const returnPath = `${location.pathname}${location.search}`;
    return <Navigate to={`/onboarding?returnUrl=${encodeURIComponent(returnPath)}`} state={{ from: returnPath }} replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const location = useLocation();
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
          
          {/* Protected Admin Nested Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route
              path="dashboard"
              element={
                <ProtectedRoute requiredPermissions={['dashboard:view']}>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="orders"
              element={
                <ProtectedRoute requiredPermissions={['pedidos:view', 'pedidos:edit', 'pedidos:approve']}>
                  <AdminOrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="orders/:orderId"
              element={
                <ProtectedRoute requiredPermissions={['pedidos:view', 'pedidos:edit', 'pedidos:approve']}>
                  <AdminOrderDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="customers"
              element={
                <ProtectedRoute requiredPermissions={['clientes:view', 'crm:view']}>
                  <AdminCustomersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="customers/:customerId"
              element={
                <ProtectedRoute requiredPermissions={['clientes:view', 'crm:view']}>
                  <AdminCustomerDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="support"
              element={
                <ProtectedRoute requiredPermissions={['suporte:view', 'suporte:edit', 'crm:view']}>
                  <AdminSupportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="support/:ticketId"
              element={
                <ProtectedRoute requiredPermissions={['suporte:view', 'suporte:edit', 'crm:view']}>
                  <AdminSupportDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="products"
              element={
                <ProtectedRoute requiredPermissions={['produtos:view', 'produtos:edit']}>
                  <AdminProductsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="products/new"
              element={
                <ProtectedRoute requiredPermissions={['produtos:create', 'produtos:edit']}>
                  <AdminProductDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="products/:id"
              element={
                <ProtectedRoute requiredPermissions={['produtos:view', 'produtos:edit']}>
                  <AdminProductDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="inventory"
              element={
                <ProtectedRoute requiredPermissions={['estoque:view', 'estoque:edit', 'produtos:view']}>
                  <AdminInventoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="finance"
              element={
                <ProtectedRoute requiredPermissions={['financeiro:view', 'financeiro:approve']}>
                  <AdminFinancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="marketing"
              element={
                <ProtectedRoute requiredPermissions={['marketing:view', 'marketing:edit']}>
                  <AdminMarketingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="marketing/campaigns"
              element={
                <ProtectedRoute requiredPermissions={['marketing:view', 'marketing:create', 'marketing:edit', 'marketing:publish']}>
                  <AdminSponsoredCampaignsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="marketing/campaigns/:id"
              element={
                <ProtectedRoute requiredPermissions={['marketing:view', 'marketing:create', 'marketing:edit', 'marketing:publish']}>
                  <AdminSponsoredCampaignsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="loyalty"
              element={
                <ProtectedRoute requiredPermissions={['clube:view', 'clube:edit', 'marketing:edit']}>
                  <AdminLoyaltyPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="reports"
              element={
                <ProtectedRoute requiredPermissions={['relatorios:view', 'dashboard:view']}>
                  <AdminReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="users"
              element={
                <ProtectedRoute requiredPermissions={['usuarios:view', 'usuarios:admin']}>
                  <AdminUsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="users/:uid"
              element={
                <ProtectedRoute requiredPermissions={['usuarios:view', 'usuarios:admin']}>
                  <AdminUserDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="roles"
              element={
                <ProtectedRoute requiredPermissions={['usuarios:view', 'usuarios:admin']}>
                  <AdminRolesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="audit"
              element={
                <ProtectedRoute requiredPermissions={['auditoria:view', 'auditoria:admin']}>
                  <AdminAuditPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="settings"
              element={
                <ProtectedRoute requiredPermissions={['configuracoes:view', 'configuracoes:edit']}>
                  <AdminSettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Legacy redirects */}
            <Route path="produto/:id" element={<LegacyProductRedirect />} />
            {LEGACY_ADMIN_REDIRECTS.map((r) => (
              <Route
                key={r.from}
                path={r.from.replace(/^\/admin\//, '')}
                element={<Navigate to={r.to} replace />}
              />
            ))}
            <Route path="*" element={<AdminNotFoundPage />} />
          </Route>
        </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </GlobalOnboardingGuard>

      {location.pathname !== '/onboarding' && !location.pathname.startsWith('/admin') && <BottomNav />}
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
