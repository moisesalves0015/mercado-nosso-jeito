import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { PageHeroBanner } from '../components/common/PageHeroBanner';
import { useCatalog } from '../hooks/useCatalog';

const DEFAULT_TABACARIA_SLIDES = [
  {
    id: 'default-tabacaria',
    title: 'Tabacaria & Sedas • Lounge Exclusivo',
    image: '/hero_tabacaria.png',
    link: '/tabacaria',
  },
];

export const Tabacaria = () => {
  const { products } = useCatalog();

  const tabacariaProds = useMemo(() => {
    return products.filter((p) => p.active !== false && p.category === 'Tabacaria');
  }, [products]);

  return (
    <main className="app tabacaria-page" style={{ paddingTop: 0 }}>
      {/* ── Page title ──────────────────────────── */}
      <div style={{ padding: '18px 16px 4px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>Tabacaria Premium</h1>
        <p style={{ fontSize: 11, color: '#D4AF37', margin: '3px 0 0', fontWeight: 600 }}>CONVENIÊNCIA 24 HORAS</p>
      </div>

      {/* DYNAMIC HERO BANNER VIA CRM ADMIN */}
      <PageHeroBanner placement="tabacaria" defaultSlides={DEFAULT_TABACARIA_SLIDES} />

      {/* COMPLIANCE AGE WARNING BANNER (18+) */}
      <div className="glass-panel" style={{ 
        margin: '0 4px 20px', 
        background: 'rgba(239, 68, 68, 0.04)', 
        border: '1px solid rgba(239, 68, 68, 0.2)', 
        padding: '12px',
        borderRadius: '12px'
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '6px', borderRadius: '8px', color: '#EF4444' }}>
            <AlertTriangle size={15} />
          </div>
          <div>
            <h4 style={{ color: '#EF4444', fontSize: '12px', fontWeight: 900, margin: '0 0 2px' }}>Venda Restrita (Apenas 18+)</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '10px', lineHeight: '1.4' }}>
              De acordo com a legislação vigente, é expressamente proibida a entrega de bebidas e tabaco a menores. O entregador solicitará documento oficial com foto.
            </p>
          </div>
        </div>
      </div>

      {/* INFO ROW */}
      <div style={{ display: 'flex', gap: '8px', margin: '0 4px 24px' }}>
        <div style={{ flex: 1, background: 'var(--input-bg)', border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={14} color="#D4AF37" />
          <span style={{ fontSize: '9.5px', color: 'var(--text-primary)', fontWeight: 600 }}>Embalagem Discreta</span>
        </div>
        <div style={{ flex: 1, background: 'var(--input-bg)', border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '14px' }}>⚡</span>
          <span style={{ fontSize: '9.5px', color: 'var(--text-primary)', fontWeight: 600 }}>Envio Rápido (30min)</span>
        </div>
      </div>

      {/* CURATED PRODUCTS GRID */}
      <h3 style={{ margin: '0 0 12px 6px', color: 'var(--text-primary)', fontSize: '15px', fontWeight: 800 }}>Destaques da Conveniência</h3>
      <div className="products-grid">
        {tabacariaProds.slice(0, 6).map(product => (
          <ProductCard key={product.id} {...product} />
        ))}
        {tabacariaProds.length === 0 && (
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', padding: '24px' }}>Nenhum item de tabacaria no catálogo.</span>
        )}
      </div>

      {tabacariaProds.length > 6 && (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0 40px' }}>
          <Link
            to="/search?category=Tabacaria"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(212,175,55,0.08)',
              border: '1px solid rgba(212,175,55,0.3)',
              borderRadius: '8px',
              padding: '10px 24px',
              color: '#D4AF37',
              fontSize: '12px',
              fontWeight: 800,
              textDecoration: 'none',
              transition: 'all 0.2s',
              fontFamily: 'Manrope, sans-serif'
            }}
          >
            Ver todos ({tabacariaProds.length})
          </Link>
        </div>
      )}
    </main>
  );
};
