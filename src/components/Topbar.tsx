import { MapPin, ChevronRight, User, Croissant } from 'lucide-react';

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

      {/* BRAND LOGO */}
      <div className="logo">
        <div className="logo-text">
          <h1 className="logo-main">mercado do</h1>
          <span className="logo-sub">nosso jeito</span>
        </div>
        <Croissant size={26} color="#FFDF73" className="logo-croissant" />
      </div>

      {/* PROFILE BUTTON */}
      <div className="profile-wrapper">
        <div className="profile-circle">
          <User size={16} color="#fff" />
        </div>
        <span className="profile-text">Meu perfil</span>
      </div>
    </div>
  );
};
