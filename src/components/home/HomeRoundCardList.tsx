import { Link } from 'react-router-dom';
import type { RoundCardItem } from '../../types/home';
import { resolveLink } from '../../utils/homeProducts';
import { cleanImageUrl, handleImageError } from '../../utils/imageUrl';

interface HomeRoundCardListProps {
  title: string;
  subtitle?: string;
  items: RoundCardItem[];
  variant: 'brands' | 'partners';
  linkText?: string;
  to?: string;
}

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '•';

/**
 * Lista vertical de cards redondos para "Marcas" e "Parceiros Locais" na Home.
 * Totalmente gerenciável no-code pelo CRM Admin (home-brands / home-partners).
 */
export const HomeRoundCardList = ({
  title,
  subtitle,
  items,
  variant,
  linkText,
  to,
}: HomeRoundCardListProps) => {
  const activeItems = items.filter((item) => item.active !== false);
  if (activeItems.length === 0) return null;

  return (
    <section
      className={`section standard-section home-round-section home-round-section--${variant}`}
      aria-label={title}
    >
      <div className="section-header">
        <div className="section-header-left">
          <h2>{title}</h2>
          {subtitle && (
            <div className="animated-subtitle-container">
              <p className="animated-subtitle active">{subtitle}</p>
            </div>
          )}
        </div>
        {linkText && to && <Link to={to}>{linkText}</Link>}
      </div>

      <div className={`home-round-vertical-list home-round-vertical-list--${variant}`}>
        {activeItems.map((item) => {
          const resolved = resolveLink(item.link);
          const cleanedImg = item.image ? cleanImageUrl(item.image) : '';

          const cardInner = (
            <>
              <div className="home-round-avatar-ring">
                <div className="home-round-avatar">
                  {cleanedImg ? (
                    <img
                      src={cleanedImg}
                      alt={item.name}
                      loading="lazy"
                      onError={handleImageError}
                      className="home-round-avatar-img"
                    />
                  ) : (
                    <span className="home-round-avatar-initials" aria-hidden="true">
                      {getInitials(item.name)}
                    </span>
                  )}
                </div>
                {item.badge && (
                  <span className="home-round-badge">{item.badge}</span>
                )}
              </div>
              <div className="home-round-meta">
                <span className="home-round-name">{item.name}</span>
                {item.subtitle && (
                  <span className="home-round-subtitle">{item.subtitle}</span>
                )}
              </div>
            </>
          );

          if (resolved?.kind === 'internal') {
            return (
              <Link
                key={item.id}
                to={resolved.href}
                className="home-round-card"
                aria-label={`${item.name}${item.subtitle ? ` — ${item.subtitle}` : ''}`}
              >
                {cardInner}
              </Link>
            );
          }

          if (resolved?.kind === 'external') {
            return (
              <a
                key={item.id}
                href={resolved.href}
                target="_blank"
                rel="noopener noreferrer"
                className="home-round-card"
                aria-label={`${item.name}${item.subtitle ? ` — ${item.subtitle}` : ''}`}
              >
                {cardInner}
              </a>
            );
          }

          return (
            <div key={item.id} className="home-round-card home-round-card--static">
              {cardInner}
            </div>
          );
        })}
      </div>
    </section>
  );
};

