import { PartyPopper } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';

export const Promotions = () => {
  return (
    <main className="app promotions-page">
      <div className="topbar" style={{ justifyContent: 'center' }}>
        <h2 style={{ color: '#E7BC79', fontSize: '18px' }}>Promoções</h2>
      </div>

      <div className="promo-banner" style={{ margin: '16px' }}>
        <div className="promo-text">
          <h3>Ofertas do Dia</h3>
          <p>Aproveite antes que acabe!</p>
        </div>
        <PartyPopper size={40} color="#fff" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '0 16px 100px' }}>
        <ProductCard title="Suco de Laranja Integral Do Bem (1L)" price="R$ 14,90" image="/suco_do_bem_laranja_integral.png" badge="Promocional" badgeStyle="light" />
        <ProductCard title="Café Torrado e Moído Pilão (500g)" price="R$ 17,90" image="/Café-Pilão-Torrado-E-Moído-Tradicional-Almofada-500g.png" badge="Melhor Preço" badgeStyle="orange" />
        <ProductCard title="Queijo Minas Frescal Itambé (300g)" price="R$ 19,90" image="https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?q=80&w=600" badge="Promocional" badgeStyle="orange" />
        <ProductCard title="Multiuso Fresh Ultra" price="R$ 12,90" image="https://images.unsplash.com/photo-1610701596007-11502861dcfa?q=80&w=600" badge="Melhor Preço" badgeStyle="orange" />
      </div>
    </main>
  );
};
