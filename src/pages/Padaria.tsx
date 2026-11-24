import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { PageHeroBanner } from '../components/common/PageHeroBanner';
import { useCatalog } from '../hooks/useCatalog';

const DEFAULT_PADARIA_SLIDES = [
  {
    id: 'default-padaria',
    title: 'Pães & Croissants Frescos • Fornos Ligados o Dia Todo',
    image: '/pao_de_queijo.png',
    link: '/padaria',
  },
];

export const Padaria = () => {
  const { products } = useCatalog();

  const padariaProds = useMemo(() => {
    return products.filter((p) => p.active !== false && p.category === 'Padaria');
  }, [products]);

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
