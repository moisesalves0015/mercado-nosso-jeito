import { Link, useLocation } from 'react-router-dom';
import type { HomeCategoryLink } from '../../types/home';
import { getCategoryHref } from '../../utils/homeProducts';
import { resolveCategoryIcon } from '../../utils/homeCategoryIcons';

/**
 * Atalhos rápidos de categoria na Home (Promoções, Doces, Biscoitos, Higiene, Limpeza, Combos e Ver todas),
 * no Estilo 02 — Mercado Premium compacto: ícone vetorial dentro de um círculo + título fora do círculo, abaixo dele,
 * dimensionados proporcionalmente para caber na largura da tela sem scroll horizontal desnecessário.
 */
export const HomeQuickCategories = ({ items }: { items: HomeCategoryLink[] }) => {
  const location = useLocation();
  const currentUrl = `${location.pathname}${location.search}`;

  return (
    <div className="home-category-section home-category-section--quick" style={{ marginBottom: '6px' }}>
      <div className="section-header" style={{ marginBottom: '4px', marginTop: '8px' }}>
        <h2
          style={{
            margin: 0,
            fontSize: '12.5px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.2px',
          }}
        >
          Categorias
        </h2>
      </div>
      <nav
        className="category-row category-row--circle category-row--quick"
        aria-label="Atalhos de categorias"
      >
        {items.map((item) => {
          const Icon = resolveCategoryIcon(item);
          const href = getCategoryHref(item);
          const isSelected = currentUrl === href || location.pathname === href;
          return (
            <Link
              key={item.id}
              to={href}
              aria-label={item.label}
              aria-current={isSelected ? 'page' : undefined}
              className={`category-circle-link ${isSelected ? 'active' : ''}`}
            >
              <div className="category-item category-item--circle">
                <div className="category-icon-wrapper category-icon-circle" aria-hidden="true">
                  <Icon size={18} strokeWidth={isSelected ? 2.2 : 1.9} />
                </div>
                <span className="category-text category-circle-label">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
