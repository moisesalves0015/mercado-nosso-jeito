import { Search as SearchIcon, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { MercadoLogo } from './Login';

export const Search = () => {
  return (
    <main className="app search-page">
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

      {/* ── Page title & Search ──────────────────────────── */}
      <div style={{ padding: '18px 16px 4px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: '0 0 12px 0', letterSpacing: '-0.3px' }}>Buscar Produtos</h1>
        <div className="search-bar" style={{ marginBottom: 0 }}>
          <SearchIcon size={18} color="#E7BC79" />
          <input type="text" placeholder="O que você está procurando?" autoFocus />
        </div>
      </div>

      <div className="glass-panel" style={{ marginTop: '20px' }}>
        <h3 style={{ color: '#E7BC79', marginBottom: '12px', fontSize: '14px' }}>Mais Buscados</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['Café em pó', 'Leite Integral', 'Pão de Forma', 'Manteiga', 'Refrigerante'].map(tag => (
            <span key={tag} style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '16px', fontSize: '12px', color: '#fff' }}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="glass-panel" style={{ marginTop: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 style={{ color: '#E7BC79', marginBottom: '12px', fontSize: '14px' }}>Especiais do Dia</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <Link to="/bebidas" style={{ flex: 1, textDecoration: 'none' }}>
            <div style={{ background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.25)', borderRadius: '12px', padding: '12px 8px', textAlign: 'center', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.1)' }}>
              <span style={{ color: '#0EA5E9', fontWeight: 900, fontSize: '12.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                🧊 Bebidas Geladas
              </span>
            </div>
          </Link>
          <Link to="/tabacaria" style={{ flex: 1, textDecoration: 'none' }}>
            <div style={{ background: 'rgba(212, 175, 55, 0.08)', border: '1px solid rgba(212, 175, 55, 0.25)', borderRadius: '12px', padding: '12px 8px', textAlign: 'center', boxShadow: '0 4px 12px rgba(212, 175, 55, 0.1)' }}>
              <span style={{ color: '#D4AF37', fontWeight: 900, fontSize: '12.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                🚬 Tabacaria Premium
              </span>
            </div>
          </Link>
        </div>
      </div>

      <h3 style={{ margin: '24px 0 12px 16px', color: '#fff', fontSize: '16px' }}>Recomendados para você</h3>
      <div className="products-grid">
        <ProductCard title="Café Melitta Vácuo (500g)" price="R$ 19,90" image="https://images.unsplash.com/photo-1559525839-b184a4d698c7?q=80&w=600" category="search" />
        <ProductCard title="Pão Pullman Forma Integral (500g)" price="R$ 12,90" image="/pao_de_forma.png" category="search" />
      </div>
    </main>
  );
};
