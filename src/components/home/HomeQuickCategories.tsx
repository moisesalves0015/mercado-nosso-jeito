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

function splitCountdown(totalSeconds: number): { h: string; m: string; s: string } {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    h: pad(hours),
    m: pad(minutes),
    s: pad(seconds),
  };
}

/**
 * Atalhos rápidos de categoria na Home (Promoções, Doces, Biscoitos, Higiene, Limpeza, Combos e Ver todas),
 * no Estilo 02 — Mercado Premium compacto: ícone vetorial dentro de um círculo + título fora do círculo, abaixo dele,
 * dimensionados proporcionalmente para caber na largura da tela sem scroll horizontal desnecessário.
 * Inclui cabeçalho alinhado com título e frase de Oferta Relâmpago | termina em 00:00:00 com blocos vermelhos nos dígitos.
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

  const { h, m, s } = splitCountdown(timeLeft);

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
          flexWrap: 'nowrap',
          gap: 6,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '12.5px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.2px',
            flexShrink: 0,
          }}
        >
          Categorias
        </h2>

        {/* (icon de raio) Oferta Relâmpago | termina em 00:00:00 */}
        <Link
          to="/promotions"
          className="flash-offer-countdown-badge"
          title="Ver Ofertas Relâmpago"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'transparent',
            border: 'none',
            textDecoration: 'none',
            color: 'inherit',
            flexShrink: 0,
          }}
        >
          {/* Ícone de raio + Oferta Relâmpago em amarelo */}
          <span
            className="flash-offer-label"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              color: '#FFDF73',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '-0.1px',
            }}
          >
            <Zap size={12} fill="#FFDF73" strokeWidth={1} style={{ flexShrink: 0 }} />
            <span>Oferta Relâmpago</span>
          </span>

          {/* Separador | */}
          <span
            style={{
              color: 'rgba(255, 255, 255, 0.4)',
              fontSize: 10,
              fontWeight: 400,
              margin: '0 1px',
            }}
          >
            |
          </span>

          {/* termina em em branco */}
          <span
            className="flash-offer-termina"
            style={{
              color: '#ffffff',
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: '-0.1px',
            }}
          >
            termina em
          </span>

          {/* Fundo vermelho separado nas horas, minutos e segundos, números em branco */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              marginLeft: 2,
            }}
          >
            <span className="flash-offer-digit-box">{h}</span>
            <span className="flash-offer-colon">:</span>
            <span className="flash-offer-digit-box">{m}</span>
            <span className="flash-offer-colon">:</span>
            <span className="flash-offer-digit-box">{s}</span>
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
