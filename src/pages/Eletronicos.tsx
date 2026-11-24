import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { PageHeroBanner } from '../components/common/PageHeroBanner';
import { useCatalog } from '../hooks/useCatalog';

const DEFAULT_ELETRONICOS_SLIDES = [
  {
    id: 'default-eletronicos',
    title: 'Eletrônicos & Acessórios • Cabos, Fones e Carregadores',
    image: '/hero_background.png',
    link: '/eletronicos',
  },
];

export const Eletronicos = () => {
  const { products } = useCatalog();

  const eletronicoProds = useMemo(() => {
    return products.filter((p) => p.active !== false && p.category === 'Eletrônicos');
  }, [products]);

  return (
    <main className="app eletronicos-page" style={{ paddingTop: 0 }}>
      {/* ── Page title ──────────────────────────── */}
      <div style={{ padding: '18px 16px 4px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>Eletrônicos & Acessórios</h1>
        <p style={{ fontSize: 11, color: 'rgba(212,175,55,0.6)', margin: '3px 0 0', fontWeight: 600 }}>EMERGÊNCIA & CONVENIÊNCIA</p>
      </div>

      {/* DYNAMIC HERO BANNER VIA CRM ADMIN */}
      <PageHeroBanner placement="eletronicos" defaultSlides={DEFAULT_ELETRONICOS_SLIDES} />

      {/* PRE-TESTED & WARRANTY NOTICE */}
      <div className="glass-panel" style={{ 
        margin: '0 0 20px', 
        background: 'rgba(168, 85, 247, 0.03)', 
        border: '1px solid rgba(168, 85, 247, 0.15)', 
        padding: '12px',
        borderRadius: '12px'
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '6px', borderRadius: '8px', color: '#A855F7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={16} />
          </div>
          <div>
            <h4 style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 900, margin: '0 0 2px' }}>Garantia & Qualidade</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '10px', lineHeight: '1.4', margin: 0 }}>
              Todos os nossos produtos eletrônicos têm <strong>90 dias de garantia</strong> contra qualquer defeito técnico e são <strong>100% testados</strong> antes de saírem para entrega!
            </p>
          </div>
        </div>
      </div>

      {/* QUICK HIGHLIGHTS ROW */}
      <div style={{ display: 'flex', gap: '8px', margin: '0 0 24px' }}>
        <div style={{ flex: 1, background: 'var(--card-bg)', border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '14px' }}>🔌</span>
          <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>100% Pré-Testado</span>
        </div>
        <div style={{ flex: 1, background: 'var(--card-bg)', border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '14px' }}>⚡</span>
          <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>Carregamento Turbo</span>
        </div>
      </div>

      {/* PRODUCTS GRID */}
      <h3 style={{ margin: '0 0 12px 0', color: 'var(--text-primary)', fontSize: '15px', fontWeight: 800 }}>Itens de Emergência</h3>
      <div className="products-grid">
        {eletronicoProds.slice(0, 6).map(product => (
          <ProductCard key={product.id} {...product} />
        ))}
        {eletronicoProds.length === 0 && (
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', padding: '24px' }}>Nenhum item eletrônico no catálogo.</span>
        )}
      </div>

      {eletronicoProds.length > 6 && (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0 40px' }}>
          <Link
            to="/search?category=Eletrônicos"
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
            Ver todos ({eletronicoProds.length})
          </Link>
        </div>
      )}
    </main>
  );
};
