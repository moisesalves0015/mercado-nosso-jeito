import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HomeCategoryLink } from '../../types/home';
import { getCategoryHref } from '../../utils/homeProducts';

interface Thumb { widthPct: number; leftPct: number }

/** Carrossel de categorias ilustradas, com indicador calculado pelo tamanho real do conteúdo. */
export const HomeCategoryCarousel = ({ items }: { items: HomeCategoryLink[] }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<Thumb | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());

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

  // Recalcula na montagem e quando o tamanho do contêiner/conteúdo muda.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const frame = requestAnimationFrame(updateThumb);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateThumb) : null;
    observer?.observe(row);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [updateThumb, items.length]);

  const markFailed = (id: string) => setFailedImages(prev => new Set(prev).add(id));

  return (
    <>
      <div className="section-header" style={{ padding: '0 8px', marginBottom: '4px', marginTop: '12px' }}>
        <h2 style={{ margin: 0, fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>Categorias</h2>
        <Link to="/categories" className="glass-ver-todas-btn">
          Ver todas <span style={{ color: '#FFDF73' }} aria-hidden="true">&gt;</span>
        </Link>
      </div>
      <div
        className="category-row"
        ref={rowRef}
        onScroll={updateThumb}
        role="region"
        aria-label="Categorias ilustradas"
        tabIndex={0}
      >
        {items.map(item => (
          <Link
            key={item.id}
            to={getCategoryHref(item)}
            aria-label={item.label}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div className="category-item">
              <div className="category-icon-wrapper">
                {item.image && !failedImages.has(item.id) ? (
                  <img
                    src={item.image}
                    alt=""
                    className="category-3d-icon"
                    loading="lazy"
                    onError={() => markFailed(item.id)}
                  />
                ) : (
                  // Fallback sem quebrar o layout quando a imagem não carrega.
                  <span className="category-text">{item.label}</span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {thumb && (
        <div className="category-scroll-indicators" aria-hidden="true">
          <div className="category-scroll-track">
            <div className="category-scroll-thumb" style={{ width: `${thumb.widthPct}%`, left: `${thumb.leftPct}%` }} />
          </div>
        </div>
      )}
    </>
  );
};
