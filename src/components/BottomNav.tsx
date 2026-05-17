import { Home, Search, Star, ShoppingBag, User } from 'lucide-react';

export const BottomNav = () => {
  return (
    <nav className="bottom-nav">
      <a href="#" className="active">
        <div className="nav-icon"><Home size={22} /></div>
        <span>Início</span>
      </a>
      <a href="#">
        <div className="nav-icon"><Search size={22} /></div>
        <span>Busca</span>
      </a>
      <a href="#">
        <div className="nav-icon"><Star size={22} /></div>
        <span>Promoções</span>
      </a>
      <a href="#">
        <div className="nav-icon"><ShoppingBag size={22} /></div>
        <span>Pedidos</span>
      </a>
      <a href="#">
        <div className="nav-icon"><User size={22} /></div>
        <span>Perfil</span>
      </a>
    </nav>
  );
};
