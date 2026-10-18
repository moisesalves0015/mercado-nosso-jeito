import { useState, useEffect } from 'react';
import { PartyPopper, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { Topbar } from '../components/Topbar';
import { isProductPromotionCurrent } from '../utils/productPricing';

interface Product {
  id: string;
  title: string;
  price: number | string;
  image: string;
  category: string;
  badge?: string;
  badgeStyle?: 'orange' | 'light';
  diamondReward?: number;
  promoActive?: boolean;
  promoPrice?: number | string;
  promoExpiry?: string | number | Date | { toDate?: () => Date; seconds?: number } | null;
}

export const Promotions = () => {
  const [promoProds, setPromoProds] = useState<Product[]>([]);

  useEffect(() => {
    const loadProducts = () => {
      try {
        const stored = localStorage.getItem('app-products');
        const allProds = stored ? JSON.parse(stored) as Product[] : [];
        setPromoProds(allProds.filter(p => p.category === 'Promoções' || isProductPromotionCurrent(p)));
      } catch (error) {
        console.error('Não foi possível ler o catálogo de promoções.', error);
        setPromoProds([]);
      }
    };

    loadProducts();
    window.addEventListener('app-products-updated', loadProducts);
    return () => window.removeEventListener('app-products-updated', loadProducts);
  }, []);

  return (
    <main className="app promotions-page" style={{ paddingTop: 0 }}>
      <Topbar />

      {/* ── Page title ──────────────────────────── */}
      <div style={{ padding: '18px 16px 4px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>Promoções Especiais</h1>
        <p style={{ fontSize: 11, color: 'rgba(212,175,55,0.6)', margin: '3px 0 0', fontWeight: 600 }}>OFERTAS EXCLUSIVAS DO DIA</p>
      </div>

      {/* PROMO BANNER */}
      <div className="promo-banner" style={{ 
        margin: '16px 4px', 
        background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', 
        border: '1px solid rgba(239, 68, 68, 0.3)',
        boxShadow: '0 8px 30px rgba(239, 68, 68, 0.15)'
      }}>
        <div className="promo-text">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <Flame size={11} color="#fff" />
            <span style={{ color: '#fff', opacity: 0.9, fontSize: '8px', fontWeight: 900, textTransform: 'uppercase' }}>Super Descontos</span>
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#fff' }}>Leve Mais por Menos</h3>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '11px' }}>Aproveite as ofertas por tempo limitado!</p>
        </div>
        <PartyPopper size={40} color="#fff" />
      </div>

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
