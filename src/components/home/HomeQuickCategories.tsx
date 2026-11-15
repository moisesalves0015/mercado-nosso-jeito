import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Zap } from 'lucide-react';
import type { HomeCategoryLink } from '../../types/home';
import { getCategoryHref } from '../../utils/homeProducts';
import { resolveCategoryIcon } from '../../utils/homeCategoryIcons';

function getSecondsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(23, 59, 59, 999);
  const diffMs = Math.max(0, midnight.getTime() - now.getTime());
  return Math.floor(diffMs / 1000);
}

function formatCountdown(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Atalhos rápidos de categoria na Home (Promoções, Doces, Biscoitos, Higiene, Limpeza, Combos e Ver todas),
 * no Estilo 02 — Mercado Premium compacto: ícone vetorial dentro de um círculo + título fora do círculo, abaixo dele,
 * dimensionados proporcionalmente para caber na largura da tela sem scroll horizontal desnecessário.
 * Inclui cabeçalho alinhado com título e badge de Oferta Relâmpago com contagem regressiva em tempo real.
 */
export const HomeQuickCategories = ({ items }: { items: HomeCategoryLink[] }) => {
  const location = useLocation();
  const currentUrl = `${location.pathname}${location.search}`;

  const [timeLeft, setTimeLeft] = useState(() => getSecondsUntilMidnight());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getSecondsUntilMidnight());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="home-category-section home-category-section--quick" style={{ marginBottom: '6px' }}>
      <div
        className="section-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '5px',
          marginTop: '6px',
          padding: '0 4px',
        }}
      >
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

        {/* Frase de Oferta Relâmpago e Contagem Regressiva 00:00:00 alinhada ao título */}
        <Link
          to="/promotions"
          className="flash-offer-countdown-badge"
          title="Ver Ofertas Relâmpago"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 8px',
            borderRadius: 999,
            background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.16) 0%, rgba(255, 223, 115, 0.05) 100%)',
            border: '1px solid rgba(229, 193, 88, 0.38)',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
            textDecoration: 'none',
            color: 'inherit',
            cursor: 'pointer',
            transition: 'transform 0.18s ease, border-color 0.18s ease, background 0.18s ease',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 15,
              height: 15,
              borderRadius: '50%',
              background: 'rgba(212, 175, 55, 0.22)',
              color: '#FFDF73',
              flexShrink: 0,
            }}
          >
            <Zap size={10} fill="#FFDF73" strokeWidth={1.5} />
          </span>

          <span
            style={{
              fontSize: 10.5,
              fontWeight: 800,
              color: '#E5C158',
              letterSpacing: '-0.1px',
              textTransform: 'uppercase',
            }}
          >
            Oferta Relâmpago
          </span>

          <span
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: '#FFF2B2',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.4px',
              background: 'rgba(0, 0, 0, 0.35)',
              padding: '1px 5px',
              borderRadius: 4,
              border: '1px solid rgba(229, 193, 88, 0.25)',
            }}
          >
            {formatCountdown(timeLeft)}
          </span>
        </Link>
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
                  <Icon size={24} strokeWidth={isSelected ? 2.3 : 2} />
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
