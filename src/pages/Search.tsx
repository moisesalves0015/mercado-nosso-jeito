import { useState, useEffect, useMemo } from 'react';
import { Search as SearchIcon, ArrowLeft, X, Flame, Wine, Cigarette, Smartphone, Apple, Sparkles, Cookie, SlidersHorizontal, LayoutGrid, Plus, Check } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { isProductPromotionCurrent, getEffectiveProductPrice } from '../utils/productPricing';
import { MercadoLogo } from './Login';
import { useCatalog } from '../hooks/useCatalog';
import { useCart } from '../hooks/useCart';
import { cleanImageUrl, handleImageError } from '../utils/imageUrl';

const card = {
  background: 'var(--card-gradient)',
  backdropFilter: 'blur(28px)',
  WebkitBackdropFilter: 'blur(28px)',
  border: '1px solid var(--border-gold)',
  borderRadius: '18px',
  boxShadow: 'var(--card-shadow)',
};

const CATEGORIES = [
  { id: '', label: 'Todas', icon: LayoutGrid, color: '#22c55e' },
  { id: 'Promoções', label: 'Promoções', icon: Flame, color: '#ec4899' },
  { id: 'Bebidas', label: 'Bebidas', icon: Wine, color: '#a78bfa' },
  { id: 'Alimentos', label: 'Alimentos', icon: Apple, color: '#f97316' },
  { id: 'Limpeza', label: 'Limpeza', icon: Sparkles, color: '#10b981' },
  { id: 'Padaria', label: 'Padaria', icon: Cookie, color: '#fbbf24' },
  { id: 'Tabacaria', label: 'Tabacaria', icon: Cigarette, color: '#6b7280' },
  { id: 'Eletrônicos', label: 'Eletrônicos', icon: Smartphone, color: '#60a5fa' },
];

export const Search = () => {
  const { products } = useCatalog();
  const { addToCart } = useCart();
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
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

  const [prevQueryParam, setPrevQueryParam] = useState(queryParam);
  const [prevCategoryParam, setPrevCategoryParam] = useState(categoryParam);

  if (queryParam !== prevQueryParam) {
    setPrevQueryParam(queryParam);
    setSearchQuery(queryParam);
  }

  if (categoryParam !== prevCategoryParam) {
    setPrevCategoryParam(categoryParam);
    setSelectedCategory(categoryParam);
  }

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    const newParams: Record<string, string> = {};
    if (val) newParams.q = val;
    if (selectedCategory) newParams.category = selectedCategory;
    setSearchParams(newParams);
  };

  const handleCategorySelect = (catId: string) => {
    if (catId === '') {
      // 'Todas' chip — clear the category filter
      setSelectedCategory('');
      const newParams: Record<string, string> = {};
      if (searchQuery) newParams.q = searchQuery;
      setSearchParams(newParams);
      return;
    }
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
    return products.filter((p) => {
      if (p.active === false) return false;
      const q = normalizeStr(searchQuery);
      const titleMatch = normalizeStr(p.title).includes(q);
      const descMatch = (p as { description?: string }).description
        ? normalizeStr((p as { description?: string }).description || '').includes(q)
        : false;
      const catMatch = normalizeStr(p.category).includes(q);
      const queryMatches = !searchQuery || titleMatch || descMatch || catMatch;

      let categoryMatches = true;
      if (selectedCategory) {
        const selCat = normalizeStr(selectedCategory);
        if (selCat === 'promocoes' || selCat === 'promoçoes' || selCat === 'promotions') {
          categoryMatches = isProductPromotionCurrent(p) || normalizeStr(p.category) === 'promocoes';
        } else {
          categoryMatches = normalizeStr(p.category) === selCat;
        }
      }

      return queryMatches && categoryMatches;
    });
  }, [products, searchQuery, selectedCategory]);

  const sideFeedProducts = useMemo(() => {
    const promoItems = products.filter(
      (p) => p.active !== false && (p.promoActive || isProductPromotionCurrent(p))
    );
    const otherItems = products.filter(
      (p) => p.active !== false && !promoItems.some((pi) => pi.id === p.id)
    );
    return [...promoItems, ...otherItems].slice(0, 6);
  }, [products]);

  return (
    <main className="app search-page" style={{ padding: 0, minHeight: '100vh' }}>
      {/* ── TOP BAR ── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        background: 'var(--bg-secondary)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-primary)',
      }}>
        <div className="safe-area-top-bg" style={{ background: 'var(--bg-secondary)' }} />
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

      {/* ── Page contents with standardized responsive constraint ── */}
      <div className="search-container-wrap">

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
                const isActive = cat.id === ''
                  ? !selectedCategory  // 'Todas' active when no category selected
                  : selectedCategory.toLowerCase() === cat.id.toLowerCase();
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

        {/* ── SEARCH MAIN LAYOUT: 3 Tight Columns + Slender Lateral Feed ── */}
        <div className="search-layout-row" style={{ paddingBottom: '88px' }}>
          {/* Main 3-column products grid tightly spaced */}
          <div className="search-main-col">
            <div className="search-products-grid">
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

          {/* Fino Feed Lateral Automático com Rolagem Lenta */}
          <aside className="search-side-feed" aria-label="Feed de Ofertas e Destaques">
            {/* Header Fixo do Feed */}
            <div className="search-side-feed-header">
              <Sparkles size={9} color="#D4AF37" />
              <span>Destaques</span>
            </div>

            {/* Viewport com Máscara e Trilha Dupla de Rolagem Contínua */}
            <div className="search-side-feed-viewport">
              <div className="search-side-feed-track">
                {/* Track Grupo 1 */}
                <div className="search-side-feed-group">
                  <div
                    className="search-side-promo promo-gold"
                    onClick={() => navigate('/cart')}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="promo-badge">⚡ VIP</span>
                    <div className="promo-title">Frete Grátis</div>
                    <div className="promo-sub">acima R$ 60</div>
                  </div>

                  {sideFeedProducts.slice(0, 3).map((p) => {
                    const justAdded = recentlyAddedId === `g1-${p.id}`;
                    const numericPrice = getEffectiveProductPrice(p);
                    return (
                      <div key={`g1-side-${p.id}`} className="search-side-miniproduct">
                        <div
                          className="miniproduct-link"
                          onClick={() => navigate(`/product/${encodeURIComponent(p.id)}`)}
                        >
                          <div className="miniproduct-img-wrap">
                            <img
                              src={cleanImageUrl(p.image)}
                              alt={p.title}
                              onError={handleImageError}
                              loading="lazy"
                            />
                            {p.promoActive && <span className="miniproduct-tag">OFF</span>}
                          </div>
                          <span className="miniproduct-title">{p.title}</span>
                          <span className="miniproduct-price">
                            R$ {numericPrice.toFixed(2).replace('.', ',')}
                          </span>
                        </div>

                        <button
                          type="button"
                          className={`miniproduct-add-btn ${justAdded ? 'is-added' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(
                              { id: p.id, title: p.title, price: numericPrice, image: p.image },
                              1
                            );
                            setRecentlyAddedId(`g1-${p.id}`);
                            window.setTimeout(
                              () => setRecentlyAddedId((cur) => (cur === `g1-${p.id}` ? null : cur)),
                              1200
                            );
                          }}
                          title={`Adicionar ${p.title}`}
                          aria-label={`Adicionar ${p.title} ao carrinho`}
                        >
                          {justAdded ? <Check size={10} /> : <Plus size={10} />}
                        </button>
                      </div>
                    );
                  })}

                  <div
                    className="search-side-promo promo-emerald"
                    onClick={() => navigate('/checkout')}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="promo-badge">🚀 PIX</span>
                    <div className="promo-title">Pague Pix</div>
                    <div className="promo-sub">100% seguro</div>
                  </div>

                  {sideFeedProducts.slice(3, 6).map((p) => {
                    const justAdded = recentlyAddedId === `g1-${p.id}`;
                    const numericPrice = getEffectiveProductPrice(p);
                    return (
                      <div key={`g1-side-${p.id}`} className="search-side-miniproduct">
                        <div
                          className="miniproduct-link"
                          onClick={() => navigate(`/product/${encodeURIComponent(p.id)}`)}
                        >
                          <div className="miniproduct-img-wrap">
                            <img
                              src={cleanImageUrl(p.image)}
                              alt={p.title}
                              onError={handleImageError}
                              loading="lazy"
                            />
                            {p.promoActive && <span className="miniproduct-tag">OFF</span>}
                          </div>
                          <span className="miniproduct-title">{p.title}</span>
                          <span className="miniproduct-price">
                            R$ {numericPrice.toFixed(2).replace('.', ',')}
                          </span>
                        </div>

                        <button
                          type="button"
                          className={`miniproduct-add-btn ${justAdded ? 'is-added' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(
                              { id: p.id, title: p.title, price: numericPrice, image: p.image },
                              1
                            );
                            setRecentlyAddedId(`g1-${p.id}`);
                            window.setTimeout(
                              () => setRecentlyAddedId((cur) => (cur === `g1-${p.id}` ? null : cur)),
                              1200
                            );
                          }}
                          title={`Adicionar ${p.title}`}
                          aria-label={`Adicionar ${p.title} ao carrinho`}
                        >
                          {justAdded ? <Check size={10} /> : <Plus size={10} />}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Track Grupo 2 (Loop Infinito) */}
                <div className="search-side-feed-group" aria-hidden="true">
                  <div
                    className="search-side-promo promo-gold"
                    onClick={() => navigate('/cart')}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="promo-badge">⚡ VIP</span>
                    <div className="promo-title">Frete Grátis</div>
                    <div className="promo-sub">acima R$ 60</div>
                  </div>

                  {sideFeedProducts.slice(0, 3).map((p) => {
                    const justAdded = recentlyAddedId === `g2-${p.id}`;
                    const numericPrice = getEffectiveProductPrice(p);
                    return (
                      <div key={`g2-side-${p.id}`} className="search-side-miniproduct">
                        <div
                          className="miniproduct-link"
                          onClick={() => navigate(`/product/${encodeURIComponent(p.id)}`)}
                        >
                          <div className="miniproduct-img-wrap">
                            <img
                              src={cleanImageUrl(p.image)}
                              alt={p.title}
                              onError={handleImageError}
                              loading="lazy"
                            />
                            {p.promoActive && <span className="miniproduct-tag">OFF</span>}
                          </div>
                          <span className="miniproduct-title">{p.title}</span>
                          <span className="miniproduct-price">
                            R$ {numericPrice.toFixed(2).replace('.', ',')}
                          </span>
                        </div>

                        <button
                          type="button"
                          className={`miniproduct-add-btn ${justAdded ? 'is-added' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(
                              { id: p.id, title: p.title, price: numericPrice, image: p.image },
                              1
                            );
                            setRecentlyAddedId(`g2-${p.id}`);
                            window.setTimeout(
                              () => setRecentlyAddedId((cur) => (cur === `g2-${p.id}` ? null : cur)),
                              1200
                            );
                          }}
                          title={`Adicionar ${p.title}`}
                          aria-label={`Adicionar ${p.title} ao carrinho`}
                        >
                          {justAdded ? <Check size={10} /> : <Plus size={10} />}
                        </button>
                      </div>
                    );
                  })}

                  <div
                    className="search-side-promo promo-emerald"
                    onClick={() => navigate('/checkout')}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="promo-badge">🚀 PIX</span>
                    <div className="promo-title">Pague Pix</div>
                    <div className="promo-sub">100% seguro</div>
                  </div>

                  {sideFeedProducts.slice(3, 6).map((p) => {
                    const justAdded = recentlyAddedId === `g2-${p.id}`;
                    const numericPrice = getEffectiveProductPrice(p);
                    return (
                      <div key={`g2-side-${p.id}`} className="search-side-miniproduct">
                        <div
                          className="miniproduct-link"
                          onClick={() => navigate(`/product/${encodeURIComponent(p.id)}`)}
                        >
                          <div className="miniproduct-img-wrap">
                            <img
                              src={cleanImageUrl(p.image)}
                              alt={p.title}
                              onError={handleImageError}
                              loading="lazy"
                            />
                            {p.promoActive && <span className="miniproduct-tag">OFF</span>}
                          </div>
                          <span className="miniproduct-title">{p.title}</span>
                          <span className="miniproduct-price">
                            R$ {numericPrice.toFixed(2).replace('.', ',')}
                          </span>
                        </div>

                        <button
                          type="button"
                          className={`miniproduct-add-btn ${justAdded ? 'is-added' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(
                              { id: p.id, title: p.title, price: numericPrice, image: p.image },
                              1
                            );
                            setRecentlyAddedId(`g2-${p.id}`);
                            window.setTimeout(
                              () => setRecentlyAddedId((cur) => (cur === `g2-${p.id}` ? null : cur)),
                              1200
                            );
                          }}
                          title={`Adicionar ${p.title}`}
                          aria-label={`Adicionar ${p.title} ao carrinho`}
                        >
                          {justAdded ? <Check size={10} /> : <Plus size={10} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>
        </div>

      </div>
    </main>
  );
};
