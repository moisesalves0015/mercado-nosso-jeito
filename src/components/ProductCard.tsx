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
  return (
    <div className="product-card">
      <div className="product-image-wrapper">
        <img src={image} alt={title} />
        {badge && (
          <div className="badge-wrapper">
            <div className={`badge ${badgeStyle}`}>{badge}</div>
          </div>
        )}
      </div>

      <div className="product-title">{title}</div>

      <div className="price-pill">
        <div className="product-price">{price}</div>
        <button className="add-btn">+</button>
      </div>
    </div>
  );
};
