import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Heart, Star, ChevronDown, CheckCircle, Shield, ShoppingCart, RefreshCw } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { useCart } from '../hooks/useCart';

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
    image: '/suco_do_bem_laranja_integral.png',
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
    image: '/Café-Pilão-Torrado-E-Moído-Tradicional-Almofada-500g.png',
    badge: 'Melhor Preço',
    rating: 4.6,
    ratingCount: 1850,
    soldCount: '4K+',
    stockStatus: 'Em estoque',
    deliveryTime: 'Receba hoje até as 18h',
    category: 'Bebidas'
  },
  'cha-matte-natural-leao-100g': {
    id: 'cha-matte-natural-leao-100g',
    title: 'Chá Matte Natural Leão (100g)',
    price: 'R$ 9,90',
    priceNum: 9.90,
    image: '/Cha-Matte-Natural-100g-Leao.png',
    badge: 'Orgânico',
    rating: 4.7,
    ratingCount: 430,
    soldCount: '1.5K+',
    stockStatus: 'Em estoque',
    deliveryTime: 'Receba hoje até as 18h',
    category: 'Bebidas'
  },
  'leite-longa-vida-integral-1l': {
    id: 'leite-longa-vida-integral-1l',
    title: 'Leite Longa Vida Integral (1L)',
    price: 'R$ 5,49',
    priceNum: 5.49,
    image: '/leite-integral-interna.png',
    badge: 'Essencial',
    rating: 4.8,
    ratingCount: 5120,
    soldCount: '8K+',
    stockStatus: 'Em estoque',
    deliveryTime: 'Receba hoje até as 18h',
    category: 'Bebidas'
  },
  'pao-pullman-forma-integral-500g': {
    id: 'pao-pullman-forma-integral-500g',
    title: 'Pão Pullman Forma Integral (500g)',
    price: 'R$ 12,90',
    priceNum: 12.90,
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=600',
    badge: 'Fibras',
    rating: 4.6,
    ratingCount: 890,
    soldCount: '2K+',
    stockStatus: 'Em estoque',
    deliveryTime: 'Receba hoje até as 18h',
    category: 'Alimentos'
  },
  'queijo-minas-frescal-itambe-300g': {
    id: 'queijo-minas-frescal-itambe-300g',
    title: 'Queijo Minas Frescal Itambé (300g)',
    price: 'R$ 19,90',
    priceNum: 19.90,
    image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?q=80&w=600',
    badge: 'Frescal',
    rating: 4.7,
    ratingCount: 650,
    soldCount: '1.8K+',
    stockStatus: 'Em estoque',
    deliveryTime: 'Receba hoje até as 18h',
    category: 'Alimentos'
  },
  'peito-de-peru-fatiado-sadia-100g': {
    id: 'peito-de-peru-fatiado-sadia-100g',
    title: 'Peito de Peru Fatiado Sadia (100g)',
    price: 'R$ 7,49',
    priceNum: 7.49,
    image: 'https://images.unsplash.com/photo-1603048297172-c92544798d5e?q=80&w=600',
    badge: 'Proteico',
    rating: 4.8,
    ratingCount: 1540,
    soldCount: '5K+',
    stockStatus: 'Em estoque',
    deliveryTime: 'Receba hoje até as 18h',
    category: 'Alimentos'
  },
  'manteiga-itambe-extra-sal-200g': {
    id: 'manteiga-itambe-extra-sal-200g',
    title: 'Manteiga Itambé Extra Sal (200g)',
    price: 'R$ 11,90',
    priceNum: 11.90,
    image: 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?q=80&w=600',
    badge: 'Tradicional',
    rating: 4.8,
    ratingCount: 2200,
    soldCount: '4K+',
    stockStatus: 'Em estoque',
    deliveryTime: 'Receba hoje até as 18h',
    category: 'Alimentos'
  },
  'sabao-liquido-premium': {
    id: 'sabao-liquido-premium',
    title: 'Sabão Líquido Premium',
    price: 'R$ 19,90',
    priceNum: 19.90,
    image: 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?q=80&w=600',
    badge: 'Concentrado',
    rating: 4.9,
    ratingCount: 310,
    soldCount: '900+',
    stockStatus: 'Em estoque',
    deliveryTime: 'Receba amanhã até as 12h',
    category: 'Limpeza'
  },
  'multiuso-fresh-ultra': {
    id: 'multiuso-fresh-ultra',
    title: 'Multiuso Fresh Ultra',
    price: 'R$ 12,90',
    priceNum: 12.90,
    image: 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?q=80&w=600',
    badge: 'Multiuso',
    rating: 4.6,
    ratingCount: 740,
    soldCount: '3K+',
    stockStatus: 'Em estoque',
    deliveryTime: 'Receba hoje até as 18h',
    category: 'Limpeza'
  }
};

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
  const { addToCart } = useCart();

  // Calculations
  const discountMultiplier = purchaseMode === 'subscribe' ? 0.9 : 1.0;
  const couponMultiplier = couponApplied ? 0.8 : 1.0; // Extra 20% off
  const finalPrice = product.priceNum * discountMultiplier * couponMultiplier;

  // Filter suggested products from the same category or overall catalog dynamically
  const suggestedProducts = Object.values(PRODUCTS_MOCK)
    .filter(p => p.id !== product.id && p.category === product.category)
    .slice(0, 4);

  const fallbackSuggested = Object.values(PRODUCTS_MOCK)
    .filter(p => p.id !== product.id)
    .slice(0, 4);

  const finalSuggested = suggestedProducts.length >= 2 ? suggestedProducts : fallbackSuggested;

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

        {/* EXPLICATIVE DETAILED SPECIFICATIONS BLOCK */}
        <div className="product-specifications-card">
          <h3>Descrição do Produto</h3>
          <p className="spec-description">
            {product.category === 'Café da Manhã' && "O acompanhamento perfeito para o seu café da manhã em família! Selecionado sob rigorosos padrões de qualidade, garantindo frescor incomparável, sabor marcante e nutrientes essenciais para começar o seu dia com toda a energia que você merece."}
            {product.category === 'Bebidas' && "Perfeito para refrescar o seu dia ou complementar momentos especiais com amigos e família. Armazenado sob temperatura ideal, garantindo refrescância máxima, sabor inigualável e qualidade premium em cada gole."}
            {product.category === 'Alimentos' && "Ingrediente de altíssima qualidade selecionado especialmente para as suas receitas. Sabor autêntico, embalagem higiênica e procedência garantida para levar o melhor sabor à mesa do seu lar."}
            {product.category === 'Limpeza' && "Fórmula ultra concentrada de alta performance desenvolvida para eliminar as sujeiras mais difíceis com o mínimo esforço. Deixa um perfume refrescante e protege as superfícies da sua casa."}
          </p>
          <div className="spec-grid">
            <div className="spec-item">
              <span className="spec-label">Categoria:</span>
              <span className="spec-value">{product.category}</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Origem:</span>
              <span className="spec-value">Nacional (Brasil)</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Conservação:</span>
              <span className="spec-value">
                {product.category === 'Limpeza' ? "Manter fora do alcance de crianças" : "Manter refrigerado após aberto"}
              </span>
            </div>
          </div>
        </div>

        {/* CLUBE NOSSO JEITO EXCLUSIVE PROMOTION BANNER */}
        <div className="clube-nosso-jeito-invite">
          <div className="clube-invite-title">✨ Clube do Nosso Jeito</div>
          <p className="clube-invite-text">
            Faça parte do nosso clube de assinaturas exclusivo! Economize 10% adicionais em todos os produtos, garanta frete grátis em entregas recorrentes e tenha suporte VIP em minutos.
          </p>
          <button 
            className="clube-invite-btn"
            onClick={() => {
              setPurchaseMode('subscribe');
              window.scrollTo({ top: 320, behavior: 'smooth' });
            }}
          >
            Assinar agora com 10% OFF
          </button>
        </div>

        {/* OBVIOUS HIGH-CONTRAST CONVERSION CALL-TO-ACTION (CTA) BUTTON */}
        <div className="cta-container">
          <button 
            className="main-gold-cta"
            onClick={(e) => {
              if (purchaseMode === 'subscribe') {
                alert(`Assinatura de ${quantity}x ${product.title} a cada ${frequency} dias configurada!`);
              } else {
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

                const targetX = window.innerWidth / 2;
                const targetY = window.innerHeight - 56;

                flyer.getBoundingClientRect();

                flyer.style.left = `${targetX - 18}px`;
                flyer.style.top = `${targetY - 18}px`;
                flyer.style.transform = 'scale(0.3) rotate(360deg)';
                flyer.style.opacity = '0.3';

                setTimeout(() => {
                  flyer.remove();
                  addToCart({ id: product.id, title: product.title, price: finalPrice, image: product.image }, quantity);
                }, 900);
              }
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
            {finalSuggested.map((prod, index) => (
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
