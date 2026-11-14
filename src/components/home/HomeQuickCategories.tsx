import { Link } from 'react-router-dom';
import type { HomeCategoryLink } from '../../types/home';
import { getCategoryHref } from '../../utils/homeProducts';
import { resolveCategoryIcon } from '../../utils/homeCategoryIcons';

/**
 * Atalhos rápidos de categoria na Home (Promoções, Doces, Biscoitos, Higiene, Limpeza, Combos e Ver todas),
 * no Estilo 02 — Mercado Premium: ícone vetorial dentro de um círculo + título fora do círculo, abaixo dele.
 */
export const HomeQuickCategories = ({ items }: { items: HomeCategoryLink[] }) => {
  return (
    <div className="home-category-section" style={{ marginBottom: '10px' }}>
      <div className="section-header" style={{ marginBottom: '6px', marginTop: '10px' }}>
        <h2
          style={{
            margin: 0,
            fontSize: '13px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.2px',
          }}
        >
          Categorias
        </h2>
      </div>
      <nav
        className="category-row category-row--circle"
        aria-label="Atalhos de categorias"
      >
        {items.map((item) => {
          const Icon = resolveCategoryIcon(item);
          return (
            <Link
              key={item.id}
              to={getCategoryHref(item)}
              aria-label={item.label}
              className="category-circle-link"
            >
              <div className="category-item category-item--circle">
                <div className="category-icon-wrapper category-icon-circle" aria-hidden="true">
                  <Icon size={22} strokeWidth={1.9} />
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
