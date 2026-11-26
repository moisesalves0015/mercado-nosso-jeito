import { useState, useEffect, useMemo, useRef } from 'react';
import { Search as SearchIcon, ArrowLeft, X, Flame, Wine, Cigarette, Smartphone, Apple, Sparkles, Cookie, SlidersHorizontal, LayoutGrid, Plus, Check, ArrowUpDown, Tag, PackageCheck } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ProductCard } from '../components/ProductCard';
import { isProductPromotionCurrent, getEffectiveProductPrice } from '../utils/productPricing';
import { MercadoLogo } from './Login';
import { useCatalog } from '../hooks/useCatalog';
import { useCart } from '../hooks/useCart';
import { cleanImageUrl, handleImageError } from '../utils/imageUrl';

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
  const { addToCart, totalItems } = useCart();
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';

  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [selectedCategory, setSelectedCategory] = useState(categoryParam);
  const [sortBy, setSortBy] = useState<'relevance' | 'price_asc' | 'price_desc' | 'alpha'>('relevance');
  const [onlyPromo, setOnlyPromo] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [maxPrice, setMaxPrice] = useState<'all' | '20' | '50'>('all');
  const [visibleCount, setVisibleCount] = useState(15);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  const hasFilters = !!searchQuery.trim() || !!selectedCategory || onlyPromo || onlyInStock || maxPrice !== 'all' || sortBy !== 'relevance';

  const activeFilterTags = useMemo(() => {
    const tags: string[] = [];
    if (selectedCategory) tags.push(selectedCategory);
    if (onlyPromo) tags.push('Ofertas');
    if (onlyInStock) tags.push('Em estoque');
    if (maxPrice !== 'all') tags.push(`Até R$${maxPrice}`);
    if (sortBy === 'price_asc') tags.push('Menor R$');
    if (sortBy === 'price_desc') tags.push('Maior R$');
    if (sortBy === 'alpha') tags.push('A-Z');
    return tags;
  }, [selectedCategory, onlyPromo, onlyInStock, maxPrice, sortBy]);

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
    setVisibleCount(15);
    const newParams: Record<string, string> = {};
    if (val) newParams.q = val;
    if (selectedCategory) newParams.category = selectedCategory;
    setSearchParams(newParams);
  };

  const handleCategorySelect = (catId: string) => {
    setVisibleCount(15);
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
    setSortBy('relevance');
    setOnlyPromo(false);
    setOnlyInStock(false);
    setMaxPrice('all');
    setVisibleCount(15);
    setSearchParams({});
  };

  const normalizeStr = (str: string) =>
    (str || "").toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const filteredProducts = useMemo(() => {
    const base = products.filter((p) => {
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

      const promoMatches = !onlyPromo || isProductPromotionCurrent(p) || p.promoActive;
      const stockMatches = !onlyInStock || p.stock > 0;
      const effectivePrice = getEffectiveProductPrice(p);
      const priceMatches = maxPrice === 'all' || effectivePrice <= Number(maxPrice);

      return queryMatches && categoryMatches && promoMatches && stockMatches && priceMatches;
    });

    if (sortBy === 'price_asc') {
      return [...base].sort((a, b) => getEffectiveProductPrice(a) - getEffectiveProductPrice(b));
    }
    if (sortBy === 'price_desc') {
      return [...base].sort((a, b) => getEffectiveProductPrice(b) - getEffectiveProductPrice(a));
    }
    if (sortBy === 'alpha') {
      return [...base].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    }
    return base;
  }, [products, searchQuery, selectedCategory, onlyPromo, onlyInStock, maxPrice, sortBy]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + 15, filteredProducts.length));
        }
      },
      { rootMargin: '220px 0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredProducts.length]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  );
  const hasMoreProducts = visibleCount < filteredProducts.length;

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
    <main className="app search-page" style={{ padding: 0, minHeight: '100vh', paddingBottom: '95px' }}>
      {/* ── TOP BAR FLUTUANTE GLASS COM FILTROS INTEGRADOS ── */}
      <div className="floating-topbar-wrapper">
        <div className="floating-topbar-inner floating-topbar-inner--expandable">
          <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 40,
          }}>
            <button
              onClick={() => navigate(-1)}
              className="btn-icon-round"
              title="Voltar"
              aria-label="Voltar"
            >
              <ArrowLeft size={17} />
            </button>

            <MercadoLogo size="sm" />

            <button
              onClick={() => setShowFilters(v => !v)}
              className={`btn-icon-round search-filter-trigger ${showFilters ? 'is-active' : ''} ${hasFilters ? 'has-active-filters' : ''}`}
              style={{
                position: 'relative',
                ...(hasFilters
                  ? {
                    borderColor: 'rgba(240, 213, 123, 0.78)',
                    background: 'linear-gradient(135deg, rgba(240, 213, 123, 0.24), rgba(201, 162, 54, 0.14))',
                    color: '#F4DC8B',
                  }
                  : {}),
              }}
              title="Filtros e Busca"
              aria-label="Filtros e Busca"
              aria-expanded={showFilters}
            >
              <SlidersHorizontal size={15} />
              {hasFilters && (
                <span style={{
                  position: 'absolute', top: 6, right: 6,
                  width: 7, height: 7, borderRadius: '50%',
                  background: '#F4DC8B',
                  border: '1.5px solid #0a1510',
                  boxShadow: '0 0 8px rgba(240, 213, 123, 0.95)'
                }} />
              )}
            </button>
          </div>

          {/* Resumo compacto dentro do menu quando recolhido com filtro ativo */}
          {!showFilters && hasFilters && (
            <div className="search-topbar-active-bar">
              <button
                type="button"
                className="search-topbar-active-pill"
                onClick={() => setShowFilters(true)}
              >
                <SlidersHorizontal size={11} />
                <span>{activeFilterTags.join(' · ')}</span>
              </button>
              <button
                type="button"
                className="search-topbar-clear-btn"
                onClick={handleClearAll}
                aria-label="Limpar filtros ativos"
              >
                <X size={12} />
                <span>Limpar</span>
              </button>
            </div>
          )}

          {/* Filtros expandidos englobados dentro do menu */}
          {showFilters && (
            <div className="search-topbar-filters-body">
              <div className="search-bar" style={{ marginBottom: 0, position: 'relative', height: '38px', borderRadius: '14px', padding: '6px 12px' }}>
                <SearchIcon size={15} color="#E8C96A" />
                <input
                  type="text"
                  placeholder="O que você está procurando?"
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  style={{ width: '100%', paddingRight: '34px', fontSize: '14px', color: 'var(--text-primary)', outline: 'none' }}
                />
                {searchQuery && (
                  <button
                    onClick={() => handleSearchChange('')}
                    style={{
                      position: 'absolute',
                      right: '8px',
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
                    aria-label="Limpar texto"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }} className="no-scrollbar">
                {CATEGORIES.map(cat => {
                  const isActive = cat.id === ''
                    ? !selectedCategory
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
                        padding: '6px 11px',
                        borderRadius: '12px',
                        border: `1px solid ${isActive ? cat.color : 'var(--border-primary)'}`,
                        background: isActive ? `${cat.color}22` : 'rgba(255, 255, 255, 0.04)',
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

              {/* Filtros adicionais: Ordenação, Ofertas, Em Estoque, Faixa de Preço */}
              <div className="search-topbar-extra-filters no-scrollbar">
                <button
                  type="button"
                  onClick={() => {
                    const order: Array<typeof sortBy> = ['relevance', 'price_asc', 'price_desc', 'alpha'];
                    setSortBy(order[(order.indexOf(sortBy) + 1) % order.length]);
                    setVisibleCount(15);
                  }}
                  className={`search-extra-chip ${sortBy !== 'relevance' ? 'is-active' : ''}`}
                >
                  <ArrowUpDown size={11} />
                  <span>
                    {sortBy === 'relevance'
                      ? 'Ordenar'
                      : sortBy === 'price_asc'
                        ? 'Menor preço'
                        : sortBy === 'price_desc'
                          ? 'Maior preço'
                          : 'A-Z'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setOnlyPromo((v) => !v); setVisibleCount(15); }}
                  className={`search-extra-chip ${onlyPromo ? 'is-active' : ''}`}
                >
                  <Tag size={11} />
                  <span>Em oferta</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setOnlyInStock((v) => !v); setVisibleCount(15); }}
                  className={`search-extra-chip ${onlyInStock ? 'is-active' : ''}`}
                >
                  <PackageCheck size={11} />
                  <span>Em estoque</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next: Record<typeof maxPrice, typeof maxPrice> = { all: '20', '20': '50', '50': 'all' };
                    setMaxPrice(next[maxPrice]);
                    setVisibleCount(15);
                  }}
                  className={`search-extra-chip ${maxPrice !== 'all' ? 'is-active' : ''}`}
                >
                  <span>{maxPrice === 'all' ? 'Qualquer preço' : `Até R$ ${maxPrice}`}</span>
                </button>

                {hasFilters && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="search-topbar-clear-btn"
                    style={{ marginLeft: 'auto' }}
                  >
                    <X size={11} />
                    <span>Limpar</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Page contents with standardized responsive constraint ── */}
      <div className="search-container-wrap">

        {/* ── SEARCH MAIN LAYOUT: 3 Tight Columns + Slender Lateral Feed ── */}
        <div className="search-layout-row" style={{ paddingBottom: totalItems > 0 ? '148px' : '88px' }}>
          {/* Main 3-column products grid tightly spaced */}
          <div className="search-main-col">
            <div className="page-title-block page-title-block--flush">
              <h1 className="commerce-title">Buscar Produtos</h1>
              <p className="commerce-subtitle commerce-subtitle--gold">
                EXPLORE TODO O CATÁLOGO DO MERCADO
              </p>
            </div>
            <div className="search-products-grid">
              {visibleProducts.map(product => (
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
            {hasMoreProducts && (
              <div ref={loadMoreRef} style={{ height: 32, width: '100%' }} aria-hidden="true" />
            )}
          </div>

          {/* Fino Feed Lateral Automático com Rolagem Lenta */}
          <aside
            className={`search-side-feed ${showFilters ? 'search-side-feed--filters-open' : ''} ${totalItems > 0 ? 'search-side-feed--with-cart' : ''}`}
            aria-label="Feed de Ofertas e Destaques"
          >
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
