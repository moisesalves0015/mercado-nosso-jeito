import { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MapPin, ChevronRight, Heart } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAdminConfig } from '../hooks/useAdminConfig';
import { useDefaultCondo } from '../hooks/useDefaultCondo';
import { useUserDiamonds } from '../hooks/useUserDiamonds';
import { useFavorites } from '../hooks/useFavorites';

export const Topbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  // Condomínio vem do endereço padrão do usuário; prazo vem de settings/admin.deliveryEta.
  const condoName = useDefaultCondo();
  const { config: adminConfig } = useAdminConfig();
  const { diamonds } = useUserDiamonds();
  const { count: favoritesCount } = useFavorites();
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const nav = navRef.current;
      if (!nav) return;

      const activeEl = nav.querySelector<HTMLElement>('.topbar-nav-link.active');
      if (!activeEl) return;

      if (nav.scrollWidth > nav.clientWidth) {
        const navRect = nav.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();
        const currentScrollLeft = nav.scrollLeft;
        const targetScrollLeft = currentScrollLeft + (activeRect.left - navRect.left) - (nav.clientWidth / 2) + (activeEl.clientWidth / 2);

        nav.scrollTo({
          left: Math.max(0, targetScrollLeft),
          behavior: 'smooth'
        });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <div className="topbar-container">
      <div className="safe-area-top-bg" style={{ background: 'var(--bg-secondary)' }} />
      <div className="topbar">
        {/* ROW 1: LOCATION LEFT - SEARCH CENTER - GOLD BADGE RIGHT */}
      <div className="topbar-row-top">
        {/* ADDRESS / LOCATION */}
        <div className="topbar-location">
          <MapPin size={15} color="#FFDF73" fill="rgba(255, 223, 115, 0.15)" className="location-pin-icon" />
          <div className="location-info">
            <span className="location-label">
              {adminConfig.deliveryEta ? (
                <>Entrega em <span className="location-highlight">{adminConfig.deliveryEta}</span></>
              ) : (
                'Entrega no condomínio'
              )}
            </span>
            <span className="location-value">
              {condoName ?? (userProfile ? 'Cadastre seu endereço' : 'Entre para escolher o local')}
              <ChevronRight size={8} color="#FFDF73" style={{ display: 'inline', marginLeft: '1px' }} />
            </span>
          </div>
        </div>

        {/* LOGO COMPACT IN CENTER */}
        <div className="logo-compact">
          <h1 className="logo-main">mercado do</h1>
          <span className="logo-sub">nosso jeito</span>
        </div>

        {/* GOLD LEVEL BADGE */}
        <Link to="/clube" style={{ textDecoration: 'none' }} aria-label="Acessar o Clube">
          <div className="gold-level-badge">
            <div className="gold-badge-info">
              <span className="gold-badge-title">NOSSO CLUBE</span>
              <span className="gold-badge-points">
                {diamonds !== null ? (
                  <>
                    {diamonds.toLocaleString('pt-BR')} pts
                    <ChevronRight size={8} color="#FFDF73" style={{ display: 'inline', marginLeft: '1px' }} />
                  </>
                ) : (
                  <>
                    Benefícios
                    <ChevronRight size={8} color="#FFDF73" style={{ display: 'inline', marginLeft: '1px' }} />
                  </>
                )}
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* ROW 2: NAV LINKS LEFT/CENTER - ICONS RIGHT */}
      <div className="topbar-row-bottom">
        <div className="topbar-nav-links" ref={navRef}>
          <Link to="/" className={`topbar-nav-link ${location.pathname === '/' ? 'active' : ''}`}>
            Tudo
            {location.pathname === '/' && <span className="active-line"></span>}
          </Link>
          <Link to="/promotions" className={`topbar-nav-link ${location.pathname === '/promotions' ? 'active' : ''}`}>
            Promoções
            {location.pathname === '/promotions' && <span className="active-line"></span>}
          </Link>
          <Link to="/bebidas" className={`topbar-nav-link ${location.pathname === '/bebidas' ? 'active' : ''}`}>
            Bebidas
            {location.pathname === '/bebidas' && <span className="active-line"></span>}
          </Link>
          <Link to="/padaria" className={`topbar-nav-link ${location.pathname === '/padaria' ? 'active' : ''}`}>
            Padaria
            {location.pathname === '/padaria' && <span className="active-line"></span>}
          </Link>
          <Link to="/tabacaria" className={`topbar-nav-link ${location.pathname === '/tabacaria' ? 'active' : ''}`}>
            Tabacaria
            {location.pathname === '/tabacaria' && <span className="active-line"></span>}
          </Link>
          <Link to="/eletronicos" className={`topbar-nav-link ${location.pathname === '/eletronicos' ? 'active' : ''}`}>
            Eletrônicos
            {location.pathname === '/eletronicos' && <span className="active-line"></span>}
          </Link>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <button
            className="topbar-icon-btn"
            aria-label="Favoritos"
            title="Meus Favoritos"
            onClick={() => navigate('/favorites')}
            style={{
              background: 'transparent',
              border: 'none',
              color: favoritesCount > 0 ? '#ef4444' : 'var(--text-primary)',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
          >
            <Heart size={20} fill={favoritesCount > 0 ? '#ef4444' : 'none'} color={favoritesCount > 0 ? '#ef4444' : 'currentColor'} />
            {favoritesCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#ef4444',
                boxShadow: '0 0 6px rgba(239, 68, 68, 0.9)'
              }} />
            )}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};





