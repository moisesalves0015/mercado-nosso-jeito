import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Gem } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const Topbar = () => {
  const { userName } = useAuth();
  const fullName = userName || 'Moisés';
  const displayName = fullName.split(' ')[0];

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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Bom dia';
    if (hour >= 12 && hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <div className="topbar">
      {/* ADDRESS PILL */}
      <div className="address-pill">
        <div className="address-info">
          <span className="address-label">{getGreeting()}, {displayName}</span>
          <span className="address-value">Condomínio Vitória...</span>
        </div>
        <ChevronRight size={10} color="#D4AF37" />
      </div>

      {/* BRAND LOGO - TEXT ONLY */}
      <div className="logo">
        <div className="logo-text">
          <h1 className="logo-main">mercado do</h1>
          <span className="logo-sub">nosso jeito</span>
        </div>
      </div>

      {/* DIAMOND BADGE */}
      <Link to="/clube" style={{ textDecoration: 'none' }}>
        <div className="clube-coins-badge">
          <Gem size={11} fill="#FFDF73" />
          <span>{coins}</span>
        </div>
      </Link>
    </div>
  );
};
