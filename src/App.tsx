import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* RUNTIME CACHE BUSTER STYLE OVERRIDE FOR MANROPE */}
        <style>{`
          body, button, input, select, textarea, span, p, h1, h2, h3, h4, h5, h6, a, div, section, main, header, footer {
            font-family: 'Manrope', 'Outfit', sans-serif !important;
          }
        `}</style>
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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <BottomNav />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
