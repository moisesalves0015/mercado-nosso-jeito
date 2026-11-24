import { Home, Search, Star, Gem, ShoppingBag, User, Truck } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { useShippingConfig } from '../hooks/useShippingConfig';
import { useHomeReadiness } from '../contexts/HomeReadinessContext';

export const BottomNav = () => {
  const { totalItems, totalPrice } = useCart();
  const { config: shippingConfig } = useShippingConfig();
  const { isHomeShellReady } = useHomeReadiness();
  const location = useLocation();
  const navigate = useNavigate();

  // Hide completely on login, register, forgot-password, checkout, admin pages, or during initial Home bootstrap
  const isHiddenRoute =
    ['/login', '/register', '/forgot-password', '/checkout'].includes(location.pathname) ||
    location.pathname.startsWith('/admin') ||
    (location.pathname === '/' && !isHomeShellReady);
  if (isHiddenRoute) return null;

  // Showcase routes where product catalogs/cards are rendered
  const isShowcaseRoute = (pathname: string): boolean => {
    if (pathname === '/') return true;
    if (['/categories', '/promotions', '/search', '/bebidas', '/padaria', '/eletronicos', '/tabacaria', '/favorites'].includes(pathname)) return true;
    if (pathname.startsWith('/product/')) return true;
    return false;
  };

  // Mini-cart is ONLY visible on showcase pages, never on non-showcase pages (orders, profile, coupons, support, clube, roleta, cart, checkout, etc.)
  const showMiniCart = totalItems > 0 && isShowcaseRoute(location.pathname);
  const freeShippingThreshold = shippingConfig?.freeShippingThreshold ?? 60;
  const missingForFreeShipping = Math.max(0, freeShippingThreshold - totalPrice);
  const progressPercent = Math.min(100, (totalPrice / freeShippingThreshold) * 100);

  return (
    <>
      {showMiniCart && (
        <div 
          className="floating-mini-cart responsive-bottom-width"
          onClick={() => navigate('/cart')}
        >
          {/* Compact Top Row: Bag + Ver meu carrinho + Frete Grátis Info + Price */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 12px 4px',
            gap: '8px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
              <div className="mini-cart-bag-box" style={{
                background: 'rgba(212, 175, 55, 0.16)',
                border: '1px solid rgba(212, 175, 55, 0.35)',
                borderRadius: '10px',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                flexShrink: 0,
              }}>
                <ShoppingBag size={14} color="#D4AF37" className="lucide-shopping-bag" />
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#D4AF37',
                  color: '#000',
                  fontSize: '8px',
                  fontWeight: '900',
                  borderRadius: '5px',
                  minWidth: '14px',
                  height: '14px',
                  padding: '0 2.5px',
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.45)'
                }}>
                  {totalItems}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.15 }}>
                <span style={{ fontSize: '11px', fontWeight: '900', color: 'var(--text-primary)', letterSpacing: '-0.1px', whiteSpace: 'nowrap' }}>
                  Ver meu carrinho
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-primary)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.92 }}>
                  {missingForFreeShipping > 0 
                    ? <>Faltam <strong style={{ color: '#FFE57F' }}>R$ {missingForFreeShipping.toFixed(2).replace('.', ',')}</strong> p/ frete grátis</>
                    : <strong style={{ color: '#2ecc71' }}>Você ganhou frete grátis!</strong>
                  }
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', fontWeight: '950', color: '#FFE57F' }}>
                R$ {totalPrice.toFixed(2).replace('.', ',')}
              </span>
              <span style={{ fontSize: '10px', color: '#FFE57F', animation: 'bounce-right 1.2s infinite ease-in-out', display: 'inline-block' }}>➔</span>
            </div>
          </div>

          {/* Slim Progress Track with Truck Moving Along the Fill Tip */}
          <div style={{ padding: '5px 14px 7px' }}>
            <div style={{ 
              width: '100%', 
              height: '4px', 
              background: 'rgba(255, 255, 255, 0.14)', 
              borderRadius: '99px',
              position: 'relative',
              overflow: 'visible',
            }}>
              <div style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: progressPercent === 100 ? '#2ecc71' : 'linear-gradient(90deg, #D4AF37, #FFE57F)',
                borderRadius: '99px',
                transition: 'width 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: progressPercent === 100 ? '0 0 8px rgba(46, 204, 113, 0.7)' : '0 0 8px rgba(255, 229, 127, 0.55)',
              }} />
              {/* Caminhãozinho progredindo exatamente no mesmo ponto da ponta da barra */}
              <div
                style={{
                  position: 'absolute',
                  left: `clamp(8px, ${progressPercent}%, calc(100% - 8px))`,
                  top: '50%',
                  transform: 'translate(-50%, -58%)',
                  transition: 'left 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.85))',
                }}
              >
                <Truck
                  size={13}
                  color={progressPercent === 100 ? '#2ecc71' : '#FFE57F'}
                  strokeWidth={2.5}
                />
              </div>
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
