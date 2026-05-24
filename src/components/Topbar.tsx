import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, MapPin, Shield } from 'lucide-react';

export const Topbar = () => {
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
      {/* LINE 1: LOCATION + GOLD LEVEL */}
      <div className="topbar-header-row">
        {/* ADDRESS / LOCATION */}
        <div className="topbar-location">
          <MapPin size={16} color="#FFDF73" fill="rgba(255, 223, 115, 0.15)" className="location-pin-icon" />
          <div className="location-info">
            <span className="location-label">
              Entrega em até <span className="location-highlight">20 min</span>
            </span>
            <span className="location-value">
              Condomínio Vitória 
              <ChevronRight size={10} color="#FFDF73" style={{ display: 'inline', marginLeft: '2px' }} />
            </span>
          </div>
        </div>

        {/* GOLD LEVEL BADGE */}
        <Link to="/clube" style={{ textDecoration: 'none' }}>
          <div className="gold-level-badge">
            <Shield size={15} fill="#FFDF73" color="#FFDF73" className="gold-badge-shield" />
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

      {/* LINE 2: LOGO WITH EMPHASIS (BELOW ROW 1) */}
      <div className="topbar-logo-row">
        <div className="logo">
          <div className="logo-text">
            <h1 className="logo-main">mercado do</h1>
            <span className="logo-sub">nosso jeito</span>
          </div>
        </div>
      </div>
    </div>
  );
};


