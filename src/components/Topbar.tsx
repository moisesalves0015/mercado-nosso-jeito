import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPin, ChevronRight, Heart, Search, Menu } from 'lucide-react';

export const Topbar = () => {
  const location = useLocation();
  const [coins, setCoins] = useState<number>(() => {
    const saved = localStorage.getItem('user_diamonds');
    return saved ? parseInt(saved, 10) : 320;
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('user_diamonds');
      if (saved) {
        setCoins(parseInt(saved, 10));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('diamonds_updated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('diamonds_updated', handleStorageChange);
    };
  }, []);

  return (
    <div className="topbar">
      {/* ROW 1: LOCATION LEFT - SEARCH CENTER - GOLD BADGE RIGHT */}
      <div className="topbar-row-top">
        {/* ADDRESS / LOCATION */}
        <div className="topbar-location">
          <MapPin size={15} color="#FFDF73" fill="rgba(255, 223, 115, 0.15)" className="location-pin-icon" />
          <div className="location-info">
            <span className="location-label">
              Entrega em <span className="location-highlight">20 min</span>
            </span>
            <span className="location-value">
              Condomínio Vitória
              <ChevronRight size={8} color="#FFDF73" style={{ display: 'inline', marginLeft: '1px' }} />
            </span>
          </div>
        </div>

        {/* SEARCH BOX IN CENTER */}
        <div className="topbar-search-container">
          <input 
            type="text" 
            placeholder="Pesquisar no mercado" 
            className="topbar-search-input" 
          />
          <button className="topbar-search-btn" title="Buscar">
            <Search size={14} />
          </button>
        </div>

        {/* GOLD LEVEL BADGE */}
        <Link to="/clube" style={{ textDecoration: 'none' }}>
          <div className="gold-level-badge">
            <div className="gold-badge-info">
              <span className="gold-badge-title">NÍVEL OURO</span>
              <span className="gold-badge-points">
                {(5004617 + coins).toLocaleString('pt-BR')} pts
                <ChevronRight size={8} color="#FFDF73" style={{ display: 'inline', marginLeft: '1px' }} />
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* ROW 2: NAV LINKS LEFT/CENTER - ICONS RIGHT */}
      <div className="topbar-row-bottom">
        <div className="topbar-nav-links">
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
          <Link to="/clube" className={`topbar-nav-link ${location.pathname === '/clube' ? 'active' : ''}`}>
            Clube
            {location.pathname === '/clube' && <span className="active-line"></span>}
          </Link>
          <Link to="/pedidos" className={`topbar-nav-link ${location.pathname === '/pedidos' ? 'active' : ''}`}>
            Pedidos
            {location.pathname === '/pedidos' && <span className="active-line"></span>}
          </Link>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="topbar-icon-btn" title="Favoritos" style={{ background: 'transparent', border: 'none', color: '#fff', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Heart size={18} />
          </button>
          <button className="topbar-hamburger-btn" title="Menu" style={{ padding: '4px' }}>
            <Menu size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};





