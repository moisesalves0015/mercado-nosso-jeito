import { useState, useEffect } from 'react';
import { PartyPopper, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { Topbar } from '../components/Topbar';
import { defaultProducts } from '../data/defaultProducts';

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
}

export const Promotions = () => {
  const [promoProds, setPromoProds] = useState<Product[]>([]);

  useEffect(() => {
    const loadProducts = () => {
      const stored = localStorage.getItem('app-products');
      let allProds: Product[] = [];
      let updated = false;

      if (stored) {
        allProds = JSON.parse(stored) as Product[];
        // Check for missing default products and add them
        defaultProducts.forEach(defP => {
          if (!allProds.some(p => p.id === defP.id)) {
            allProds.push(defP as any);
            updated = true;
          }
        });
      } else {
        allProds = defaultProducts as any[];
        updated = true;
      }

      // Sync specific image updates if necessary
      allProds = allProds.map(p => {
        if (p.id === 'corona-330ml' && p.image.includes('1608270176050-12ec057deab0')) {
          p.image = 'https://images.unsplash.com/photo-1600788886242-5c96aabe3757?q=80&w=600';
          updated = true;
        }
        if (p.image && p.image.includes('1548907040-4d42b52145ca')) {
          p.image = 'https://images.unsplash.com/photo-1511381939415-e4401546383a?q=80&w=600';
          updated = true;
        }
        if (p.image && p.image.includes('1599490659213-e2b9527bb087')) {
          p.image = 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?q=80&w=600';
          updated = true;
        }
        if (p.image && p.image.includes('1549778398-f3c481549766')) {
          p.image = 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=600';
          updated = true;
        }
        return p;
      });

      if (updated) {
        localStorage.setItem('app-products', JSON.stringify(allProds));
      }

      // Promotions are products with category "Promoções" OR promoActive === true
      const filtered = allProds.filter(
        p => p.category === 'Promoções' || p.promoActive === true
      );
      setPromoProds(filtered as any[]);
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
