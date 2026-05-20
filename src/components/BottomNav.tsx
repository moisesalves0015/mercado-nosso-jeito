import { Home, Search, Star, Gem, ShoppingBag, User, Truck } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';

export const BottomNav = () => {
  const { totalItems, totalPrice } = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  // Hide completely on login, register, and admin pages
  const isHiddenRoute = ['/login', '/register'].includes(location.pathname) || location.pathname.startsWith('/admin');
  if (isHiddenRoute) return null;

  const showMiniCart = totalItems > 0 && location.pathname !== '/cart';
  const freeShippingThreshold = 60;
  const missingForFreeShipping = Math.max(0, freeShippingThreshold - totalPrice);
  const progressPercent = Math.min(100, (totalPrice / freeShippingThreshold) * 100);

  return (
    <>
      {showMiniCart && (
        <div 
          className="floating-mini-cart responsive-bottom-width"
          onClick={() => navigate('/cart')}
        >
          {/* Shipping Progress Section */}
          <div style={{ padding: '10px 16px 6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <Truck size={14} color="#2ecc71" />
              <span style={{ fontSize: '11.5px', color: '#fff', fontWeight: 600 }}>
                {missingForFreeShipping > 0 
                  ? <>Faltam <strong style={{color:'#FFDF73'}}>R$ {missingForFreeShipping.toFixed(2).replace('.', ',')}</strong> para frete grátis</>
                  : <strong style={{color:'#2ecc71'}}>Você ganhou frete grátis!</strong>
                }
              </span>
            </div>
            {/* Progress Bar */}
            <div style={{ 
              width: '100%', 
              height: '5px', 
              background: 'rgba(255,255,255,0.1)', 
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: progressPercent === 100 ? '#2ecc71' : 'linear-gradient(90deg, #D4AF37, #FFDF73)',
                borderRadius: '3px',
                transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
              }} />
            </div>
          </div>

          {/* Cart Info Section */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                background: 'rgba(212, 175, 55, 0.15)',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}>
                <ShoppingBag size={14} color="#FFDF73" />
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#FFDF73',
                  color: '#000',
                  fontSize: '8.5px',
                  fontWeight: '900',
                  borderRadius: '50%',
                  width: '14px',
                  height: '14px',
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: '0 0 4px rgba(212,175,55,0.6)'
                }}>
                  {totalItems}
                </span>
              </div>
              <span style={{ fontSize: '11.5px', fontWeight: '850', color: '#fff', letterSpacing: '-0.1px' }}>
                Ver meu carrinho
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: '950', color: '#FFDF73' }}>
                R$ {totalPrice.toFixed(2)}
              </span>
              <span style={{ fontSize: '10px', color: '#FFDF73', animation: 'bounce-right 1.2s infinite ease-in-out', display: 'inline-block' }}>➔</span>
            </div>
          </div>
        </div>
      )}

      <nav className="bottom-nav responsive-bottom-width">
        <NavLink to="/" className={({ isActive }) => isActive ? "active" : ""}>
          <div className="nav-icon"><Home size={20} /></div>
          <span>Início</span>
        </NavLink>
        <NavLink to="/search" className={({ isActive }) => isActive ? "active" : ""}>
          <div className="nav-icon"><Search size={20} /></div>
          <span>Busca</span>
        </NavLink>
        <NavLink to="/promotions" className={({ isActive }) => isActive ? "active" : ""}>
          <div className="nav-icon"><Star size={20} /></div>
          <span>Promoções</span>
        </NavLink>
        <NavLink to="/clube" className={({ isActive }) => isActive ? "active" : ""}>
          <div className="nav-icon" style={{ position: 'relative' }}>
            <Gem size={20} />
            {/* Subtle notification dot on Clube tab */}
            <span style={{
              position: 'absolute',
              top: -2,
              right: -3,
              width: 6,
              height: 6,
              background: '#FFDF73',
              borderRadius: '50%',
              boxShadow: '0 0 6px #FFDF73'
            }}></span>
          </div>
          <span>Clube</span>
        </NavLink>
        <NavLink to="/orders" className={({ isActive }) => isActive ? "active" : ""}>
          <div className="nav-icon"><ShoppingBag size={20} /></div>
          <span>Pedidos</span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => isActive ? "active" : ""}>
          <div className="nav-icon"><User size={20} /></div>
          <span>Perfil</span>
        </NavLink>
      </nav>
    </>
  );
};
