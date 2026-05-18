import { ArrowLeft, Snowflake, AlertOctagon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';

export const Bebidas = () => {
  return (
    <main className="app bebidas-page">
      {/* ICY REFRESHING HEADER */}
      <div className="topbar" style={{ justifyContent: 'flex-start', gap: '16px', borderBottom: '1px solid rgba(14, 165, 233, 0.2)', paddingBottom: '12px' }}>
        <Link to="/" className="circle-btn" style={{ background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.25)' }}>
          <ArrowLeft size={22} color="#0EA5E9" />
        </Link>
        <div>
          <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 900, margin: 0 }}>Bebidas Geladas</h2>
          <span style={{ color: '#0EA5E9', fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trincando no Gelo</span>
        </div>
      </div>

      {/* FROSTY AD BANNER */}
      <div className="promo-banner" style={{ 
        margin: '16px 4px', 
        background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)', 
        border: '1px solid rgba(14, 165, 233, 0.3)',
        boxShadow: '0 8px 30px rgba(14, 165, 233, 0.15)'
      }}>
        <div className="promo-text">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
            <Snowflake size={11} color="#E0F2FE" />
            <span style={{ color: '#E0F2FE', fontSize: '8px', fontWeight: 900, textTransform: 'uppercase' }}>Ice Express</span>
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#fff' }}>Estupidamente Geladas</h3>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '11px' }}>Chegam geladas na porta da sua casa em minutos!</p>
        </div>
        <span style={{ fontSize: '32px' }}>🧊</span>
      </div>

      {/* DRIVING WARNING (RESPONSIBLE CONSUMPTION) */}
      <div className="glass-panel" style={{ 
        margin: '0 4px 20px', 
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
      <div style={{ display: 'flex', gap: '8px', margin: '0 4px 24px' }}>
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
        <ProductCard 
          title="Cerveja Heineken Long Neck (330ml)" 
          price="R$ 7,90" 
          image="https://images.unsplash.com/photo-1608270586620-248524c67de9?q=80&w=600" 
          badge="Trincando" 
          badgeStyle="orange" 
          diamondReward={2} 
        />
        <ProductCard 
          title="Refrigerante Coca-Cola Sem Açúcar Lata (350ml)" 
          price="R$ 4,50" 
          image="https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=600" 
          diamondReward={1} 
        />
        <ProductCard 
          title="Energético Monster Energy Tradicional (473ml)" 
          price="R$ 9,90" 
          image="https://images.unsplash.com/photo-1622543956221-c6328ecf8443?q=80&w=600" 
          badge="Mais Vendido" 
          diamondReward={3} 
        />
        <ProductCard 
          title="Cerveja Spaten Puro Malte Lata (350ml)" 
          price="R$ 5,20" 
          image="https://images.unsplash.com/photo-1600788886242-5c96aabe3757?q=80&w=600" 
          diamondReward={1} 
        />
        <ProductCard 
          title="Suco de Laranja Integral Do Bem (1L)" 
          price="R$ 14,90" 
          image="/suco_do_bem_laranja_integral.png" 
          badge="100% Suco" 
          badgeStyle="light" 
          diamondReward={10} 
        />
        <ProductCard 
          title="Água Mineral Sem Gás Crystal (500ml)" 
          price="R$ 2,50" 
          image="https://images.unsplash.com/photo-1548839140-29a749e1cf4d?q=80&w=600" 
        />
      </div>
    </main>
  );
};
