import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { useShippingConfig } from '../hooks/useShippingConfig';
import { useHomeReadiness } from '../contexts/HomeReadinessContext';

/**
 * Ícones proprietários inspirados nos SF Symbols do iOS / iPhone:
 * - Modo inativo: traço fino e geométrico de precisão (strokeWidth 1.75)
 * - Modo selecionado (active): silhueta 100% preenchida esculpida com recortes negativos (cutouts)
 */
const SfHomeIcon = ({ active }: { active: boolean }) =>
  active ? (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.18 2.62a1.3 1.3 0 0 1 1.64 0l8.2 6.68c.3.25.48.62.48 1.01v9.59A2.1 2.1 0 0 1 19.4 22H4.6a2.1 2.1 0 0 1-2.1-2.1v-9.59c0-.39.18-.76.48-1.01l8.2-6.68ZM10.25 15a1.75 1.75 0 0 1 3.5 0v4.5h-3.5V15Z"
        fill="currentColor"
      />
    </svg>
  ) : (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.5 10.2 11.22 3.9a1.25 1.25 0 0 1 1.56 0l7.72 6.3M5.2 9.2v10.3a1.5 1.5 0 0 0 1.5 1.5h10.6a1.5 1.5 0 0 0 1.5-1.5V9.2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.75 21v-5.25a2.25 2.25 0 0 1 4.5 0V21"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

const SfSearchIcon = ({ active }: { active: boolean }) =>
  active ? (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.75 2.75a8 8 0 1 0 4.92 14.31l4.18 4.19a1.25 1.25 0 0 0 1.77-1.77l-4.19-4.18A8 8 0 0 0 10.75 2.75Zm-3.7 4.7a.85.85 0 0 1 1.2 0 .85.85 0 0 1 0 1.2 3.2 3.2 0 0 0-.94 2.27.85.85 0 1 1-1.7 0c0-1.3.52-2.55 1.44-3.47Z"
        fill="currentColor"
      />
    </svg>
  ) : (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10.75" cy="10.75" r="7" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="m16 16 4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );

const SfTagSparkleIcon = ({ active }: { active: boolean }) =>
  active ? (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.25 5.5A2.25 2.25 0 0 1 5.5 3.25h5.38c.6 0 1.17.24 1.59.66l8.12 8.12a2.25 2.25 0 0 1 0 3.18l-5.38 5.38a2.25 2.25 0 0 1-3.18 0l-8.12-8.12a2.25 2.25 0 0 1-.66-1.59V5.5Zm4.5 2.25a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"
        fill="currentColor"
      />
    </svg>
  ) : (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.75 5.75A2 2 0 0 1 5.75 3.75h5.13c.53 0 1.04.21 1.42.59l7.95 7.95a2 2 0 0 1 0 2.83l-5.13 5.13a2 2 0 0 1-2.83 0l-7.95-7.95a2 2 0 0 1-.59-1.42V5.75Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.35" fill="currentColor" />
    </svg>
  );

const SfDiamondIcon = ({ active }: { active: boolean }) =>
  active ? (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.4 3.25h11.2c.54 0 1.04.27 1.33.72l3.15 4.85c.35.53.29 1.24-.14 1.71l-8.82 9.75a1.5 1.5 0 0 1-2.24 0L2.06 10.53a1.4 1.4 0 0 1-.14-1.71l3.15-4.85c.29-.45.79-.72 1.33-.72Z"
        fill="currentColor"
      />
      <path
        d="M3.2 9.5h17.6M9.3 3.5 7.6 9.5l4.4 10.3M14.7 3.5l1.7 6-4.4 10.3"
        stroke="rgba(10, 21, 16, 0.55)"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 3.75h11l3.5 5.25-9 11.25L3 9l3.5-5.25Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.25 9h17.5M10 3.75 8 9l4 11.25L16 9l-2-5.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

const SfBagIcon = ({ active, size = 21 }: { active: boolean; size?: number }) =>
  active ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8.25 7V5.75a3.75 3.75 0 0 1 7.5 0V7"
        stroke="currentColor"
        strokeWidth="1.95"
        strokeLinecap="round"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.77 7h12.46c1.05 0 1.92.8 2 1.85l.74 9.75A2.25 2.25 0 0 1 18.73 21H5.27a2.25 2.25 0 0 1-2.24-2.4l.74-9.75A2.01 2.01 0 0 1 5.77 7Zm3.23 3.25a.75.75 0 0 1 .75.75 2.25 2.25 0 0 0 4.5 0 .75.75 0 0 1 1.5 0 3.75 3.75 0 0 1-7.5 0 .75.75 0 0 1 .75-.75Z"
        fill="currentColor"
      />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5.9 7.5h12.2c.98 0 1.8.75 1.88 1.72l.7 9.15A2.1 2.1 0 0 1 18.59 20.6H5.41a2.1 2.1 0 0 1-2.09-2.23l.7-9.15A1.89 1.89 0 0 1 5.9 7.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 7.5V5.75a3.5 3.5 0 0 1 7 0V7.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M9.5 11a2.5 2.5 0 0 0 5 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );

const SfUserIcon = ({ active }: { active: boolean }) =>
  active ? (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="7.75" r="4.25" fill="currentColor" />
      <path
        d="M4.25 19.1c0-3.23 3.47-5.6 7.75-5.6s7.75 2.37 7.75 5.6c0 .9-.73 1.65-1.65 1.65H5.9c-.92 0-1.65-.75-1.65-1.65Z"
        fill="currentColor"
      />
    </svg>
  ) : (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="7.75" r="3.85" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M4.75 19.5c0-3 3.25-5.25 7.25-5.25s7.25 2.25 7.25 5.25"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );

const LuxuryCourierIcon = ({ unlocked }: { unlocked: boolean }) => (
  <svg width="13" height="11" viewBox="0 0 24 18" fill="none" aria-hidden="true">
    <path
      d="M1.5 3.5A1.5 1.5 0 0 1 3 2h10.5A1.5 1.5 0 0 1 15 3.5V12H1.5V3.5Z"
      fill="currentColor"
    />
    <path
      d="M15 6h4.1c.52 0 1 .27 1.27.71l2.15 3.5c.15.24.23.51.23.79V12H15V6Z"
      fill="currentColor"
      fillOpacity={unlocked ? '0.95' : '0.85'}
    />
    <circle cx="6" cy="13.5" r="2.5" fill="currentColor" stroke="#0a1510" strokeWidth="1.2" />
    <circle cx="18.2" cy="13.5" r="2.5" fill="currentColor" stroke="#0a1510" strokeWidth="1.2" />
  </svg>
);

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
  const isFreeShippingUnlocked = missingForFreeShipping <= 0;

  return (
    <>
      {showMiniCart && (
        <div
          className={`floating-mini-cart responsive-bottom-width ${isFreeShippingUnlocked ? 'is-free-shipping' : ''}`}
          onClick={() => navigate('/cart')}
          role="button"
          tabIndex={0}
          aria-label={`Ver meu carrinho com ${totalItems} ${totalItems === 1 ? 'item' : 'itens'}, total R$ ${totalPrice.toFixed(2).replace('.', ',')}`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('/cart');
            }
          }}
        >
          {/* Linha Principal Editorial de Alta Costura (Gucci / Boutique): Sacola + Textos Completos + Fecho Metálico de Preço */}
          <div className="mini-cart-main-row">
            <div className="mini-cart-left-group">
              <div className="mini-cart-bag-box">
                <span className="lucide-shopping-bag mini-cart-bag-icon">
                  <SfBagIcon active={true} size={15} />
                </span>
                <span key={totalItems} className="mini-cart-count-badge">
                  {totalItems}
                </span>
              </div>

              <div className="mini-cart-text-col">
                <span className="mini-cart-title-text">
                  Ver meu carrinho
                </span>
                <span className="mini-cart-shipping-text">
                  {missingForFreeShipping > 0 ? (
                    <>
                      Faltam{' '}
                      <strong className="mini-cart-shipping-highlight">
                        R$ {missingForFreeShipping.toFixed(2).replace('.', ',')}
                      </strong>{' '}
                      para frete grátis
                    </>
                  ) : (
                    <strong className="mini-cart-shipping-unlocked">
                      Você ganhou frete grátis!
                    </strong>
                  )}
                </span>
              </div>
            </div>

            <div className="mini-cart-price-pill">
              <span className="mini-cart-price-value">
                R$ {totalPrice.toFixed(2).replace('.', ',')}
              </span>
              <svg
                className="mini-cart-price-arrow"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M5 12h14m0 0-5.5-5.5M19 12l-5.5 5.5"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* Fio Dourado Ultrafino com Courier Deslizando na Ponta */}
          <div className="mini-cart-progress-wrap">
            <div className="mini-cart-progress-track">
              <div
                className={`mini-cart-progress-fill ${isFreeShippingUnlocked ? 'is-unlocked' : ''}`}
                style={{ width: `${progressPercent}%` }}
              />
              <div
                className={`mini-cart-truck-marker ${isFreeShippingUnlocked ? 'is-unlocked' : ''}`}
                style={{
                  left: `clamp(9px, ${progressPercent}%, calc(100% - 9px))`,
                }}
              >
                <LuxuryCourierIcon unlocked={isFreeShippingUnlocked} />
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="bottom-nav responsive-bottom-width" aria-label="Navegação principal">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          {({ isActive }) => (
            <>
              <div className="nav-icon">
                <SfHomeIcon active={isActive} />
              </div>
              <span>Início</span>
            </>
          )}
        </NavLink>

        <NavLink to="/search" className={({ isActive }) => (isActive ? 'active' : '')}>
          {({ isActive }) => (
            <>
              <div className="nav-icon">
                <SfSearchIcon active={isActive} />
              </div>
              <span>Busca</span>
            </>
          )}
        </NavLink>

        <NavLink to="/promotions" className={({ isActive }) => (isActive ? 'active' : '')}>
          {({ isActive }) => (
            <>
              <div className="nav-icon">
                <SfTagSparkleIcon active={isActive} />
              </div>
              <span>Promoções</span>
            </>
          )}
        </NavLink>

        <NavLink to="/clube" className={({ isActive }) => (isActive ? 'active' : '')}>
          {({ isActive }) => (
            <>
              <div className="nav-icon" style={{ position: 'relative' }}>
                <SfDiamondIcon active={isActive} />
                <span className="bottom-nav-clube-dot" />
              </div>
              <span>Clube</span>
            </>
          )}
        </NavLink>

        <NavLink to="/orders" className={({ isActive }) => (isActive ? 'active' : '')}>
          {({ isActive }) => (
            <>
              <div className="nav-icon">
                <SfBagIcon active={isActive} />
              </div>
              <span>Pedidos</span>
            </>
          )}
        </NavLink>

        <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
          {({ isActive }) => (
            <>
              <div className="nav-icon">
                <SfUserIcon active={isActive} />
              </div>
              <span>Perfil</span>
            </>
          )}
        </NavLink>
      </nav>
    </>
  );
};
