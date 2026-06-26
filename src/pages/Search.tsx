import { useState, useEffect, useMemo } from 'react';
import { Search as SearchIcon, ArrowLeft, X, Flame, Wine, Cigarette, Smartphone, Apple, Sparkles, Cookie, SlidersHorizontal } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { MercadoLogo } from './Login';
import { defaultProducts } from '../data/defaultProducts';

const card = {
  background: 'var(--card-gradient)',
  backdropFilter: 'blur(28px)',
  WebkitBackdropFilter: 'blur(28px)',
  border: '1px solid var(--border-gold)',
  borderRadius: '18px',
  boxShadow: 'var(--card-shadow)',
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
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  const hasFilters = !!searchQuery.trim() || !!selectedCategory;

  // React to theme changes
  useEffect(() => {
    const handleThemeChange = () => setTheme(localStorage.getItem('theme') || 'dark');
    window.addEventListener('theme-changed', handleThemeChange);
    return () => window.removeEventListener('theme-changed', handleThemeChange);
  }, []);

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
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'var(--bg-secondary)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-primary)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'var(--back-btn-bg)',
              border: '1px solid var(--border-primary)',
              borderRadius: '50%',
              width: '38px', height: '38px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-primary)', flexShrink: 0,
            }}
          >
            <ArrowLeft size={17} />
          </button>

          <MercadoLogo size="sm" />

          <button
            onClick={() => setShowFilters(v => !v)}
            style={{
              background: showFilters ? 'rgba(212,175,55,0.1)' : 'var(--input-bg)',
              border: `1px solid ${showFilters ? 'rgba(212,175,55,0.3)' : 'var(--input-border)'}`,
              borderRadius: 10, width: 38, height: 38,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: showFilters ? '#D4AF37' : 'var(--text-secondary)',
              flexShrink: 0,
              position: 'relative'
            }}
          >
            <SlidersHorizontal size={15} />
            {hasFilters && (
              <span style={{
                position: 'absolute', top: 8, right: 8,
                width: 7, height: 7, borderRadius: '50%',
                background: '#D4AF37', border: `1.5px solid var(--bg-secondary)`,
              }} />
            )}
          </button>
        </div>
      </div>

      {/* ── Page contents with standardized width constraint ── */}
      <div style={{ padding: '12px 16px 0', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        
        <div style={{ padding: '6px 0 0 2px' }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>Buscar Produtos</h1>
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
                style={{ width: '100%', paddingRight: '36px', fontSize: '14px', color: 'var(--text-primary)', outline: 'none' }}
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
                    color: 'var(--text-muted)',
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
                      border: `1px solid ${isActive ? cat.color : 'var(--border-primary)'}`,
                      background: isActive ? `${cat.color}18` : 'var(--input-bg)',
                      color: isActive ? (theme === 'light' ? cat.color : '#fff') : 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: isActive ? 900 : 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontFamily: 'Manrope, sans-serif',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                  >
                    <Icon size={12} color={isActive ? cat.color : 'var(--text-muted)'} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SEARCH RESULTS GRID HEADER ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 2px' }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '13px', fontWeight: 800 }}>
            {selectedCategory ? `${selectedCategory}` : 'Todos os Produtos'} 
            <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '11px', marginLeft: '6px' }}>
              ({filteredProducts.length} itens)
            </span>
          </h3>
          {(searchQuery || selectedCategory) && (
            <button 
              onClick={handleClearAll}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#D4AF37',
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', gridColumn: '1 / -1', padding: '40px 16px', color: 'var(--text-muted)', textAlign: 'center' }}>
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
