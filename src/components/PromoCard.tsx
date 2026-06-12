import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../hooks/useCart';

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

export const PromoCard = ({
  title,
  price,
  image,
  badge,
  diamondReward,
  category,
}: {
  title: string;
  price: number | string;
  image: string;
  badge?: string;
  badgeStyle?: 'light' | 'orange';
  diamondReward?: number;
  category?: string;
}) => {
  const { addToCart, cartItems, updateQuantity, removeFromCart } = useCart();

  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');


  const numericPrice = typeof price === 'number' 
    ? price 
    : (parseFloat(price.replace('R$', '').replace(',', '.').trim()) || 0);

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
  const [animationState, setAnimationState] = useState<'normal' | 'reducing' | 'reduced-flash' | 'club-only'>('normal');
  const [currentPrice, setCurrentPrice] = useState<number>(numericPrice);

  const currentQuantity = cartItems.find((item) => item.id === slug)?.quantity || 0;

  const handleMinus = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentQuantity <= 1) {
      removeFromCart(slug);
    } else {
      updateQuantity(slug, currentQuantity - 1);
    }
  };

  const handlePlus = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateQuantity(slug, currentQuantity + 1);
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

  useEffect(() => {
    // PromoCard should NOT have the SÓ NO CLUBE discount reduction
    const lucky = false;

    if (!lucky) return;

    // Stagger the initial start
    const initialDelay = Math.random() * 12000 + 6000; // 6s to 18s stagger (slower)
    let timer: any;
    let loopInterval: any;
    const channel = category || 'global';

    const runAnimation = () => {
      // Coordinate animations per category using a global window registry
      if (!(window as any).activeAnimations) {
        (window as any).activeAnimations = {};
      }

      // If another product in this category is currently animating, postpone by 5-10s
      if ((window as any).activeAnimations[channel] && (window as any).activeAnimations[channel] !== title) {
        timer = setTimeout(runAnimation, Math.random() * 5000 + 5000);
        return;
      }

      // Claim the channel
      (window as any).activeAnimations[channel] = title;

      // 1. Start reducing (color is green in CSS)
      setAnimationState('reducing');
      const discount = parseFloat((Math.random() * 1.0 + 2.0).toFixed(2)); // between 2.00 and 3.00
      const targetPrice = Math.max(0.5, numericPrice - discount);
      
      const startPriceCents = Math.round(numericPrice * 100);
      const targetPriceCents = Math.round(targetPrice * 100);
      const totalCentsToReduce = startPriceCents - targetPriceCents;
      
      const totalDuration = 3000; // 3 seconds total animation duration
      const stepTime = Math.max(10, Math.round(totalDuration / totalCentsToReduce));
      
      let currentCents = startPriceCents;

      const countdown = setInterval(() => {
        currentCents -= 1; // Decrement cent-by-cent
        if (currentCents <= targetPriceCents) {
          clearInterval(countdown);
          setCurrentPrice(targetPrice);
          
          // 2. Switch to reduced-flash state (final reduced price pulses/scale-flashes)
          setAnimationState('reduced-flash');
          
          // Trigger the yellow diamond explosion
          triggerIncentiveEffects();

          // Hold reduced-flash for 7.0 seconds (drastically slower), then display "SÓ NO CLUBE!"
          setTimeout(() => {
            setAnimationState('club-only');
            
            // Hold club-only for 8.0 seconds (drastically slower), then return to normal
            setTimeout(() => {
              setAnimationState('normal');
              setCurrentPrice(numericPrice);
              
              // Release the channel
              if ((window as any).activeAnimations) {
                delete (window as any).activeAnimations[channel];
              }
            }, 8000);
          }, 7000);
        } else {
          setCurrentPrice(currentCents / 100);
        }
      }, stepTime);
    };

    timer = setTimeout(() => {
      runAnimation();
      loopInterval = setInterval(runAnimation, 45000); // repeat every 45 seconds (drastically slower pacing)
    }, initialDelay);

    return () => {
      clearTimeout(timer);
      clearInterval(loopInterval);
      // Clean up global channel reservation on unmount
      if ((window as any).activeAnimations && (window as any).activeAnimations[channel] === title) {
        delete (window as any).activeAnimations[channel];
      }
    };
  }, [numericPrice, category, title]);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

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
    addToCart({ id: slug, title, price: numericPrice, image }, 1);

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
    <div className="product-card mega-oferta-wrapper" ref={cardRef}>
      {badge && (
        <div className={`badge-promo-top-left ${badge.includes('%') ? 'badge-square' : ''}`}>
          {badge.includes('% OFF') ? (
            <>
              <span className="badge-percent">{badge.split(' ')[0]}</span>
              <span className="badge-off">{badge.split(' ')[1]}</span>
            </>
          ) : (
            badge
          )}
        </div>
      )}
      <Link to={`/product/${slug}`} style={{ textDecoration: 'none', color: 'inherit', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
        <div className={`product-image-wrapper ${isTall ? 'tall-product' : 'wide-product'}`}>
          <img src={image} alt={title} />
          
          {/* Render diamond area inside image wrapper */}
          {diamondReward && (
            <div className="badge-wrapper">
              <div className="badge diamond-badge" title={`Ganhe ${diamondReward} diamantes!`}>
                <DiamondIcon size={9} />
                <span>+{diamondReward}</span>
              </div>
            </div>
          )}
        </div>

        <div className="mega-oferta-price-highlight">
          <span className="mega-price-currency">R$</span>
          <span className="mega-price-amount">
            {animationState === 'reducing' || animationState === 'reduced-flash'
              ? currentPrice.toFixed(2).replace('.', ',')
              : numericPrice.toFixed(2).replace('.', ',')}
          </span>
        </div>

        {/* Product title below photo and price */}
        <div className="product-title">{title}</div>
      </Link>

      {/* Add/Quantity Button aligned to the base (hanging 50% out) */}
      <div className="mega-oferta-action-container" ref={pricePillRef}>
        {animationState === 'club-only' ? (
          <div className="club-only-pill" onClick={handleAdd}>
            <span>SÓ NO CLUBE!</span>
          </div>
        ) : currentQuantity > 0 ? (
          <div className="quantity-control-pill">
             <button className="minus-btn" onClick={handleMinus}>-</button>
             <span className="current-quantity">{currentQuantity}</span>
             <button className="add-btn" onClick={handlePlus}>+</button>
          </div>
        ) : (
          <button className="mega-add-btn" onClick={handleAdd} type="button">
            +
          </button>
        )}
      </div>
    </div>
  );
};

