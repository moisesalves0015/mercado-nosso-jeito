import { Link } from 'react-router-dom';
import { useCart } from '../hooks/useCart';

export const ProductCard = ({
  title,
  price,
  image,
  badge,
  badgeStyle = 'light',
  diamondReward,
}: {
  title: string;
  price: string;
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

  const numericPrice = parseFloat(price.replace('R$', '').replace(',', '.').trim()) || 0;

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
          {badge && (
            <div className="badge-wrapper">
              <div className={`badge ${badgeStyle}`}>{badge}</div>
            </div>
          )}
          {diamondReward && (
            <div className="product-diamond-reward-badge" title={`Ganhe ${diamondReward} diamantes ao comprar!`}>
              <span className="diamond-reward-icon">♦</span>
              <span>+{diamondReward}</span>
            </div>
          )}
        </div>

        <div className="product-title">{title}</div>
      </Link>

      <div className="price-pill">
        <div className="product-price">{price}</div>
        <button className="add-btn" onClick={handleAdd}>+</button>
      </div>
    </div>
  );
};
