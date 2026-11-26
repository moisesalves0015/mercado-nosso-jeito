import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { isProductPromotionCurrent } from '../utils/productPricing';
import { PageHeroBanner } from '../components/common/PageHeroBanner';
import { useCatalog } from '../hooks/useCatalog';

const DEFAULT_PROMO_SLIDES = [
  {
    id: 'default-promo',
    title: 'Super Descontos • Leve Mais por Menos',
    image: '/hero_background.png',
    link: '/promotions',
  },
];

export const Promotions = () => {
  const { products } = useCatalog();

  const promoProds = useMemo(() => {
    return products.filter(
      (p) => p.active !== false && (p.category === 'Promoções' || isProductPromotionCurrent(p))
    );
  }, [products]);

  return (
    <main className="app promotions-page" style={{ paddingTop: 0 }}>
      {/* ── Page title ──────────────────────────── */}
      <div className="page-title-block">
        <h1 className="commerce-title">Promoções Especiais</h1>
        <p className="commerce-subtitle commerce-subtitle--gold">OFERTAS EXCLUSIVAS DO DIA</p>
      </div>

      {/* DYNAMIC HERO BANNER VIA CRM ADMIN */}
      <PageHeroBanner placement="promotions" defaultSlides={DEFAULT_PROMO_SLIDES} />

      {/* PRODUCTS GRID */}
      <h3 style={{ margin: '0 0 12px 6px', color: 'var(--text-primary)', fontSize: '15px', fontWeight: 800 }}>Destaques em Oferta</h3>
      <div className="products-grid">
        {promoProds.slice(0, 6).map(product => (
          <ProductCard key={product.id} {...product} />
        ))}
        {promoProds.length === 0 && (
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', padding: '24px' }}>Nenhuma oferta ativa no momento.</span>
        )}
      </div>

      {promoProds.length > 6 && (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0 40px' }}>
          <Link
            to="/search?category=Promoções"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(212,175,55,0.08)',
              border: '1px solid rgba(212,175,55,0.3)',
              borderRadius: '8px',
              padding: '10px 24px',
              color: '#FFDF73',
              fontSize: '12px',
              fontWeight: 800,
              textDecoration: 'none',
              transition: 'all 0.2s',
              fontFamily: 'Manrope, sans-serif'
            }}
          >
            Ver todos ({promoProds.length})
          </Link>
        </div>
      )}
    </main>
  );
};
