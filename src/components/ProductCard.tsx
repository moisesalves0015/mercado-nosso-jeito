import { Link } from 'react-router-dom';

export const ProductCard = ({
  title,
  price,
  image,
  badge,
  badgeStyle = 'light',
}: {
  title: string;
  price: string;
  image: string;
  badge?: string;
  badgeStyle?: 'light' | 'orange';
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
