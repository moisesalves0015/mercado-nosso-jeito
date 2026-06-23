import { useState, useEffect } from 'react';
import { Snowflake, AlertOctagon } from 'lucide-react';
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

export const Bebidas = () => {
  const [currentIceIndex, setCurrentIceIndex] = useState(0);
  const [bebidas, setBebidas] = useState<Product[]>([]);

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
        if (p.id === 'heineken-330ml' && p.image !== '/heineken.png') {
          p.image = '/heineken.png';
          updated = true;
        }
        if (p.id === 'coca-cola-350ml' && p.image !== '/coca_cola_zero.png') {
          p.image = '/coca_cola_zero.png';
          updated = true;
        }
        if (p.id === 'monster-energy' && p.image !== '/monster_energy.webp') {
          p.image = '/monster_energy.webp';
          updated = true;
        }
        if (p.id === 'spaten-350ml' && p.image !== '/spaten.webp') {
          p.image = '/spaten.webp';
          updated = true;
        }
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

      setBebidas(allProds.filter(p => p.category === 'Bebidas'));
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
    <main className="app bebidas-page" style={{ paddingTop: 0 }}>
      <Topbar />

      {/* ── Page title ──────────────────────────── */}
      <div style={{ padding: '18px 16px 4px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>Bebidas Geladas</h1>
        <p style={{ fontSize: 11, color: '#D4AF37', margin: '3px 0 0', fontWeight: 600 }}>TRINCANDO NO GELO</p>
      </div>

      {/* FROSTY AD BANNER */}
      <div className="promo-banner" style={{ 
        margin: '16px 0', 
        backgroundImage: 'linear-gradient(135deg, rgba(2, 132, 199, 0.2) 0%, rgba(3, 105, 161, 0.4) 100%), url(\'/banner_estupidamente_geladas.png\')', 
        backgroundSize: 'cover',
        backgroundPosition: 'center',
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
            <p style={{ color: 'var(--text-secondary)', fontSize: '10px', lineHeight: '1.4' }}>
              Se beber, não dirija. A venda de bebidas alcoólicas é proibida para menores de 18 anos. Beba com moderação.
            </p>
          </div>
        </div>
      </div>

      {/* QUICK STATS ROW */}
      <div style={{ display: 'flex', gap: '8px', margin: '0 0 24px' }}>
        <div style={{ flex: 1, background: 'var(--input-bg)', border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Snowflake size={14} color="#0EA5E9" />
          <span style={{ fontSize: '9.5px', color: 'var(--text-primary)', fontWeight: 600 }}>Entregue no Gelo</span>
        </div>
        <div style={{ flex: 1, background: 'var(--input-bg)', border: '1px solid var(--border-primary)', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '14px' }}>⚡</span>
          <span style={{ fontSize: '9.5px', color: 'var(--text-primary)', fontWeight: 600 }}>Sem Taxa de Gelado</span>
        </div>
      </div>

      {/* REFRESHING DRINKS GRID */}
      <h3 style={{ margin: '0 0 12px 6px', color: 'var(--text-primary)', fontSize: '15px', fontWeight: 800 }}>Bebidas no Ponto</h3>
      <div className="products-grid">
        {bebidas.slice(0, 6).map(product => (
          <ProductCard key={product.id} {...product} />
        ))}
        {bebidas.length === 0 && (
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', padding: '24px' }}>Nenhuma bebida no catálogo.</span>
        )}
      </div>

      {bebidas.length > 6 && (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0 40px' }}>
          <Link
            to="/search?category=Bebidas"
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
            Ver todos ({bebidas.length})
          </Link>
        </div>
      )}
    </main>
  );
};
