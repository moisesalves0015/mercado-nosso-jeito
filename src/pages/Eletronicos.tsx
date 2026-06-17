import { useState, useEffect } from 'react';
import { ArrowLeft, Zap, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { MercadoLogo } from './Login';
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
    <main className="app eletronicos-page">
      {/* ── TOP BAR ──────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 16px 14px',
        borderBottom: '1px solid rgba(212,175,55,0.1)',
        background: 'rgba(9,7,5,0.3)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}>
        <Link
          to="/"
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '50%',
            width: '38px', height: '38px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'rgba(255,255,255,0.8)', flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </Link>

        <MercadoLogo size="sm" />

        <div style={{ width: '38px' }} />
      </div>

      {/* ── Page title ──────────────────────────── */}
      <div style={{ padding: '18px 16px 4px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.3px' }}>Eletrônicos & Acessórios</h1>
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
            <h4 style={{ color: '#fff', fontSize: '12px', fontWeight: 900, margin: '0 0 2px' }}>Garantia & Qualidade</h4>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', lineHeight: '1.4', margin: 0 }}>
              Todos os nossos produtos eletrônicos têm <strong>90 dias de garantia</strong> contra qualquer defeito técnico e são <strong>100% testados</strong> antes de saírem para entrega!
            </p>
          </div>
        </div>
      </div>

      {/* QUICK HIGHLIGHTS ROW */}
      <div style={{ display: 'flex', gap: '8px', margin: '0 0 24px' }}>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '14px' }}>🔌</span>
          <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>100% Pré-Testado</span>
        </div>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '14px' }}>⚡</span>
          <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Carregamento Turbo</span>
        </div>
      </div>

      {/* PRODUCTS GRID */}
      <h3 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '15px', fontWeight: 800 }}>Itens de Emergência</h3>
      <div className="products-grid">
        {eletronicoProds.map(product => (
          <ProductCard key={product.id} {...product} />
        ))}
        {eletronicoProds.length === 0 && (
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', gridColumn: '1 / -1', textAlign: 'center', padding: '24px' }}>Nenhum item eletrônico no catálogo.</span>
        )}
      </div>
    </main>
  );
};
