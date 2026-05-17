import { Home, Search, Star, Gem, ShoppingBag, User } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export const BottomNav = () => {
  return (
    <nav className="bottom-nav">
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
  );
};
