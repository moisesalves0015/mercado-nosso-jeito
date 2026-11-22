import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { defaultProducts } from '../data/defaultProducts';
import { PageHeroBanner } from '../components/common/PageHeroBanner';

const DEFAULT_PADARIA_SLIDES = [
  {
    id: 'default-padaria',
    title: 'Pães & Croissants Frescos • Fornos Ligados o Dia Todo',
    image: '/pao_de_queijo.png',
    link: '/padaria',
  },
];

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

export const Padaria = () => {
  const [padariaProds, setPadariaProds] = useState<Product[]>([]);

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
            allProds.push(defP as Product);
            updated = true;
          }
        });
      } else {
        allProds = defaultProducts as Product[];
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
        try {
          localStorage.setItem('app-products', JSON.stringify(allProds));
        } catch {
          // ignore quota limits safely
        }
      }

      setPadariaProds(allProds.filter(p => p.category === 'Padaria') as Product[]);
    };

    loadProducts();
    window.addEventListener('app-products-updated', loadProducts);
    return () => window.removeEventListener('app-products-updated', loadProducts);
  }, []);

  return (
    <main className="app padaria-page" style={{ paddingTop: 0 }}>
      {/* ── Page title ──────────────────────────── */}
      <div style={{ padding: '18px 16px 4px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>Padaria & Confeitaria</h1>
        <p style={{ fontSize: 11, color: 'rgba(212,175,55,0.6)', margin: '3px 0 0', fontWeight: 600 }}>PÃES E DOCES ASSADOS NA HORA</p>
      </div>

      {/* DYNAMIC HERO BANNER VIA CRM ADMIN */}
      <PageHeroBanner placement="padaria" defaultSlides={DEFAULT_PADARIA_SLIDES} />

      {/* WARNING BANNER */}
      <div className="glass-panel" style={{ 
        margin: '0 4px 20px', 
        background: 'rgba(251, 191, 36, 0.03)', 
        border: '1px solid rgba(251, 191, 36, 0.15)', 
        padding: '12px',
        borderRadius: '12px'
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <div style={{ background: 'rgba(251, 191, 36, 0.1)', padding: '6px', borderRadius: '8px', color: '#FBBF24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Info size={15} />
          </div>
          <div>
            <h4 style={{ color: '#FBBF24', fontSize: '12px', fontWeight: 900, margin: '0 0 2px' }}>Pães Sob Encomenda</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '10px', lineHeight: '1.4', margin: 0 }}>
              Nossos pães franceses saem quentinhos do forno a cada hora! Para pedidos de fornadas especiais, peça pelo nosso chat de atendimento.
            </p>
          </div>
        </div>
      </div>

      {/* PRODUCTS GRID */}
      <h3 style={{ margin: '0 0 12px 6px', color: 'var(--text-primary)', fontSize: '15px', fontWeight: 800 }}>Fornada do Dia</h3>
      <div className="products-grid">
        {padariaProds.slice(0, 6).map(product => (
          <ProductCard key={product.id} {...product} />
        ))}
        {padariaProds.length === 0 && (
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', padding: '24px' }}>Nenhum item de padaria no catálogo.</span>
        )}
      </div>

      {padariaProds.length > 6 && (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0 40px' }}>
          <Link
            to="/search?category=Padaria"
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
            Ver todos ({padariaProds.length})
          </Link>
        </div>
      )}
    </main>
  );
};
