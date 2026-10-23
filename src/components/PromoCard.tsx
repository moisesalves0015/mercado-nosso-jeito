import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { getEffectiveProductPrice } from '../utils/productPricing';
import type { PromoExpiry } from '../types/home';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

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
    aria-hidden="true"
  >
    <path d="M6 3h12l4 6-10 12L2 9z" />
    <path d="M11 3 8 9l4 12" />
    <path d="M13 3 16 9 12 21" />
    <path d="M2 9h20" />
  </svg>
);
 
/** Explosão decorativa de diamantes (não altera nenhum valor). */
function triggerDiamondExplosion(card: HTMLElement, pill: HTMLElement) {
  const pillRect = pill.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const centerX = pillRect.left + pillRect.width / 2 - cardRect.left;
  const centerY = pillRect.top + pillRect.height / 2 - cardRect.top;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FFDF73" stroke="#D4AF37" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M11 3 8 9l4 12"/><path d="M13 3 16 9 12 21"/><path d="M2 9h20"/></svg>`;

  for (let i = 0; i < 8; i++) {
    const particle = document.createElement('div');
    particle.className = 'diamond-particle-yellow';
    particle.setAttribute('aria-hidden', 'true');
    particle.innerHTML = svg;
    const size = Math.random() * 4 + 13;
    Object.assign(particle.style, {
      position: 'absolute',
      left: `${centerX}px`,
      top: `${centerY}px`,
      width: `${size}px`,
      height: `${size}px`,
      pointerEvents: 'none',
      zIndex: '1',
      transform: 'translate(-50%, -50%)',
      transition: 'transform 3.5s cubic-bezier(0.1, 0.8, 0.3, 1), opacity 3.5s cubic-bezier(0.1, 0.8, 0.3, 1)',
    });
    card.appendChild(particle);

    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 40 + 35;
    particle.getBoundingClientRect(); // força reflow para iniciar a transição
    particle.style.transform = `translate(calc(-50% + ${Math.cos(angle) * distance}px), calc(-50% + ${Math.sin(angle) * distance}px)) scale(0.2) rotate(${Math.random() * 720 - 360}deg)`;
    particle.style.opacity = '0';
    setTimeout(() => particle.remove(), 3500);
  }
}

interface PromoCardProps {
  /** ID do documento Firestore. Obrigatório: é a identidade no carrinho, na rota e no createOrder. */
  id: string;
  title: string;
  /** Preço regular. O preço efetivo (promoção vigente) é calculado por productPricing. */
  price: number | string;
  image: string;
  /** Selo configurado pelo admin. Nunca é gerado/inventado aqui. */
  badge?: string;
  badgeStyle?: 'light' | 'orange';
  diamondReward?: number;
  category?: string;
  /** Posição no ranking (Favoritos do Condomínio). */
  rank?: number;
  stock?: number;
  promoActive?: boolean;
  promoPrice?: number | string;
  promoExpiry?: PromoExpiry;
}

/**
 * Cartão de destaque (Mega Ofertas e Favoritos). Mesmo contrato de identidade/estoque/preço do
 * ProductCard. O preço exibido é SEMPRE o efetivo do catálogo — não há redução simulada.
 */
export const PromoCard = ({
  id,
  title,
  price,
  image,
  badge,
  diamondReward,
  rank,
  stock,
  promoActive,
  promoPrice,
  promoExpiry,
}: PromoCardProps) => {
  const { addToCart, cartItems, updateQuantity, removeFromCart } = useCart();
  const reducedMotion = usePrefersReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const pricePillRef = useRef<HTMLDivElement>(null);

  const effectivePrice = getEffectiveProductPrice({ price, promoActive, promoPrice, promoExpiry });
  const canOrder = Boolean(id) && Number.isInteger(stock) && Number(stock) > 0;
  const currentQuantity = cartItems.find((item) => item.id === id)?.quantity || 0;

  const lowerTitle = title.toLowerCase();
  const lowerImage = image.toLowerCase();
  const isTall = ['heineken', 'coca-cola', 'monster', 'spaten', 'suco'].some((k) => lowerTitle.includes(k)) ||
    ['heineken', 'coca_cola', 'monster', 'spaten'].some((k) => lowerImage.includes(k));

  const handleMinus = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentQuantity <= 1) removeFromCart(id);
    else updateQuantity(id, currentQuantity - 1);
  };

  const handlePlus = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canOrder || (stock !== undefined && currentQuantity >= stock)) {
      alert(stock === undefined ? 'A disponibilidade deste produto está sendo verificada.' : `Desculpe, temos apenas ${stock} unidade(s) deste produto em estoque.`);
      return;
    }
    updateQuantity(id, currentQuantity + 1);
  };

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canOrder) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const wasEmpty = !document.querySelector('.floating-mini-cart');

    // Adiciona primeiro (o mini-carrinho aparece) e anima a miniatura até ele.
    addToCart({ id, title, price: effectivePrice, image }, 1);
    if (!reducedMotion && cardRef.current && pricePillRef.current) {
      triggerDiamondExplosion(cardRef.current, pricePillRef.current);
    }
    if (reducedMotion) return;

    const flyer = document.createElement('div');
    Object.assign(flyer.style, {
      position: 'fixed',
      left: `${rect.left + rect.width / 2}px`,
      top: `${rect.top + rect.height / 2}px`,
      width: '36px',
      height: '36px',
      borderRadius: '50%',
      background: '#fff',
      border: '1.5px solid #FFDF73',
      boxShadow: wasEmpty ? '0 0 25px rgba(212,175,55,0.9)' : '0 0 10px rgba(212,175,55,0.7)',
      backgroundImage: `url(${image})`,
      backgroundSize: 'contain',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      zIndex: '99999',
      pointerEvents: 'none',
      transition: 'all 0.9s cubic-bezier(0.25, 1, 0.5, 1)',
      transform: wasEmpty ? 'scale(1.15)' : 'none',
    });
    flyer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(flyer);

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
      setTimeout(() => flyer.remove(), 900);
    }, wasEmpty ? 650 : 50);
  };

  const hasPercentBadge = badge?.includes('% OFF');

  return (
    <div className="product-card mega-oferta-wrapper" ref={cardRef}>
      {rank !== undefined ? (
        <div
          className="badge-promo-top-left badge-square"
          aria-label={`Posição ${rank} nos favoritos`}
          style={{
            width: '44px',
            height: '44px',
            top: '-9px',
            left: '-9px',
            background: 'linear-gradient(135deg, #FFDF73, #D4AF37)',
            color: '#000000',
            border: '1px solid rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: '26px', fontWeight: 900, lineHeight: 1 }}>{rank}</span>
        </div>
      ) : badge && (
        <div className={`badge-promo-top-left ${badge.includes('%') ? 'badge-square' : ''}`}>
          {hasPercentBadge ? (
            <>
              <span className="badge-percent">{badge.split(' ')[0]}</span>
              <span className="badge-off">{badge.split(' ')[1]}</span>
            </>
          ) : (
            badge
          )}
        </div>
      )}
      <Link
        to={`/product/${encodeURIComponent(id)}`}
        style={{ textDecoration: 'none', color: 'inherit', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}
      >
        <div className={`product-image-wrapper ${isTall ? 'tall-product' : 'wide-product'}`}>
          <img src={image} alt={title} loading="lazy" />
          {diamondReward ? (
            <div className="badge-wrapper">
              <div className="badge diamond-badge" title={`Ganhe ${diamondReward} diamantes!`}>
                <DiamondIcon size={9} />
                <span>+{diamondReward}</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mega-oferta-price-highlight">
          <span className="mega-price-currency">R$</span>
          <span className="mega-price-amount">{effectivePrice.toFixed(2).replace('.', ',')}</span>
        </div>

        <div className="product-title">{title}</div>
      </Link>

      <div className="mega-oferta-action-container" ref={pricePillRef}>
        {!canOrder ? (
          <div className="out-of-stock-flash" style={{ color: '#FF6B6B', fontWeight: 900, fontSize: 11 }}>
            {stock === 0 ? 'ESGOTADO' : 'INDISPONÍVEL'}
          </div>
        ) : currentQuantity > 0 ? (
          <div className="quantity-control-pill">
            <button type="button" className="minus-btn" onClick={handleMinus} aria-label={`Reduzir quantidade de ${title}`}>-</button>
            <span className="current-quantity" aria-live="polite" aria-label={`${currentQuantity} no carrinho`}>{currentQuantity}</span>
            <button type="button" className="add-btn" onClick={handlePlus} aria-label={`Aumentar quantidade de ${title}`}>+</button>
          </div>
        ) : (
          <button type="button" className="mega-add-btn" onClick={handleAdd} aria-label={`Adicionar ${title} ao carrinho`}>
            +
          </button>
        )}
      </div>
    </div>
  );
};
