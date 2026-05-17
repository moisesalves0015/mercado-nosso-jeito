import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Heart, Star, ChevronDown, CheckCircle, Shield, ShoppingCart, RefreshCw } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';

interface ProductMock {
  id: string;
  title: string;
  price: string;
  priceNum: number;
  image: string;
  badge?: string;
  rating: number;
  ratingCount: number;
  soldCount: string;
  stockStatus: string;
  deliveryTime: string;
  category: string;
}

const PRODUCTS_MOCK: Record<string, ProductMock> = {
  'pao-de-queijo-tradicional-1kg': {
    id: 'pao-de-queijo-tradicional-1kg',
    title: 'Pão de Queijo Tradicional (1kg)',
    price: 'R$ 32,90',
    priceNum: 32.90,
    image: '/paodequeijo-novo.webp',
    badge: 'Mais Vendido',
    rating: 4.8,
    ratingCount: 1420,
    soldCount: '4K+',
    stockStatus: 'Em estoque',
    deliveryTime: 'Receba hoje até as 18h',
    category: 'Café da Manhã'
  },
  'iogurte-grego-danone-4x': {
    id: 'iogurte-grego-danone-4x',
    title: 'Iogurte Grego Danone (4x)',
    price: 'R$ 18,90',
    priceNum: 18.90,
    image: '/iogurte-novo.webp',
    badge: 'Recomendado',
    rating: 4.7,
    ratingCount: 980,
    soldCount: '2.5K+',
    stockStatus: 'Em estoque',
    deliveryTime: 'Receba hoje até as 18h',
    category: 'Café da Manhã'
  },
  'granola-mel-barano-500g': {
    id: 'granola-mel-barano-500g',
    title: 'Granola Mel Barano (500g)',
    price: 'R$ 24,90',
    priceNum: 24.90,
    image: '/granola-novo.png',
    badge: 'Premium',
    rating: 4.9,
    ratingCount: 650,
    soldCount: '1.2K+',
    stockStatus: 'Em estoque',
    deliveryTime: 'Receba amanhã até as 12h',
    category: 'Café da Manhã'
  },
  'ovo-branco-medio-12un': {
    id: 'ovo-branco-medio-12un',
    title: 'Ovo Branco Médio (12un)',
    price: 'R$ 15,90',
    priceNum: 15.90,
    image: '/ovos-novo.png',
    badge: 'Essencial',
    rating: 4.6,
    ratingCount: 2150,
    soldCount: '5K+',
    stockStatus: 'Em estoque',
    deliveryTime: 'Receba hoje até as 18h',
    category: 'Café da Manhã'
  },
  'cafe-melitta-tradicional-500g': {
    id: 'cafe-melitta-tradicional-500g',
    title: 'Café Melitta Tradicional (500g)',
    price: 'R$ 19,90',
    priceNum: 19.90,
    image: '/cafe-novo.png',
    badge: 'Melhor Preço',
    rating: 4.8,
    ratingCount: 8675,
    soldCount: '10K+',
    stockStatus: 'Em estoque',
    deliveryTime: 'Receba hoje até as 18h',
    category: 'Café da Manhã'
  },
  'suco-de-laranja-integral-do-bem-1l': {
    id: 'suco-de-laranja-integral-do-bem-1l',
    title: 'Suco de Laranja Integral Do Bem (1L)',
    price: 'R$ 14,90',
    priceNum: 14.90,
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=600',
    badge: 'Promocional',
    rating: 4.5,
    ratingCount: 320,
    soldCount: '800+',
    stockStatus: 'Em estoque',
    deliveryTime: 'Receba hoje até as 18h',
    category: 'Bebidas'
  },
  'cafe-torrado-e-moido-pilao-500g': {
    id: 'cafe-torrado-e-moido-pilao-500g',
    title: 'Café Torrado e Moído Pilão (500g)',
    price: 'R$ 17,90',
    priceNum: 17.90,
    image: 'https://images.unsplash.com/photo-1587049352847-4d4b1f6db9c6?q=80&w=600',
    badge: 'Melhor Preço',
    rating: 4.6,
    ratingCount: 1850,
    soldCount: '4K+',
    stockStatus: 'Em estoque',
    deliveryTime: 'Receba hoje até as 18h',
    category: 'Bebidas'
  }
};

const SUGGESTED_PRODUCTS = [
  { title: 'Granola Mel Barano (500g)', price: 'R$ 24,90', image: '/granola-novo.png' },
  { title: 'Ovo Branco Médio (12un)', price: 'R$ 15,90', image: '/ovos-novo.png' },
  { title: 'Iogurte Grego Danone (4x)', price: 'R$ 18,90', image: '/iogurte-novo.webp' },
];

export const ProductDetail = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();

  // Scroll to top on mount or product change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [productId]);

  // Lookup product, fallback to Cafe Melitta if not found
  const product = (productId && PRODUCTS_MOCK[productId]) || PRODUCTS_MOCK['cafe-melitta-tradicional-500g'];

  // State for subscription selection, quantity, and favoriting
  const [purchaseMode, setPurchaseMode] = useState<'subscribe' | 'onetime'>('subscribe');
  const [quantity, setQuantity] = useState<number>(1);
  const [frequency, setFrequency] = useState<string>('30');
  const [isFavorited, setIsFavorited] = useState<boolean>(false);
  const [couponApplied, setCouponApplied] = useState<boolean>(false);

  // Calculations
  const discountMultiplier = purchaseMode === 'subscribe' ? 0.9 : 1.0;
  const couponMultiplier = couponApplied ? 0.8 : 1.0; // Extra 20% off
  const finalPrice = product.priceNum * discountMultiplier * couponMultiplier;

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
        <button onClick={() => navigate(-1)} className="header-icon-btn">
          <ArrowLeft size={20} color="#fff" />
        </button>
        <div className="header-title">Detalhes do Produto</div>
        <div className="header-actions">
          <button onClick={handleShare} className="header-icon-btn">
            <Share2 size={18} color="#fff" />
          </button>
          <button onClick={() => setIsFavorited(!isFavorited)} className="header-icon-btn">
            <Heart size={18} fill={isFavorited ? "#FF4F4F" : "none"} color={isFavorited ? "#FF4F4F" : "#fff"} />
          </button>
        </div>
      </header>

      {/* TOP HERO PRODUCT IMAGE WITH SEMI-TRANSPARENT BG-SUPERMERCADO BACKGROUND */}
      <div className="product-hero-container">
        <div className="product-hero-bg"></div>
        <div className="product-hero-overlay"></div>
        <div className="product-hero-image-wrapper">
          <img src={product.image} alt={product.title} className="product-hero-image" />
        </div>
        {product.badge && (
          <div className="product-hero-badge">
            <span>{product.badge}</span>
          </div>
        )}
      </div>

      <div className="product-detail-content">
        {/* SOCIAL PROOF BLOCK */}
        <div className="social-proof-header">
          <div className="store-link">Visite a Loja Mercado do Nosso Jeito</div>
          
          <div className="rating-row">
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
          </div>

          <div className="amazon-choice-row">
            <div className="choice-badge">Destaque do Mercado</div>
            <span className="choice-text">para "{product.category.toLowerCase()}"</span>
          </div>

          <h1 className="product-main-title">{product.title}</h1>

          <div className="recent-purchases-badge">
            🔥 Mais de {product.soldCount} comprados no último mês
          </div>
        </div>

        {/* PRICING BLOCK */}
        <div className="detail-price-section">
          <div className="price-row">
            <span className="main-price-red">
              R$ {finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {purchaseMode === 'subscribe' && (
              <span className="strike-price">
                R$ {product.priceNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>
          
          {/* HIGH-CONVERSION COUPON NOTICE */}
          <div className="coupon-card">
            <div className="coupon-label">Cupom Assinatura:</div>
            <label className="coupon-checkbox-container">
              <input 
                type="checkbox" 
                checked={couponApplied} 
                onChange={() => setCouponApplied(!couponApplied)}
              />
              <span className="checkmark"></span>
              <span className="coupon-text">
                Aplicar <strong>20% de desconto extra</strong> na sua primeira entrega do clube. <span className="shop-items">Termos</span>
              </span>
            </label>
          </div>
        </div>

        {/* SUBSCRIBE & SAVE CONFIGURATION BOX (CLUBE DO NOSSO JEITO) */}
        <div className="purchase-options-container">
          
          {/* OPTION 1: SUBSCRIBE & SAVE (DEFAULT) */}
          <div 
            className={`purchase-option-card ${purchaseMode === 'subscribe' ? 'active' : ''}`}
            onClick={() => setPurchaseMode('subscribe')}
          >
            <div className="option-left">
              <div className="option-header-row">
                <span className="option-title">Assinar e Economizar</span>
                <span className="savings-badge">Economize 10%</span>
              </div>
              <div className="option-price-sub">
                R$ {(product.priceNum * 0.9 * (couponApplied ? 0.8 : 1.0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / un
              </div>
              <div className="delivery-details-text">
                Sem taxas de adesão. Cancele online a qualquer momento.
              </div>
              
              {purchaseMode === 'subscribe' && (
                <div className="subscription-settings" onClick={(e) => e.stopPropagation()}>
                  <div className="select-setting">
                    <span className="setting-label">Entregar a cada:</span>
                    <div className="custom-select-wrapper">
                      <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                        <option value="15">15 dias</option>
                        <option value="30">30 dias (Mais comum)</option>
                        <option value="60">60 dias</option>
                      </select>
                      <ChevronDown size={14} className="select-arrow" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RADIO SELECT ON THE RIGHT FOR RIGHT-HANDED ACCESSIBILITY */}
            <div className="option-right-radio">
              <div className={`radio-outer ${purchaseMode === 'subscribe' ? 'checked' : ''}`}>
                <div className="radio-inner"></div>
              </div>
            </div>
          </div>

          {/* OPTION 2: ONE-TIME PURCHASE */}
          <div 
            className={`purchase-option-card ${purchaseMode === 'onetime' ? 'active' : ''}`}
            onClick={() => setPurchaseMode('onetime')}
          >
            <div className="option-left">
              <div className="option-header-row">
                <span className="option-title">Compra Única</span>
              </div>
              <div className="option-price-sub">
                R$ {(product.priceNum * (couponApplied ? 0.8 : 1.0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / un
              </div>
              <div className="delivery-details-text">
                Preço normal sem recorrência.
              </div>
            </div>

            {/* RADIO SELECT ON THE RIGHT FOR RIGHT-HANDED ACCESSIBILITY */}
            <div className="option-right-radio">
              <div className={`radio-outer ${purchaseMode === 'onetime' ? 'checked' : ''}`}>
                <div className="radio-inner"></div>
              </div>
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
              <span className="info-text">Receba: <strong style={{color: '#fff'}}>{product.deliveryTime}</strong></span>
            </div>
            <div className="info-badge-item">
              <CheckCircle size={14} color="#34C759" />
              <span className="info-text" style={{color: '#34C759'}}>{product.stockStatus}</span>
            </div>
          </div>
        </div>

        {/* OBVIOUS HIGH-CONTRAST CONVERSION CALL-TO-ACTION (CTA) BUTTON */}
        <div className="cta-container">
          <button 
            className="main-gold-cta"
            onClick={() => {
              alert(purchaseMode === 'subscribe' 
                ? `Assinatura de ${quantity}x ${product.title} a cada ${frequency} dias configurada!` 
                : `${quantity}x ${product.title} adicionado ao carrinho!`
              );
            }}
          >
            {purchaseMode === 'subscribe' ? (
              <>
                <RefreshCw size={18} style={{marginRight: 8, animation: 'spin 4s linear infinite'}} />
                Configurar Clube do Nosso Jeito
              </>
            ) : (
              <>
                <ShoppingCart size={18} style={{marginRight: 8}} />
                Adicionar ao Carrinho
              </>
            )}
          </button>
          
          <div className="cta-assurance-sub">
            {purchaseMode === 'subscribe' ? (
              "🔒 Cancelamento grátis e frete incluso nas entregas recorrentes"
            ) : (
              "🔒 Compra protegida por Mercado Seguro com garantia de devolução"
            )}
          </div>
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
            {SUGGESTED_PRODUCTS.map((prod, index) => (
              <ProductCard 
                key={index}
                title={prod.title}
                price={prod.price}
                image={prod.image}
              />
            ))}
          </div>
        </div>

      </div>
    </main>
  );
};
