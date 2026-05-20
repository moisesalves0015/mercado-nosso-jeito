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

      <div className="products-grid">
        <ProductCard title="Suco de Laranja Integral Do Bem (1L)" price="R$ 14,90" image="/suco_do_bem_laranja_integral.png" badge="Promocional" badgeStyle="light" category="promotions" />
        <ProductCard title="Café Torrado e Moído Pilão (500g)" price="R$ 17,90" image="/Café-Pilão-Torrado-E-Moído-Tradicional-Almofada-500g.png" badge="Melhor Preço" badgeStyle="orange" category="promotions" />
        <ProductCard title="Queijo Minas Frescal Itambé (300g)" price="R$ 19,90" image="/queijo_minas.png" badge="Promocional" badgeStyle="orange" category="promotions" />
        <ProductCard title="Multiuso Fresh Ultra" price="R$ 12,90" image="/pano_multiuso.webp" badge="Melhor Preço" badgeStyle="orange" category="promotions" />
      </div>
    </main>
  );
};
