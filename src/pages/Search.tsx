import { Search as SearchIcon, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';

export const Search = () => {
  return (
    <main className="app search-page">
      <div className="topbar" style={{ justifyContent: 'flex-start', gap: '16px' }}>
        <Link to="/" className="circle-btn">
          <ArrowLeft size={24} color="#E7BC79" />
        </Link>
        <div className="search-bar" style={{ flex: 1, marginBottom: 0 }}>
          <SearchIcon size={18} color="#E7BC79" />
          <input type="text" placeholder="Buscar no mercado..." autoFocus />
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

      <h3 style={{ margin: '24px 0 12px 16px', color: '#fff', fontSize: '16px' }}>Recomendados para você</h3>
      <div className="products-grid">
        <ProductCard title="Café Melitta Vácuo (500g)" price="R$ 19,90" image="https://images.unsplash.com/photo-1559525839-b184a4d698c7?q=80&w=600" />
        <ProductCard title="Pão Pullman Forma Integral (500g)" price="R$ 12,90" image="https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=600" />
      </div>
    </main>
  );
};
