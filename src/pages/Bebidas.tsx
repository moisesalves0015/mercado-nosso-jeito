import { useState, useEffect } from 'react';
import { ArrowLeft, Snowflake, AlertOctagon } from 'lucide-react';
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

export const Bebidas = () => {
  const [currentIceIndex, setCurrentIceIndex] = useState(0);
  const [bebidas, setBebidas] = useState<Product[]>([]);

  useEffect(() => {
    const loadProducts = () => {
      const stored = localStorage.getItem('app-products');
      if (stored) {
        const allProds = JSON.parse(stored) as Product[];
        setBebidas(allProds.filter(p => p.category === 'Bebidas'));
      } else {
        // Fallback defaults
        const defaults: Product[] = [
          { id: 'heineken-330ml', title: "Cerveja Heineken Long Neck (330ml)", price: 7.90, image: "https://images.unsplash.com/photo-1608270586620-248524c67de9?q=80&w=600", category: "Bebidas", badge: "Trincando", badgeStyle: "orange", diamondReward: 2 },
          { id: 'coca-cola-350ml', title: "Refrigerante Coca-Cola Sem Açúcar Lata (350ml)", price: 4.50, image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=600", category: "Bebidas", diamondReward: 1 },
          { id: 'monster-energy', title: "Energético Monster Energy Tradicional (473ml)", price: 9.90, image: "https://images.unsplash.com/photo-1622543956221-c6328ecf8443?q=80&w=600", category: "Bebidas", badge: "Mais Vendido", badgeStyle: "orange", diamondReward: 3 },
          { id: 'spaten-350ml', title: "Cerveja Spaten Puro Malte Lata (350ml)", price: 5.20, image: "https://images.unsplash.com/photo-1600788886242-5c96aabe3757?q=80&w=600", category: "Bebidas", diamondReward: 1 },
          { id: 'suco-dobem', title: "Suco de Laranja Integral Do Bem (1L)", price: 14.90, image: "/suco_do_bem_laranja_integral.png", category: "Bebidas", badge: "100% Suco", badgeStyle: "light", diamondReward: 10 },
          { id: 'agua-crystal', title: "Água Mineral Sem Gás Crystal (500ml)", price: 2.50, image: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?q=80&w=600", category: "Bebidas" }
        ];
        setBebidas(defaults);
      }
    };

    loadProducts();
    window.addEventListener('app-products-updated', loadProducts);
    return () => window.removeEventListener('app-products-updated', loadProducts);
  }, []);

  const iceProducts = bebidas.slice(0, 4);

  useEffect(() => {
    if (iceProducts.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIceIndex((prev) => (prev + 1) % iceProducts.length);
    }, 4500); // Slowed down significantly for a calm and premium feel
    return () => clearInterval(timer);
  }, [iceProducts.length]);

  // Generate 12 snow particles with randomized physics
  const snowParticles = Array.from({ length: 12 }).map((_, i) => {
    const left = Math.random() * 100;
    const delay = Math.random() * 5;
    const duration = 4 + Math.random() * 4;
    const size = 8 + Math.random() * 8;
    const opacity = 0.2 + Math.random() * 0.45;
    return (
      <span
        key={i}
        className="snowflake-particle"
        style={{
          left: `${left}%`,
          animationDelay: `${delay}s`,
          animationDuration: `${duration}s`,
          fontSize: `${size}px`,
          opacity: opacity
        }}
      >
        ❄
      </span>
    );
  });

  return (
    <main className="app bebidas-page">
      {/* ICY REFRESHING HEADER */}
      <div className="topbar" style={{ justifyContent: 'flex-start', gap: '16px', borderBottom: '1px solid rgba(14, 165, 233, 0.2)', paddingBottom: '12px' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: '#0EA5E9' }}>
          <ArrowLeft size={22} />
        </Link>
        <div>
          <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 900, margin: 0 }}>Bebidas Geladas</h2>
          <span style={{ color: '#0EA5E9', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trincando no Gelo</span>
        </div>
      </div>

      {/* FROSTY AD BANNER */}
      <div className="promo-banner" style={{ 
        margin: '16px 0', 
        background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)', 
        border: '1px solid rgba(14, 165, 233, 0.3)',
        boxShadow: '0 8px 30px rgba(14, 165, 233, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '16px 14px',
        minHeight: '200px', /* Comfortable height to fit standard card beautifully */
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Confined falling snowflakes container in the background */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
          {snowParticles}
        </div>

        <div className="promo-text" style={{ 
          width: '50%', 
          flexShrink: 0, 
          display: 'flex',
          flexDirection: 'column',
          alignSelf: 'flex-start',
          marginTop: '12px', /* Perfectly pushes to the top with a premium margins margin */
          position: 'relative', 
          zIndex: 2 
        }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: 4, 
            marginBottom: 8,
            background: 'rgba(224, 242, 254, 0.15)',
            padding: '3px 8px',
            borderRadius: '999px',
            border: '1px solid rgba(224, 242, 254, 0.25)',
            backdropFilter: 'blur(4px)',
            alignSelf: 'flex-start'
          }}>
            <Snowflake size={10} color="#E0F2FE" />
            <span style={{ color: '#E0F2FE', fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ice Express</span>
          </div>
          <h3 style={{ fontSize: '17px', fontWeight: 900, color: '#fff', margin: '0 0 6px 0', lineHeight: '1.25', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>Estupidamente Geladas</h3>
          <p style={{ color: '#E0F2FE', fontSize: '10.5px', fontWeight: 500, margin: 0, lineHeight: '1.4', opacity: 0.9 }}>Bebidas trincando no gelo entregues na sua porta em minutos!</p>
        </div>
        
        {/* Horizontal Icy Product Carousel showcasing EXACTLY one standard home card at a time with identical 104px width */}
        <div style={{ 
          width: '45%', 
          display: 'flex', 
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          zIndex: 2,
          overflow: 'visible'
        }}>
          {/* Exact same ProductCard component from home page, scaled to identical 104px width */}
          {iceProducts.length > 0 && (
            <div style={{ width: '104px', transition: 'all 0.5s ease', animation: 'fadeInScale 0.6s ease' }} key={currentIceIndex}>
              <ProductCard {...iceProducts[currentIceIndex]} />
            </div>
          )}
        </div>
      </div>

      {/* DRIVING WARNING (RESPONSIBLE CONSUMPTION) */}
      <div className="glass-panel" style={{ 
        margin: '0 0 20px', 
        background: 'rgba(14, 165, 233, 0.03)', 
        border: '1px solid rgba(14, 165, 233, 0.15)', 
        padding: '12px',
        borderRadius: '12px'
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <div style={{ background: 'rgba(14, 165, 233, 0.1)', padding: '6px', borderRadius: '8px', color: '#0EA5E9' }}>
            <AlertOctagon size={15} />
          </div>
          <div>
            <h4 style={{ color: '#0EA5E9', fontSize: '12px', fontWeight: 900, margin: '0 0 2px' }}>Consumo Responsável</h4>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', lineHeight: '1.4' }}>
              Se beber, não dirija. A venda de bebidas alcoólicas é proibida para menores de 18 anos. Beba com moderação.
            </p>
          </div>
        </div>
      </div>

      {/* QUICK STATS ROW */}
      <div style={{ display: 'flex', gap: '8px', margin: '0 0 24px' }}>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Snowflake size={14} color="#0EA5E9" />
          <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Entregue no Gelo</span>
        </div>
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '14px' }}>⚡</span>
          <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>Sem Taxa de Gelado</span>
        </div>
      </div>

      {/* REFRESHING DRINKS GRID */}
      <h3 style={{ margin: '0 0 12px 6px', color: '#fff', fontSize: '15px', fontWeight: 800 }}>Bebidas no Ponto</h3>
      <div className="products-grid">
        {bebidas.map(product => (
          <ProductCard key={product.id} {...product} />
        ))}
        {bebidas.length === 0 && (
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', gridColumn: '1 / -1', textAlign: 'center', padding: '24px' }}>Nenhuma bebida no catálogo.</span>
        )}
      </div>
    </main>
  );
};
