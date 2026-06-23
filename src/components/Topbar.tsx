import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MapPin, ChevronRight, Heart, Menu, X, Home, LayoutGrid, Flame, Wine, Cigarette, Smartphone, Gamepad2, ShoppingBag, ClipboardList, User, ShieldAlert, LogOut, Cookie, Sun, Moon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const Topbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile, isAdmin, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [coins, setCoins] = useState<number>(() => {
    const saved = localStorage.getItem('user_diamonds');
    return saved ? parseInt(saved, 10) : 320;
  });

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const isLight = theme === 'light';

  useEffect(() => {
    const handleThemeChange = () => {
      setTheme(localStorage.getItem('theme') || 'dark');
    };
    window.addEventListener('theme-changed', handleThemeChange);
    return () => window.removeEventListener('theme-changed', handleThemeChange);
  }, []);

  const toggleTheme = () => {
    const nextTheme = isLight ? 'dark' : 'light';
    localStorage.setItem('theme', nextTheme);
    setTheme(nextTheme);
    window.dispatchEvent(new Event('theme-changed'));
  };

  const navRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (navRef.current) {
        const activeEl = navRef.current.querySelector('.topbar-nav-link.active');
        if (activeEl) {
          activeEl.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
          });
        }
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
              Entrega em <span className="location-highlight">20 min</span>
            </span>
            <span className="location-value">
              Condomínio Vitória
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
          <button className="topbar-icon-btn" title="Favoritos" style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Heart size={18} />
          </button>
          <button 
            className="topbar-hamburger-btn" 
            title="Menu" 
            style={{ padding: '4px' }}
            onClick={() => setIsMenuOpen(true)}
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      {/* SIDEBAR DRAWER MENU BACKDROP */}
      <div 
        className={`topbar-menu-backdrop ${isMenuOpen ? 'open' : ''}`}
        onClick={() => setIsMenuOpen(false)}
      />

      {/* SIDEBAR DRAWER MENU PANEL */}
      <div className={`topbar-menu-drawer ${isMenuOpen ? 'open' : ''}`}>
        <div className="topbar-menu-header">
          <div className="topbar-menu-logo">
            <h3 className="logo-main" style={{ margin: 0 }}>mercado do</h3>
            <span className="logo-sub" style={{ margin: 0 }}>nosso jeito</span>
          </div>
          <button 
            className="topbar-menu-close-btn" 
            onClick={() => setIsMenuOpen(false)}
            title="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* User profile summary */}
        <div className="topbar-menu-profile">
          {userProfile ? (
            <>
              {userProfile.foto ? (
                <img src={userProfile.foto} alt={userProfile.name} className="topbar-menu-avatar" />
              ) : (
                <div className="topbar-menu-avatar">
                  {userProfile.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="topbar-menu-user-info">
                <span className="topbar-menu-username">{userProfile.name}</span>
                <span className="topbar-menu-user-points">{coins.toLocaleString('pt-BR')} pts</span>
              </div>
            </>
          ) : (
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', textAlign: 'center' }}>
                Acesse sua conta para fazer pedidos
              </div>
              <Link 
                to="/login" 
                className="topbar-menu-login-btn" 
                onClick={() => setIsMenuOpen(false)}
                style={{ display: 'block' }}
              >
                Entrar / Cadastrar
              </Link>
            </div>
          )}
        </div>

        {/* Nav Links */}
        <div className="topbar-menu-nav">
          <Link to="/" className={`topbar-menu-nav-link ${location.pathname === '/' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>
            <Home size={16} />
            <span>Início</span>
          </Link>

          <Link to="/categories" className={`topbar-menu-nav-link ${location.pathname === '/categories' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>
            <LayoutGrid size={16} />
            <span>Categorias</span>
          </Link>

          <Link to="/promotions" className={`topbar-menu-nav-link ${location.pathname === '/promotions' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>
            <Flame size={16} />
            <span>Promoções</span>
          </Link>

          <Link to="/bebidas" className={`topbar-menu-nav-link ${location.pathname === '/bebidas' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>
            <Wine size={16} />
            <span>Bebidas</span>
          </Link>

          <Link to="/padaria" className={`topbar-menu-nav-link ${location.pathname === '/padaria' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>
            <Cookie size={16} />
            <span>Padaria</span>
          </Link>

          <Link to="/tabacaria" className={`topbar-menu-nav-link ${location.pathname === '/tabacaria' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>
            <Cigarette size={16} />
            <span>Tabacaria</span>
          </Link>

          <Link to="/eletronicos" className={`topbar-menu-nav-link ${location.pathname === '/eletronicos' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>
            <Smartphone size={16} />
            <span>Eletrônicos</span>
          </Link>

          <Link to="/roleta" className={`topbar-menu-nav-link ${location.pathname === '/roleta' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>
            <Gamepad2 size={16} />
            <span>Roleta Premiada</span>
          </Link>

          <Link to="/cart" className={`topbar-menu-nav-link ${location.pathname === '/cart' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>
            <ShoppingBag size={16} />
            <span>Meu Carrinho</span>
          </Link>

          <Link to="/orders" className={`topbar-menu-nav-link ${location.pathname === '/orders' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>
            <ClipboardList size={16} />
            <span>Meus Pedidos</span>
          </Link>

          <Link to="/profile" className={`topbar-menu-nav-link ${location.pathname === '/profile' ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>
            <User size={16} />
            <span>Minha Conta</span>
          </Link>

          {isAdmin && (
            <Link to="/admin" className={`topbar-menu-nav-link ${location.pathname.startsWith('/admin') ? 'active' : ''}`} onClick={() => setIsMenuOpen(false)}>
              <ShieldAlert size={16} />
              <span>Painel Admin</span>
            </Link>
          )}

          {/* Theme switcher inside list */}
          <div 
            className="topbar-menu-nav-link" 
            onClick={toggleTheme}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isLight ? <Sun size={16} color="#D4AF37" /> : <Moon size={16} color="#6366F1" />}
              <span>Modo Claro</span>
            </div>
            <div style={{
              width: '34px',
              height: '18px',
              borderRadius: '99px',
              background: isLight ? 'linear-gradient(135deg, #D4AF37, #FFDF73)' : 'rgba(255,255,255,0.15)',
              position: 'relative',
              transition: 'all 0.2s ease',
              border: '1px solid var(--border-primary)',
            }}>
              <div style={{
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: isLight ? '#000' : '#fff',
                position: 'absolute',
                top: '1px',
                left: isLight ? '17px' : '1px',
                transition: 'all 0.2s ease',
              }} />
            </div>
          </div>
        </div>

        {/* Footer with logout button */}
        {userProfile && (
          <div className="topbar-menu-footer">
            <button 
              className="topbar-menu-logout-btn"
              onClick={() => {
                setIsMenuOpen(false);
                logout();
                navigate('/');
              }}
            >
              <LogOut size={16} />
              <span>Sair da Conta</span>
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};





