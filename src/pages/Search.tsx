import { useState, useEffect, useMemo } from 'react';
import { Search as SearchIcon, ArrowLeft, X, Flame, Wine, Cigarette, Smartphone, Apple, Sparkles, Cookie, SlidersHorizontal } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { MercadoLogo } from './Login';
import { defaultProducts } from '../data/defaultProducts';

const card = {
  background: 'rgba(9,7,5,0.58)',
  backdropFilter: 'blur(28px)',
  WebkitBackdropFilter: 'blur(28px)',
  border: '1px solid rgba(212,175,55,0.18)',
  borderRadius: '18px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
};

interface Product {
  id: string;
  title: string;
  price: number | string;
  image: string;
  category: string;
  description?: string;
  badge?: string;
  badgeStyle?: 'light' | 'orange';
  diamondReward?: number;
  promoActive?: boolean;
}

const CATEGORIES = [
  { id: 'Promoções', label: 'Promoções', icon: Flame, color: '#ec4899' },
  { id: 'Bebidas', label: 'Bebidas', icon: Wine, color: '#a78bfa' },
  { id: 'Alimentos', label: 'Alimentos', icon: Apple, color: '#f97316' },
  { id: 'Limpeza', label: 'Limpeza', icon: Sparkles, color: '#10b981' },
  { id: 'Padaria', label: 'Padaria', icon: Cookie, color: '#fbbf24' },
  { id: 'Tabacaria', label: 'Tabacaria', icon: Cigarette, color: '#6b7280' },
  { id: 'Eletrônicos', label: 'Eletrônicos', icon: Smartphone, color: '#60a5fa' },
];

export const Search = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';

  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [selectedCategory, setSelectedCategory] = useState(categoryParam);
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(true);

  const hasFilters = !!searchQuery.trim() || !!selectedCategory;

  // Sync state with URL parameter changes
  useEffect(() => {
    setSearchQuery(queryParam);
    setSelectedCategory(categoryParam);
  }, [queryParam, categoryParam]);

  // Load products from localStorage or fallback to defaults
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
            allProds.push(defP as any);
            updated = true;
          }
        });
      } else {
        allProds = defaultProducts as any[];
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

      setProducts(allProds);
    };

    loadProducts();
    window.addEventListener('app-products-updated', loadProducts);
    return () => window.removeEventListener('app-products-updated', loadProducts);
  }, []);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    const newParams: Record<string, string> = {};
    if (val) newParams.q = val;
    if (selectedCategory) newParams.category = selectedCategory;
    setSearchParams(newParams);
  };

  const handleCategorySelect = (catId: string) => {
    const nextCat = selectedCategory === catId ? '' : catId;
    setSelectedCategory(nextCat);
    const newParams: Record<string, string> = {};
    if (searchQuery) newParams.q = searchQuery;
    if (nextCat) newParams.category = nextCat;
    setSearchParams(newParams);
  };

  const handleClearAll = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSearchParams({});
  };

  const normalizeStr = (str: string) => 
    (str || "").toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const q = normalizeStr(searchQuery);
      const titleMatch = normalizeStr(p.title).includes(q);
      const descMatch = p.description ? normalizeStr(p.description).includes(q) : false;
      const catMatch = normalizeStr(p.category).includes(q);
      const queryMatches = !searchQuery || titleMatch || descMatch || catMatch;

      let categoryMatches = true;
      if (selectedCategory) {
        const selCat = normalizeStr(selectedCategory);
        if (selCat === 'promocoes' || selCat === 'promocoes' || selCat === 'promoçoes' || selCat === 'promotions') {
          categoryMatches = p.promoActive === true || normalizeStr(p.category) === 'promocoes';
        } else {
          categoryMatches = normalizeStr(p.category) === selCat;
        }
      }

      return queryMatches && categoryMatches;
    });
  }, [products, searchQuery, selectedCategory]);

  return (
    <main className="app search-page" style={{ padding: 0, minHeight: '100vh' }}>
      {/* ── TOP BAR ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'calc(21px + env(safe-area-inset-top, 0px)) 16px 12px',
        borderBottom: '1px solid rgba(212,175,55,0.1)',
        background: 'rgba(9,7,5,0.4)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '50%',
            width: '38px', height: '38px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'rgba(255,255,255,0.8)', flexShrink: 0,
          }}
        >
          <ArrowLeft size={17} />
        </button>

        <MercadoLogo size="sm" />

        <button
          onClick={() => setShowFilters(v => !v)}
          style={{
            background: showFilters ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${showFilters ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 10, width: 38, height: 38,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: showFilters ? '#D4AF37' : 'rgba(255,255,255,0.6)',
            flexShrink: 0,
            position: 'relative'
          }}
        >
          <SlidersHorizontal size={15} />
          {hasFilters && (
            <span style={{
              position: 'absolute', top: 8, right: 8,
              width: 7, height: 7, borderRadius: '50%',
              background: '#D4AF37', border: '1.5px solid #090705',
            }} />
          )}
        </button>
      </div>

      {/* ── Page contents with standardized width constraint ── */}
      <div style={{ padding: '12px 16px 0', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        
        <div style={{ padding: '6px 0 0 2px' }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.3px' }}>Buscar Produtos</h1>
        </div>

        {/* ── Toggleable Filters Card Panel ── */}
        {showFilters && (
          <div style={{ ...card, padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Search Input */}
            <div className="search-bar" style={{ marginBottom: 0, position: 'relative', height: '38px', borderRadius: '10px', padding: '8px 12px' }}>
              <SearchIcon size={16} color="#D4AF37" />
              <input 
                type="text" 
                placeholder="O que você está procurando?" 
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                style={{ width: '100%', paddingRight: '36px', fontSize: '14px', color: '#fff', outline: 'none' }}
              />
              {searchQuery && (
                <button 
                  onClick={() => handleSearchChange('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.35)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Category selection chips */}
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }} className="no-scrollbar">
              {CATEGORIES.map(cat => {
                const isActive = selectedCategory.toLowerCase() === cat.id.toLowerCase();
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 11px',
                      borderRadius: '999px',
                      border: `1px solid ${isActive ? cat.color : 'rgba(255,255,255,0.07)'}`,
                      background: isActive ? `${cat.color}25` : 'rgba(255,255,255,0.03)',
                      color: isActive ? '#fff' : 'rgba(255,255,255,0.7)',
                      fontSize: '11px',
                      fontWeight: isActive ? 900 : 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontFamily: 'Manrope, sans-serif',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    <Icon size={12} color={isActive ? cat.color : 'rgba(255,255,255,0.5)'} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SEARCH RESULTS GRID HEADER ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 2px' }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '13px', fontWeight: 800 }}>
            {selectedCategory ? `${selectedCategory}` : 'Todos os Produtos'} 
            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 500, fontSize: '11px', marginLeft: '6px' }}>
              ({filteredProducts.length} itens)
            </span>
          </h3>
          {(searchQuery || selectedCategory) && (
            <button 
              onClick={handleClearAll}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#E7BC79',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Limpar Filtros
            </button>
          )}
        </div>

        {/* Products Results Grid */}
        <div className="products-grid" style={{ paddingBottom: '80px' }}>
          {filteredProducts.map(product => (
            <ProductCard key={product.id} {...product} />
          ))}
          {filteredProducts.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', gridColumn: '1 / -1', padding: '40px 16px', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
              <span style={{ fontSize: '28px' }}>🔍</span>
              <span style={{ fontSize: '12px', fontWeight: 700 }}>Nenhum produto correspondente.</span>
              <span style={{ fontSize: '10px' }}>Tente ajustar os termos de busca ou mudar o filtro da categoria.</span>
            </div>
          )}
        </div>

      </div>
    </main>
  );
};
