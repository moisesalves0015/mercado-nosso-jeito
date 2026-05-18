import { useState, useEffect } from 'react';
import { ArrowLeft, Zap, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';

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
      if (stored) {
        const allProds = JSON.parse(stored) as Product[];
        setEletronicoProds(allProds.filter(p => p.category === 'Eletrônicos'));
      } else {
        // Fallback default electronics
        const defaults: Product[] = [
          { id: 'fone-bluetooth', title: "Fone de Ouvido Bluetooth JBL Wave Flex", price: 289.90, image: "https://images.unsplash.com/photo-1608156639585-b3a032ef9689?q=80&w=600", category: "Eletrônicos", badge: "Frete Grátis", badgeStyle: "light", diamondReward: 40 },
          { id: 'carregador-turbo', title: "Carregador de Tomada Turbo Anker 20W USB-C", price: 79.90, image: "https://images.unsplash.com/photo-1618220179428-22790b461013?q=80&w=600", category: "Eletrônicos", diamondReward: 8 },
          { id: 'cabo-lightning', title: "Cabo USB-C para Lightning Reforçado (1m)", price: 29.90, image: "https://images.unsplash.com/photo-1541667590928-2c6b0ef4fcb3?q=80&w=600", category: "Eletrônicos", badge: "Ultra Resistente", diamondReward: 3 },
          { id: 'cabo-usbc', title: "Cabo USB-C para USB-C Turbo (1.2m)", price: 24.90, image: "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?q=80&w=600", category: "Eletrônicos", badge: "Turbo Power", diamondReward: 2 },
          { id: 'fone-p2', title: "Fone de Ouvido com Fio e Microfone P2", price: 19.90, image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=600", category: "Eletrônicos", badge: "Clássico", diamondReward: 2 },
          { id: 'powerbank', title: "Power Bank Portátil 10000mAh Ultra Rápido", price: 89.90, image: "https://images.unsplash.com/photo-1609592424109-dd89569ed053?q=80&w=600", category: "Eletrônicos", badge: "Bateria Extra", badgeStyle: "orange", diamondReward: 9 }
        ];
        setEletronicoProds(defaults);
      }
    };

    loadProducts();
    window.addEventListener('app-products-updated', loadProducts);
    return () => window.removeEventListener('app-products-updated', loadProducts);
  }, []);

  return (
    <main className="app eletronicos-page">
      {/* HIGH-TECH ELETRONICOS HEADER */}
      <div className="topbar" style={{ justifyContent: 'flex-start', gap: '16px', borderBottom: '1px solid rgba(168, 85, 247, 0.2)', paddingBottom: '12px' }}>
        <Link to="/" className="circle-btn" style={{ background: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '50%', textDecoration: 'none' }}>
          <ArrowLeft size={22} color="#A855F7" />
        </Link>
        <div>
          <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 900, margin: 0 }}>Eletrônicos & Acessórios</h2>
          <span style={{ color: '#A855F7', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Emergência & Conveniência</span>
        </div>
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
