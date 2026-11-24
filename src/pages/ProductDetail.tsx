import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Heart, Star, ChevronDown, CheckCircle, Shield, ShoppingCart, RefreshCw } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { useCart } from '../hooks/useCart';
import { getEffectiveProductPrice } from '../utils/productPricing';
import { cleanImageUrl, handleImageError } from '../utils/imageUrl';
import { useCatalog } from '../hooks/useCatalog';

interface ProductMock {
  id: string;
  title: string;
  price: string;
  priceNum: number;
  image: string;
  images?: string[];
  badge?: string;
  badgeStyle?: 'orange' | 'light';
  diamondReward?: number;
  rating: number;
  ratingCount: number;
  soldCount: string;
  stockStatus: string;
  deliveryTime: string;
  category: string;
  stock: number;
  description?: string;
  origin?: string;
  conservation?: string;
}

const unavailableProduct = (id = ''): ProductMock => ({
  id,
  title: 'Produto indisponível',
  price: 'R$ 0,00',
  priceNum: 0,
  image: '',
  images: [],
  rating: 0,
  ratingCount: 0,
  soldCount: '',
  stockStatus: 'Indisponível',
  deliveryTime: 'Consulte novamente em instantes',
  category: '',
  stock: 0,
  description: '',
  origin: '',
  conservation: '',
});

const productSlug = (title: string) => title.toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

export const ProductDetail = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const catalog = useCatalog();

  // Scroll to top on mount or product change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [productId]);

  const product: ProductMock = useMemo(() => {
    if (!productId) return unavailableProduct(productId);
    const found =
      catalog.byId.get(productId) ||
      catalog.products.find((p) => p.id === productId || productSlug(p.title) === productId);

    if (found) {
      const priceNum = getEffectiveProductPrice(found);
      const raw = found as unknown as Record<string, unknown>;
      return {
        ...found,
        priceNum,
        price: `R$ ${priceNum.toFixed(2).replace('.', ',')}`,
        images: Array.isArray(found.images) ? found.images : undefined,
        description: typeof raw.description === 'string' ? raw.description : undefined,
        origin: typeof raw.origin === 'string' ? raw.origin : undefined,
        conservation: typeof raw.conservation === 'string' ? raw.conservation : undefined,
        rating: Number(raw.rating) || 0,
        ratingCount: Number(raw.ratingCount) || 0,
        soldCount: typeof raw.soldCount === 'string' ? raw.soldCount : '',
        stockStatus: found.stock > 0 ? 'Em estoque' : 'Estoque indisponível',
        deliveryTime: typeof raw.deliveryTime === 'string' ? raw.deliveryTime : 'Consulte no checkout',
      };
    }
    return unavailableProduct(productId);
  }, [catalog.byId, catalog.products, productId]);

  const allProducts = catalog.products;

  // State for subscription selection, quantity, and favoriting
  const [quantity, setQuantity] = useState<number>(1);
  const [isFavorited, setIsFavorited] = useState<boolean>(false);
  const [selectedImageIdx, setSelectedImageIdx] = useState<number>(0);
  const { addToCart } = useCart();

  const galleryImages = useMemo(() => {
    const main = typeof product?.image === 'string' && product.image.trim() ? [product.image.trim()] : [];
    const extras = Array.isArray(product?.images)
      ? product.images.filter((u: unknown): u is string => typeof u === 'string' && Boolean(u.trim()))
      : [];
    const combined = Array.from(new Set([...main, ...extras]));
    return combined.length > 0 ? combined : [''];
  }, [product]);

  const activeImageUrl = galleryImages[selectedImageIdx] ?? galleryImages[0] ?? '';

  // Calculations
  const finalPrice = product.priceNum;

  // Filter suggested products from the same category or overall catalog dynamically
  const finalSuggested = useMemo(() => {
    const fromCat = allProducts.filter(p => p.id !== product.id && p.category === product.category);
    if (fromCat.length >= 2) return fromCat.slice(0, 4);
    return allProducts.filter(p => p.id !== product.id).slice(0, 4);
  }, [allProducts, product]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product.title,
        text: `Confira ${product.title} no Mercado do Nosso Jeito!`,
        url: window.location.href,
      }).catch(console.error);
    } else {
      alert('Link copiado para a área de transferência!');
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <main className="app product-detail-page">
      {/* TOP HEADER */}
      <header className="product-detail-header">
        <div className="safe-area-top-bg" style={{ background: 'var(--detail-header-bg)' }} />
        <div className="product-detail-header-content">
          <button onClick={() => navigate(-1)} className="header-icon-btn">
            <ArrowLeft size={20} color="currentColor" />
          </button>
          <div className="header-title">Detalhes do Produto</div>
          <div className="header-actions">
            <button onClick={handleShare} className="header-icon-btn">
              <Share2 size={18} color="currentColor" />
            </button>
            <button onClick={() => setIsFavorited(!isFavorited)} className="header-icon-btn">
              <Heart size={18} fill={isFavorited ? "#FF4F4F" : "none"} color={isFavorited ? "#FF4F4F" : "currentColor"} />
            </button>
          </div>
        </div>
      </header>

      {/* TOP HERO PRODUCT IMAGE WITH SEMI-TRANSPARENT BG-SUPERMERCADO BACKGROUND */}
      <div className="product-hero-container">
        <div className="product-hero-bg"></div>
        <div className="product-hero-overlay"></div>
        <div className="product-hero-image-wrapper">
          <img src={cleanImageUrl(activeImageUrl)} alt={product.title} onError={handleImageError} className="product-hero-image" />
        </div>
        {product.badge && (
          <div className="product-hero-badge">
            <span>{product.badge}</span>
          </div>
        )}
      </div>

      {galleryImages.length > 1 && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', padding: '10px 16px 2px', overflowX: 'auto' }}>
          {galleryImages.map((imgUrl, idx) => (
            <button
              key={`${idx}-${imgUrl.slice(0, 16)}`}
              type="button"
              onClick={() => setSelectedImageIdx(idx)}
              style={{
                width: 52,
                height: 52,
                borderRadius: 10,
                padding: 4,
                background: 'rgba(16, 29, 21, 0.92)',
                border: idx === selectedImageIdx ? '1.5px solid #D4AF37' : '1px solid rgba(212, 175, 55, 0.22)',
                boxShadow: idx === selectedImageIdx ? '0 0 10px rgba(212, 175, 55, 0.28)' : 'none',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <img
                src={cleanImageUrl(imgUrl)}
                alt={`${product.title} - foto ${idx + 1}`}
                onError={handleImageError}
                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 6 }}
              />
            </button>
          ))}
        </div>
      )}

      <div className="product-detail-content">
        {/* SOCIAL PROOF BLOCK */}
        <div className="social-proof-header">
          <div className="store-link">Visite a Loja Mercado do Nosso Jeito</div>

          {product.ratingCount > 0 && product.rating > 0 && <div className="rating-row">
            <div className="stars">
              <span className="rating-value">{product.rating}</span>
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={12}
                  fill={i < Math.floor(product.rating) ? "#D4AF37" : "none"}
                  color="#D4AF37"
                  style={{ marginLeft: 1 }}
                />
              ))}
            </div>
            <span className="rating-count">{product.ratingCount.toLocaleString('pt-BR')} avaliações</span>
          </div>}

          <h1 className="product-main-title">{product.title}</h1>

          {product.soldCount && <div className="recent-purchases-badge">🔥 {product.soldCount} vendidos recentemente</div>}
        </div>

        {/* PRICING BLOCK */}
        <div className="detail-price-section">
          <div className="price-row">
            <span className="main-price-red">
              R$ {finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

        </div>

        <div className="purchase-options-container">
          <div className="purchase-option-card active">
            <div className="option-left">
              <div className="option-header-row"><span className="option-title">Compra única</span></div>
              <div className="option-price-sub">R$ {product.priceNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / un</div>
              <div className="delivery-details-text">O preço final é confirmado no checkout; cupons disponíveis são aplicados conforme as regras cadastradas.</div>
            </div>
          </div>
        </div>

        {/* QUANTITY SELECTOR & SHIPPING INFO */}
        <div className="quantity-and-shipping-info">
          <div className="quantity-select-row">
            <span className="quantity-label">Quantidade:</span>
            <div className="custom-select-wrapper qty-wrapper">
              <select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 10].map((num) => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </select>
              <ChevronDown size={14} className="select-arrow" />
            </div>
          </div>

          <div className="shipping-info-badges">
            <div className="info-badge-item">
              <CheckCircle size={14} color="#D4AF37" />
              <span className="info-text">Receba: <strong style={{ color: 'var(--text-primary)' }}>{product.deliveryTime}</strong></span>
            </div>
            <div className="info-badge-item">
              <CheckCircle size={14} color={product.stock === 0 ? "#FF6B6B" : "#34C759"} />
              <span className="info-text" style={{ color: product.stock === 0 ? '#FF6B6B' : '#34C759' }}>
                {product.stock === 0 ? 'Esgotado' : product.stockStatus}
              </span>
            </div>
          </div>
        </div>

        {/* EXPLICATIVE DETAILED SPECIFICATIONS BLOCK */}
        <div className="product-specifications-card">
          <h3>Descrição do Produto</h3>
          <p className="spec-description">{product.description || 'Descrição detalhada não cadastrada.'}</p>
          <div className="spec-grid">
            <div className="spec-item">
              <span className="spec-label">Categoria:</span>
              <span className="spec-value">{product.category}</span>
            </div>
            {product.origin && <div className="spec-item">
              <span className="spec-label">Origem:</span>
              <span className="spec-value">{product.origin}</span>
            </div>}
            {product.conservation && <div className="spec-item">
              <span className="spec-label">Conservação:</span>
              <span className="spec-value">{product.conservation}</span>
            </div>}
          </div>
        </div>

        {/* OBVIOUS HIGH-CONTRAST CONVERSION CALL-TO-ACTION (CTA) BUTTON */}
        <div className="cta-container">
          <button
            className="main-gold-cta"
            disabled={!Number.isInteger(product.stock) || product.stock <= 0}
            style={{ opacity: !Number.isInteger(product.stock) || product.stock <= 0 ? 0.6 : 1, cursor: !Number.isInteger(product.stock) || product.stock <= 0 ? 'not-allowed' : 'pointer' }}
            onClick={(e) => {
              if (!Number.isInteger(product.stock) || product.stock <= 0) return;
              // Trigger visual flying item thumbnail
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const startX = rect.left + rect.width / 2;
              const startY = rect.top + rect.height / 2;

              const flyer = document.createElement('div');
              flyer.style.position = 'fixed';
              flyer.style.left = `${startX}px`;
              flyer.style.top = `${startY}px`;
              flyer.style.width = '36px';
              flyer.style.height = '36px';
              flyer.style.borderRadius = '50%';
              flyer.style.background = '#fff';
              flyer.style.border = '1.5px solid #FFDF73';
              flyer.style.boxShadow = '0 0 10px rgba(212,175,55,0.7)';
              flyer.style.backgroundImage = `url(${product.image})`;
              flyer.style.backgroundSize = 'contain';
              flyer.style.backgroundPosition = 'center';
              flyer.style.backgroundRepeat = 'no-repeat';
              flyer.style.zIndex = '99999';
              flyer.style.pointerEvents = 'none';
              flyer.style.transition = 'all 0.9s cubic-bezier(0.25, 1, 0.5, 1)';

              document.body.appendChild(flyer);

              const wasEmpty = !document.querySelector('.floating-mini-cart');
              addToCart({ id: product.id, title: product.title, price: finalPrice, image: product.image }, quantity);

              if (wasEmpty) {
                flyer.style.transform = 'scale(1.15)';
                flyer.style.boxShadow = '0 0 25px rgba(212,175,55,0.9)';
              }

              setTimeout(() => {
                let targetX = window.innerWidth / 2;
                let targetY = window.innerHeight - 56;

                const cartIcon = document.querySelector('.floating-mini-cart .lucide-shopping-bag') || document.querySelector('a[href="/orders"] .nav-icon');
                if (cartIcon) {
                  const cartRect = cartIcon.getBoundingClientRect();
                  targetX = cartRect.left + cartRect.width / 2;
                  targetY = cartRect.top + cartRect.height / 2;
                }

                flyer.style.left = `${targetX - 18}px`;
                flyer.style.top = `${targetY - 18}px`;
                flyer.style.transform = 'scale(0.35) rotate(360deg)';
                flyer.style.opacity = '0.9';

                setTimeout(() => {
                  flyer.remove();
                }, 900);
              }, wasEmpty ? 650 : 50);
            }}
          >
            {product.stock === 0 ? (
              <>
                <Shield size={18} style={{ marginRight: 8 }} />
                Produto Esgotado
              </>
            ) : (
              <>
                <ShoppingCart size={18} style={{ marginRight: 8 }} />
                Adicionar ao Carrinho
              </>
            )}
          </button>

          <div className="cta-assurance-sub">🔒 Compra protegida; frete e total confirmados no checkout.</div>
        </div>

        {/* GUARANTEE INFO */}
        <div className="security-badges-row">
          <div className="security-item">
            <Shield size={16} color="#D4AF37" />
            <span>Transação 100% Protegida</span>
          </div>
          <div className="security-item">
            <RefreshCw size={16} color="#D4AF37" />
            <span>Garantia de Devolução Fácil</span>
          </div>
        </div>

        {/* RELATED SUGGESTED PRODUCTS CAROUSEL */}
        <div className="detail-suggested-section">
          <div className="suggested-header">
            <h3>Quem comprou também levou</h3>
          </div>
          <div className="products suggested-carousel">
            {finalSuggested.map((prod, index) => (
              <ProductCard
                key={index}
                title={prod.title}
                price={prod.price}
                image={prod.image}
                category="detail-suggested"
                id={prod.id}
                promoActive={prod.promoActive}
                promoPrice={prod.promoPrice}
                promoExpiry={prod.promoExpiry}
              />
            ))}
          </div>
        </div>

      </div>
    </main>
  );
};
