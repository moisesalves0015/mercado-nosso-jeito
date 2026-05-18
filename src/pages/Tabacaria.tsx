import { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles, AlertTriangle, ShieldCheck } from 'lucide-react';
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

export const Tabacaria = () => {
  const [tabacariaProds, setTabacariaProds] = useState<Product[]>([]);

  useEffect(() => {
    const loadProducts = () => {
      const stored = localStorage.getItem('app-products');
      if (stored) {
        const allProds = JSON.parse(stored) as Product[];
        setTabacariaProds(allProds.filter(p => p.category === 'Tabacaria'));
      } else {
        // Fallback default tabacaria products
        const defaults: Product[] = [
          { id: 'marlboro-gold', title: "Cigarro Marlboro Gold Box (20un)", price: 13.50, image: "https://images.unsplash.com/photo-1627140469085-fcd84814df2a?q=80&w=600", category: "Tabacaria", badge: "Mais Vendido", badgeStyle: "orange", diamondReward: 2 },
          { id: 'dunhill-carlton', title: "Cigarro Dunhill Carlton Blend (20un)", price: 14.00, image: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=600", category: "Tabacaria", diamondReward: 2 },
          { id: 'ignite-v50', title: "Vape Pod Ignite V50 Mentol (5000 Puffs)", price: 89.90, image: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?q=80&w=600", category: "Tabacaria", badge: "Premium", badgeStyle: "orange", diamondReward: 10 },
          { id: 'bic-grande', title: "Isqueiro Bic Grande Tradicional (1un)", price: 9.90, image: "https://images.unsplash.com/photo-1516245834210-c4c142787335?q=80&w=600", category: "Tabacaria", diamondReward: 1 },
          { id: 'seda-raw', title: "Seda Raw Classic King Size", price: 8.90, image: "https://images.unsplash.com/photo-1530631673369-bc24f5803c5f?q=80&w=600", category: "Tabacaria", diamondReward: 1 },
          { id: 'filtro-ocb', title: "Filtro OCB Slim Biodegradável (150un)", price: 7.50, image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=600", category: "Tabacaria" }
        ];
        setTabacariaProds(defaults);
      }
    };

    loadProducts();
    window.addEventListener('app-products-updated', loadProducts);
    return () => window.removeEventListener('app-products-updated', loadProducts);
  }, []);

  return (
    <main className="app tabacaria-page">
      {/* PREMIUM HEADER WITH BACK BUTTON */}
      <div className="topbar" style={{ justifyContent: 'flex-start', gap: '16px', borderBottom: '1px solid rgba(212, 175, 55, 0.2)', paddingBottom: '12px' }}>
        <Link to="/" className="circle-btn" style={{ background: 'rgba(212, 175, 55, 0.08)', border: '1px solid rgba(212, 175, 55, 0.25)' }}>
          <ArrowLeft size={22} color="#D4AF37" />
        </Link>
        <div>
          <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 900, margin: 0 }}>Tabacaria Premium</h2>
          <span style={{ color: '#D4AF37', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Conveniência 24 Horas</span>
        </div>
      </div>

      {/* SMOKY GOLD BANNER */}
      <div className="promo-banner" style={{ 
        margin: '16px 4px', 
        background: 'linear-gradient(135deg, #1A1A1A 0%, #0A0A0A 100%)', 
        border: '1px solid rgba(212, 175, 55, 0.3)',
        boxShadow: '0 8px 30px rgba(212, 175, 55, 0.1)'
      }}>
        <div className="promo-text">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <Sparkles size={11} color="#D4AF37" />
            <span style={{ color: '#D4AF37', fontSize: '8px', fontWeight: 900, textTransform: 'uppercase' }}>Lounge Exclusivo</span>
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#fff' }}>Sessão de Fumos & Sedas</h3>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>Entregamos de forma rápida e com total discrição.</p>
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
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', lineHeight: '1.4' }}>
              De acordo com a legislação vigente, é expressamente proibida a entrega de bebidas e tabaco a menores. O entregador solicitará documento oficial com foto.
            </p>
          </div>
        </div>
      </div>

      {/* INFO ROW */}
      <div style={{ display: 'flex', gap: '8px', margin: '0 4px 24px' }}>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={14} color="#D4AF37" />
          <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Embalagem Discreta</span>
        </div>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '14px' }}>⚡</span>
          <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Envio Rápido (30min)</span>
        </div>
      </div>

      {/* CURATED PRODUCTS GRID */}
      <h3 style={{ margin: '0 0 12px 6px', color: '#fff', fontSize: '15px', fontWeight: 800 }}>Destaques da Conveniência</h3>
      <div className="products-grid">
        {tabacariaProds.map(product => (
          <ProductCard key={product.id} {...product} />
        ))}
        {tabacariaProds.length === 0 && (
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', gridColumn: '1 / -1', textAlign: 'center', padding: '24px' }}>Nenhum item de tabacaria no catálogo.</span>
        )}
      </div>
    </main>
  );
};
