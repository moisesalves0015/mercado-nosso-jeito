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
}: {
  title: string;
  price: number | string;
  image: string;
  badge?: string;
  badgeStyle?: 'light' | 'orange';
  diamondReward?: number;
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
    <div className="product-card">
      <Link to={`/product/${slug}`} style={{ textDecoration: 'none', color: 'inherit', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="product-image-wrapper">
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

      <div className="price-pill">
        <div className="product-price">{formattedPrice}</div>
        <button className="add-btn" onClick={handleAdd}>+</button>
      </div>
    </div>
  );
};
