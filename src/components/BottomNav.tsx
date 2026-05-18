import { Home, Search, Star, Gem, ShoppingBag, User } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';

export const BottomNav = () => {
  const { totalItems, totalPrice } = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  // Hide the mini-cart bar on the Cart checkout page itself
  const showMiniCart = totalItems > 0 && location.pathname !== '/cart';

  return (
    <>
      {showMiniCart && (
        <div 
          className="floating-mini-cart animate-pop"
          onClick={() => navigate('/cart')}
          style={{
            position: 'fixed',
            bottom: '76px', // Sits perfectly right above the bottom-nav (which is ~56px-64px high)
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 32px)',
            maxWidth: '398px',
            height: '52px',
            background: 'rgba(14, 11, 9, 0.94)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1.2px solid rgba(212, 175, 55, 0.45)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.65), 0 0 15px rgba(212, 175, 55, 0.15)',
            borderRadius: '14px',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
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
      )}

      <nav className="bottom-nav">
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
