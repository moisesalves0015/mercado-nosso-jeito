import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { getEffectiveProductPrice } from '../utils/productPricing';

const DiamondIcon = ({ size = 10 }: { size?: number }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    width={size} 
    height={size} 
    fill="none" 
    stroke="#000" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M6 3h12l4 6-10 12L2 9z" />
    <path d="M11 3 8 9l4 12" />
    <path d="M13 3 16 9 12 21" />
    <path d="M2 9h20" />
  </svg>
);

export const ProductCard = ({
  id,
  title,
  price,
  image,
  badge,
  diamondReward,
  glassEffect,
  stock,
  promoActive,
  promoPrice,
  promoExpiry,
}: {
  id?: string;
  title: string;
  price: number | string;
  image: string;
  badge?: string;
  badgeStyle?: 'light' | 'orange';
  diamondReward?: number;
  category?: string;
  glassEffect?: boolean;
  stock?: number;
  promoActive?: boolean;
  promoPrice?: number | string;
  promoExpiry?: string | number | Date | { toDate?: () => Date; seconds?: number } | null;
}) => {
  const { addToCart, cartItems, updateQuantity, removeFromCart } = useCart();

  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
  const productId = id || slug;
  const numericPrice = getEffectiveProductPrice({ price, promoActive, promoPrice, promoExpiry });
  const canOrder = Boolean(id) && Number.isInteger(stock) && Number(stock) > 0;

  const formattedPrice = `R$ ${numericPrice.toFixed(2).replace('.', ',')}`;

  const isTall = title.toLowerCase().includes('heineken') ||
                 title.toLowerCase().includes('coca-cola') ||
                 title.toLowerCase().includes('monster') ||
                 title.toLowerCase().includes('spaten') ||
                 title.toLowerCase().includes('suco') ||
                 image.toLowerCase().includes('heineken') ||
                 image.toLowerCase().includes('coca_cola') ||
                 image.toLowerCase().includes('monster') ||
                 image.toLowerCase().includes('spaten');

  const cardRef = useRef<HTMLDivElement>(null);
  const pricePillRef = useRef<HTMLDivElement>(null);
  const [showDiamond, setShowDiamond] = useState(true);

  useEffect(() => {
    if (diamondReward && badge) {
      const interval = setInterval(() => {
        setShowDiamond((prev) => !prev);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [diamondReward, badge]);

  const currentQuantity = cartItems.find((item) => item.id === productId)?.quantity || 0;

  const handleMinus = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentQuantity <= 1) {
      removeFromCart(productId);
    } else {
      updateQuantity(productId, currentQuantity - 1);
    }
  };

  const handlePlus = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canOrder || (stock !== undefined && currentQuantity >= stock)) {
      alert(stock === undefined ? 'A disponibilidade deste produto está sendo verificada.' : `Desculpe, temos apenas ${stock} unidade(s) deste produto em estoque.`);
      return;
    }
    updateQuantity(productId, currentQuantity + 1);
  };

  const triggerIncentiveEffects = () => {
    if (!cardRef.current || !pricePillRef.current) return;
    const card = cardRef.current;
    const pill = pricePillRef.current;
    
    // Get pill coordinates relative to the card wrapper
    const pillRect = pill.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    
    const pillCenterX = (pillRect.left + pillRect.width / 2) - cardRect.left;
    const pillCenterY = (pillRect.top + pillRect.height / 2) - cardRect.top;

    // Prevent duplicate floaters by removing any existing ones in this card
    const existingFloater = card.querySelector('.deduction-floater');
    if (existingFloater) {
      existingFloater.remove();
    }

    // 2. Yellow/Gold Diamond Explosion behind the price pill
    const numParticles = 8;
    const svgContent = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FFDF73" stroke="#D4AF37" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 3h12l4 6-10 12L2 9z" />
        <path d="M11 3 8 9l4 12" />
        <path d="M13 3 16 9 12 21" />
        <path d="M2 9h20" />
      </svg>
    `;

    for (let i = 0; i < numParticles; i++) {
      const particle = document.createElement('div');
      particle.className = 'diamond-particle-yellow';
      particle.innerHTML = svgContent;
      particle.style.position = 'absolute';
      particle.style.left = `${pillCenterX}px`;
      particle.style.top = `${pillCenterY}px`;
      particle.style.width = `${Math.random() * 4 + 13}px`; // 13px to 17px (larger)
      particle.style.height = particle.style.width;
      particle.style.pointerEvents = 'none';
      particle.style.zIndex = '1'; // behind the pill (which is zIndex 2/relative)
      particle.style.transform = 'translate(-50%, -50%)';
      particle.style.transition = 'transform 3.5s cubic-bezier(0.1, 0.8, 0.3, 1), opacity 3.5s cubic-bezier(0.1, 0.8, 0.3, 1)'; // Limit transition fields
      
      card.appendChild(particle);
      
      // Dispersion trajectories (360 degrees)
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 40 + 35; // dispersion radius
      const targetX = Math.cos(angle) * distance;
      const targetY = Math.sin(angle) * distance;
      
      // Force DOM reflow
      particle.getBoundingClientRect();
      
      // Apply translation, rotation and scale down to 0
      particle.style.transform = `translate(calc(-50% + ${targetX}px), calc(-50% + ${targetY}px)) scale(0.2) rotate(${Math.random() * 720 - 360}deg)`;
      particle.style.opacity = '0';
      
      setTimeout(() => {
        particle.remove();
      }, 3500);
    }
  };



  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!canOrder) return;

    if (stock !== undefined && stock <= 0) {
      alert('Produto esgotado no momento.');
      return;
    }

    // Spawn coordinate calculations
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;

    // Create programmatic visual flyer thumbnail
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
    flyer.style.backgroundImage = `url(${image})`;
    flyer.style.backgroundSize = 'contain';
    flyer.style.backgroundPosition = 'center';
    flyer.style.backgroundRepeat = 'no-repeat';
    flyer.style.zIndex = '99999';
    flyer.style.pointerEvents = 'none';
    flyer.style.transition = 'all 0.9s cubic-bezier(0.25, 1, 0.5, 1)';

    document.body.appendChild(flyer);

    const wasEmpty = !document.querySelector('.floating-mini-cart');
    
    // Add to cart immediately so the mini-cart appears
    addToCart({ id: productId, title, price: numericPrice, image }, 1);
    triggerIncentiveEffects();

    if (wasEmpty) {
      // Pop effect while waiting for cart to slide up
      flyer.style.transform = 'scale(1.15)';
      flyer.style.boxShadow = '0 0 25px rgba(212,175,55,0.9)';
    }

    // Wait a brief moment for React to render the mini-cart, or longer if it needs to slide up
    setTimeout(() => {
      let targetX = window.innerWidth / 2;
      let targetY = window.innerHeight - 56;

      const cartIcon = document.querySelector('.floating-mini-cart .lucide-shopping-bag') || document.querySelector('a[href="/orders"] .nav-icon');
      if (cartIcon) {
        const cartRect = cartIcon.getBoundingClientRect();
        targetX = cartRect.left + cartRect.width / 2;
        targetY = cartRect.top + cartRect.height / 2;
      }

      // Translate/Scale towards the exact cart icon
      flyer.style.left = `${targetX - 18}px`;
      flyer.style.top = `${targetY - 18}px`;
      flyer.style.transform = 'scale(0.35) rotate(360deg)';
      flyer.style.opacity = '0.9'; // Keep it very visible

      setTimeout(() => {
        flyer.remove();
      }, 900);
    }, wasEmpty ? 650 : 50);
  };

  return (
    <div className={`product-card ${glassEffect ? 'glass-card' : ''}`} ref={cardRef}>
      <Link to={`/product/${encodeURIComponent(productId)}`} style={{ textDecoration: 'none', color: 'inherit', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className={`product-image-wrapper ${isTall ? 'tall-product' : 'wide-product'}`}>
          <img src={image} alt={title} />
          
          {/* Render diamond and/or promotional badges at the bottom-center of the image wrapper */}
          {(diamondReward || badge) && (
            <div className="badge-wrapper">
              {badge && (
                <div 
                  className="badge" 
                  style={{ 
                    bottom: 0,
                    opacity: diamondReward ? (showDiamond ? 0 : 1) : 1,
                    visibility: diamondReward ? (showDiamond ? 'hidden' : 'visible') : 'visible',
                    transition: 'opacity 0.4s ease, visibility 0.4s ease',
                  }}
                >
                  {badge}
                </div>
              )}
              {diamondReward && (
                <div 
                  className="badge diamond-badge" 
                  title={`Ganhe ${diamondReward} diamantes!`}
                  style={{ 
                    bottom: 0,
                    opacity: badge ? (showDiamond ? 1 : 0) : 1,
                    visibility: badge ? (showDiamond ? 'visible' : 'hidden') : 'visible',
                    transition: 'opacity 0.4s ease, visibility 0.4s ease',
                  }}
                >
                  <DiamondIcon size={9} />
                  <span>+{diamondReward}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="product-title">{title}</div>
      </Link>

      <div className="price-pill" ref={pricePillRef}>
        {!canOrder ? (
          <div className="out-of-stock-flash" style={{ color: '#FF6B6B', fontWeight: 900, fontSize: 11 }}>{stock === 0 ? 'ESGOTADO' : 'INDISPONÍVEL'}</div>
        ) : currentQuantity > 0 ? (
          <div className="quantity-control-wrapper">
             <button className="minus-btn" onClick={handleMinus} aria-label={`Reduzir quantidade de ${title}`}>-</button>
             <span className="current-quantity" aria-live="polite" aria-label={`${currentQuantity} no carrinho`}>{currentQuantity}</span>
             <button className="add-btn" onClick={handlePlus} aria-label={`Aumentar quantidade de ${title}`}>+</button>
          </div>
        ) : (
          <>
            <div className="product-price">{formattedPrice}</div>
            <button className="add-btn" onClick={handleAdd} aria-label={`Adicionar ${title} ao carrinho`}>+</button>
          </>
        )}
      </div>
    </div>
  );
};
