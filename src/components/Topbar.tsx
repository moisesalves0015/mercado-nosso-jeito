import { MapPin, ChevronRight, User } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Topbar = () => {
  return (
    <div className="topbar">
      {/* ADDRESS PILL */}
      <div className="address-pill">
        <MapPin size={14} color="#D4AF37" className="address-pin" />
        <div className="address-info">
          <span className="address-label">Entregar em</span>
          <span className="address-value">Rua das Flores, 123</span>
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

      {/* PROFILE BUTTON */}
      <Link to="/profile" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="profile-wrapper">
          <div className="profile-circle">
            <User size={16} color="#fff" />
          </div>
          <span className="profile-text">Meu perfil</span>
        </div>
      </Link>
    </div>
  );
};
