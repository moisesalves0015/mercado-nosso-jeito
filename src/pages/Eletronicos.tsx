import { useState, useEffect } from 'react';
import { Zap, ShieldCheck } from 'lucide-react';
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

export const Eletronicos = () => {
  const [eletronicoProds, setEletronicoProds] = useState<Product[]>([]);

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

      setEletronicoProds(allProds.filter(p => p.category === 'Eletrônicos'));
    };

    loadProducts();
    window.addEventListener('app-products-updated', loadProducts);
    return () => window.removeEventListener('app-products-updated', loadProducts);
  }, []);

  return (
    <main className="app eletronicos-page" style={{ paddingTop: 0 }}>
      <Topbar />

      {/* ── Page title ──────────────────────────── */}
      <div style={{ padding: '18px 16px 4px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>Eletrônicos & Acessórios</h1>
        <p style={{ fontSize: 11, color: 'rgba(212,175,55,0.6)', margin: '3px 0 0', fontWeight: 600 }}>EMERGÊNCIA & CONVENIÊNCIA</p>
      </div>

      {/* TECH NEON EXPRESS BANNER */}
      <div className="promo-banner" style={{ 
        margin: '16px 0', 
        background: 'linear-gradient(135deg, #7C3AED 0%, #4C1D95 100%)', 
        border: '1px solid rgba(168, 85, 247, 0.3)',
        boxShadow: '0 8px 30px rgba(168, 85, 247, 0.15)',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div className="promo-text" style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <Zap size={12} color="#DDD6FE" />
            <span style={{ color: '#DDD6FE', fontSize: '8.5px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Entrega Turbo</span>
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#fff', margin: '0 0 4px 0' }}>Bateria no fim ou fone quebrado?</h3>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '11px', margin: 0, lineHeight: 1.3 }}>
            Não entre em pânico! Nós entregamos cabos, fones de ouvido e carregadores pré-testados na sua porta em minutos.
          </p>
        </div>
        <span style={{ fontSize: '32px', marginLeft: '12px' }}>⚡</span>
      </div>

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
