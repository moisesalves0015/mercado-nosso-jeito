import { Link } from 'react-router-dom';

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
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

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
        <button className="add-btn">+</button>
      </div>
    </div>
  );
};
