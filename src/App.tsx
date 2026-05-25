import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { BottomNav } from './components/BottomNav';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { Promotions } from './pages/Promotions';
import { Orders } from './pages/Orders';
import { Profile } from './pages/Profile';
import { ProductDetail } from './pages/ProductDetail';
import { Clube } from './pages/Clube';
import { Tabacaria } from './pages/Tabacaria';
import { Bebidas } from './pages/Bebidas';
import { Eletronicos } from './pages/Eletronicos';
import { Cart } from './pages/Cart';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Admin } from './pages/Admin';
import { AdminProductDetail } from './pages/AdminProductDetail';
import { Roleta } from './pages/Roleta';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();

  // Ocultar gatilho na roleta, admin, login e register
  const showTrigger = !['/login', '/register', '/roleta'].includes(location.pathname) && !location.pathname.startsWith('/admin');

  return (
    <>
      <div className="bg"></div>
      <div className="overlay"></div>

      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/promotions" element={<Promotions />} />
        <Route path="/clube" element={<Clube />} />
        <Route path="/tabacaria" element={<Tabacaria />} />
        <Route path="/bebidas" element={<Bebidas />} />
        <Route path="/eletronicos" element={<Eletronicos />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/product/:productId" element={<ProductDetail />} />
        <Route path="/roleta" element={<Roleta />} />
        
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected Client Routes */}
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
        
        {/* Protected Admin Route */}
        <Route path="/admin" element={
          <ProtectedRoute adminOnly>
            <Admin />
          </ProtectedRoute>
        } />
        <Route path="/admin/produto/:id" element={
          <ProtectedRoute adminOnly>
            <AdminProductDetail />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <BottomNav />

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
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        {/* RUNTIME CACHE BUSTER STYLE OVERRIDE FOR MANROPE */}
        <style>{`
          body, button, input, select, textarea, span, p, h1, h2, h3, h4, h5, h6, a, div, section, main, header, footer {
            font-family: 'Manrope', 'Outfit', sans-serif !important;
          }
        `}</style>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
