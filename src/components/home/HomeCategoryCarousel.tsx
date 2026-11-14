import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { HomeCategoryLink } from '../../types/home';
import { getCategoryHref } from '../../utils/homeProducts';
import { resolveCategoryIcon } from '../../utils/homeCategoryIcons';

interface Thumb {
  widthPct: number;
  leftPct: number;
}

interface HomeCategoryCarouselProps {
  items: HomeCategoryLink[];
  /** Exibe o atalho "Ver todas >" no cabeçalho da seção (padrão: true). */
  showHeaderLink?: boolean;
  /** Rótulo acessível da região de navegação/carrossel. */
  ariaLabel?: string;
}

/**
 * Carrossel horizontal de categorias no Estilo 02 (Mercado Premium):
 * - Ícone vetorial centralizado dentro de um botão circular verde-floresta com contorno sutil;
 * - Nome da categoria fora do círculo, em linha única (`white-space: nowrap`) abaixo do ícone;
 * - Indicador discreto de rolagem calculado pelo tamanho real do conteúdo.
 */
export const HomeCategoryCarousel = ({
  items,
  showHeaderLink = true,
  ariaLabel = 'Categorias',
}: HomeCategoryCarouselProps) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<Thumb | null>(null);
  const location = useLocation();
  const currentUrl = `${location.pathname}${location.search}`;

  const updateThumb = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    const { scrollWidth, clientWidth, scrollLeft } = row;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll <= 1) {
      setThumb(null); // tudo cabe: sem indicador
      return;
    }
    const widthPct = Math.max(12, (clientWidth / scrollWidth) * 100);
    setThumb({ widthPct, leftPct: (scrollLeft / maxScroll) * (100 - widthPct) });
  }, []);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const frame = requestAnimationFrame(updateThumb);
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateThumb) : null;
    observer?.observe(row);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [updateThumb, items.length]);

  return (
    <div className="home-category-section">
      <div
        className="section-header"
        style={{ padding: '0 8px', marginBottom: '6px', marginTop: '12px' }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.2px',
          }}
        >
          Categorias
        </h2>
        {showHeaderLink && (
          <Link to="/categories" className="glass-ver-todas-btn">
            Ver todas{' '}
            <span style={{ color: '#E5C158' }} aria-hidden="true">
              &gt;
            </span>
          </Link>
        )}
      </div>

      <div
        className="category-row category-row--circle"
        ref={rowRef}
        onScroll={updateThumb}
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
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
      </div>

      {thumb && (
        <div className="category-scroll-indicators" aria-hidden="true">
          <div className="category-scroll-track">
            <div
              className="category-scroll-thumb"
              style={{ width: `${thumb.widthPct}%`, left: `${thumb.leftPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
