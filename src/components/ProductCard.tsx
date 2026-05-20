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

export const ProductCard = ({
  title,
  price,
  image,
  badge,
  badgeStyle = 'light',
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
  const { addToCart } = useCart();

  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  const formattedPrice = typeof price === 'number' 
    ? `R$ ${price.toFixed(2).replace('.', ',')}` 
    : price;

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

  const triggerIncentiveEffects = (discount: number) => {
    if (!cardRef.current || !pricePillRef.current) return;
    const card = cardRef.current;
    const pill = pricePillRef.current;
    
    // Get pill coordinates relative to the card wrapper
    const pillRect = pill.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    
    const pillCenterX = (pillRect.left + pillRect.width / 2) - cardRect.left;
    const pillCenterY = (pillRect.top + pillRect.height / 2) - cardRect.top;
    const pillBottomY = pillRect.bottom - cardRect.top;

    // 1. Spawning Red Negative Floating Value (-R$ X,XX) under the pill, without drifting downwards
    const floater = document.createElement('div');
    floater.className = 'deduction-floater';
    floater.innerText = `-R$ ${discount.toFixed(2).replace('.', ',')}`;
    floater.style.position = 'absolute';
    floater.style.left = `${pillCenterX}px`;
    floater.style.top = `${pillBottomY - 1}px`; // Under the price pill (exactly 1px overlap/closer)
    floater.style.transform = 'translate(-50%, 0)';
    floater.style.color = '#FF5E5E'; // Red color
    floater.style.fontWeight = '900';
    floater.style.fontSize = '9.5px'; // Slightly smaller font size
    floater.style.pointerEvents = 'none';
    floater.style.zIndex = '9999'; // Above everything
    floater.style.whiteSpace = 'nowrap'; // Avoid line break
    floater.style.opacity = '1'; // Start fully solid/opaque
    
    card.appendChild(floater);
    
    // Force DOM reflow
    floater.getBoundingClientRect();
    
    // Animate: Keep it visible exactly while the price flashes (7000ms total)
    setTimeout(() => {
      floater.style.transition = 'opacity 0.8s ease-out';
      floater.style.opacity = '0';
    }, 6200); // Wait 6.2s before fading out so it stays visible during the flash
    
    setTimeout(() => {
      floater.remove();
    }, 7000); // Remove exactly when the flash phase ends

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
    // Randomly decide if this card displays the club discount teaser
    const lucky = Math.random() < 0.45;

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
      
      const steps = 15;
      const stepTime = 350; // total 5.25s (extremely slow, clear price ticks)
      const decrement = discount / steps;
      let current = numericPrice;
      let stepCount = 0;

      const countdown = setInterval(() => {
        current -= decrement;
        stepCount++;
        if (stepCount >= steps || current <= targetPrice) {
          clearInterval(countdown);
          setCurrentPrice(targetPrice);
          
          // 2. Switch to reduced-flash state (final reduced price pulses/scale-flashes)
          setAnimationState('reduced-flash');
          
          // Trigger the yellow diamond explosion and red negative deduction floater
          triggerIncentiveEffects(discount);

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
          setCurrentPrice(current);
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

    // Target location (bottom-nav or floating mini-cart center)
    const targetX = window.innerWidth / 2;
    const targetY = window.innerHeight - 56;

    // Force DOM reflow
    flyer.getBoundingClientRect();

    // Translate/Scale towards bottom menu
    flyer.style.left = `${targetX - 18}px`;
    flyer.style.top = `${targetY - 18}px`;
    flyer.style.transform = 'scale(0.3) rotate(360deg)';
    flyer.style.opacity = '0.3';

    // Add to cart state once the flight completes
    setTimeout(() => {
      flyer.remove();
      addToCart({ id: slug, title, price: numericPrice, image }, 1);
    }, 900);
  };

  return (
    <div className="product-card" ref={cardRef}>
      <Link to={`/product/${slug}`} style={{ textDecoration: 'none', color: 'inherit', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className={`product-image-wrapper ${isTall ? 'tall-product' : 'wide-product'}`}>
          <img src={image} alt={title} />
          
          {/* Render badge area at the bottom-center of the image wrapper */}
          {(badge || diamondReward) && (
            <div className="badge-wrapper">
              {badge && diamondReward ? (
                // Both exist: render them with alternating classes
                <>
                  <div className={`badge ${badgeStyle} badge-alternate-promo`}>{badge}</div>
                  <div className="badge diamond-badge badge-alternate-diamond" title={`Ganhe ${diamondReward} diamantes!`}>
                    <DiamondIcon size={9} />
                    <span>+{diamondReward}</span>
                  </div>
                </>
              ) : badge ? (
                // Only promo badge
                <div className={`badge ${badgeStyle}`}>{badge}</div>
              ) : (
                // Only diamond badge
                <div className="badge diamond-badge" title={`Ganhe ${diamondReward} diamantes!`}>
                  <DiamondIcon size={9} />
                  <span>+{diamondReward}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="product-title">{title}</div>
      </Link>

      <div className={`price-pill ${animationState === 'club-only' ? 'club-only-active' : ''}`} ref={pricePillRef}>
        {animationState === 'club-only' ? (
          <div className="club-only-flash">SÓ NO CLUBE!</div>
        ) : (
          <div className={`product-price ${
            animationState === 'reducing' 
              ? 'reducing-active' 
              : animationState === 'reduced-flash' 
                ? 'reduced-flash-active' 
                : ''
          }`}>
            {animationState === 'reducing' || animationState === 'reduced-flash'
              ? `R$ ${currentPrice.toFixed(2).replace('.', ',')}`
              : formattedPrice}
          </div>
        )}
        {animationState !== 'club-only' && (
          <button className="add-btn" onClick={handleAdd}>+</button>
        )}
      </div>
    </div>
  );
};
