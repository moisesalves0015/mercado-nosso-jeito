import { Home, Search, Star, ShoppingBag, User } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export const BottomNav = () => {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => isActive ? "active" : ""}>
        <div className="nav-icon"><Home size={22} /></div>
        <span>Início</span>
      </NavLink>
      <NavLink to="/search" className={({ isActive }) => isActive ? "active" : ""}>
        <div className="nav-icon"><Search size={22} /></div>
        <span>Busca</span>
      </NavLink>
      <NavLink to="/promotions" className={({ isActive }) => isActive ? "active" : ""}>
        <div className="nav-icon"><Star size={22} /></div>
        <span>Promoções</span>
      </NavLink>
      <NavLink to="/orders" className={({ isActive }) => isActive ? "active" : ""}>
        <div className="nav-icon"><ShoppingBag size={22} /></div>
        <span>Pedidos</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => isActive ? "active" : ""}>
        <div className="nav-icon"><User size={22} /></div>
        <span>Perfil</span>
      </NavLink>
    </nav>
  );
};
