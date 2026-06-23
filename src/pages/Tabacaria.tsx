import { useState, useEffect } from 'react';
import { Sparkles, AlertTriangle, ShieldCheck } from 'lucide-react';
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
}

export const Tabacaria = () => {
  const [tabacariaProds, setTabacariaProds] = useState<Product[]>([]);

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
            allProds.push(defP);
            updated = true;
          }
        });
      } else {
        allProds = [...defaultProducts];
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

      setTabacariaProds(allProds.filter(p => p.category === 'Tabacaria'));
    };

    loadProducts();
    window.addEventListener('app-products-updated', loadProducts);
    return () => window.removeEventListener('app-products-updated', loadProducts);
  }, []);

  return (
    <main className="app tabacaria-page" style={{ paddingTop: 0 }}>
      <Topbar />

      {/* ── Page title ──────────────────────────── */}
      <div style={{ padding: '18px 16px 4px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>Tabacaria Premium</h1>
        <p style={{ fontSize: 11, color: '#D4AF37', margin: '3px 0 0', fontWeight: 600 }}>CONVENIÊNCIA 24 HORAS</p>
      </div>

      {/* SMOKY GOLD BANNER */}
      <div className="promo-banner" style={{ 
        margin: '16px 4px', 
        background: 'var(--card-gradient)', 
        border: '1px solid var(--border-gold)',
        boxShadow: 'var(--card-shadow)'
      }}>
        <div className="promo-text">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <Sparkles size={11} color="#D4AF37" />
            <span style={{ color: '#D4AF37', fontSize: '8px', fontWeight: 900, textTransform: 'uppercase' }}>Lounge Exclusivo</span>
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-primary)' }}>Sessão de Fumos & Sedas</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Entregamos de forma rápida e com total discrição.</p>
        </div>
        <span style={{ fontSize: '32px' }}>🚬</span>
      </div>

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
