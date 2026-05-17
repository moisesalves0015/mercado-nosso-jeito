import { MapPin, Home, Croissant } from 'lucide-react';

export const Topbar = () => {
  return (
    <>
      <div className="topbar">
        <div className="circle-btn">
          <MapPin size={24} color="#E7BC79" />
        </div>
        <div className="logo">
          <div className="logo-text">
            <h1>mercado do</h1>
            <span>nosso jeito</span>
          </div>
          <div className="logo-icon">
            <Croissant size={32} color="#E7BC79" />
          </div>
        </div>
        <div className="circle-btn">
          <Home size={24} color="#E7BC79" />
        </div>
      </div>
      
      <div className="sub-nav">
        <span>Todas</span>
        <span>Home & Decor</span>
      </div>
    </>
  );
};
