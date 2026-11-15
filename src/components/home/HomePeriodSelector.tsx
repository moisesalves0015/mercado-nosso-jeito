import { useMemo, useState, type CSSProperties } from 'react';
import { Section } from '../Section';
import { ProductCard } from '../ProductCard';
import type { HomePeriod, PeriodConfig } from '../../types/home';
import type { Catalog } from '../../hooks/useCatalog';
import { FALLBACK_PERIOD_PRODUCT_IDS, PERIOD_META, PERIOD_ORDER } from '../../data/homePeriods';
import {
  getPeriodForHour,
  resolveHomeProducts,
  resolveVitrineDestination,
} from '../../utils/homeProducts';
import { resolvePeriodIcon } from '../../utils/homeCategoryIcons';
import { isValidImageDataUrl } from '../../utils/imageUrl';
import { emptyMessage } from './homeMessages';

const PERIOD_LIMIT = 12;

interface Props {
  catalog: Catalog;
  periodConfig: Record<string, PeriodConfig>;
}

/**
 * "Os mais pedidos por horário" — Estilo 02 (Mercado Premium).
 *  - Botões de turno em formato horizontal compacto (pílula/chip baixo e alongado).
 *  - Vitrine com imagem de atmosfera do turno no background contínuo da seção (sem bordas laterais),
 *    e cartões de produto em glassmorphism limpo sobre o fundo.
 */
export const HomePeriodSelector = ({ catalog, periodConfig }: Props) => {
  const [activePeriod, setActivePeriod] = useState<HomePeriod>(() =>
    getPeriodForHour(new Date().getHours()),
  );
  const meta = PERIOD_META[activePeriod];
  const config = periodConfig[activePeriod];
  const candidateBg = config?.background || meta.background;
  const isCandidateDataUri = candidateBg ? candidateBg.startsWith('data:') : false;
  const activeBackground = isCandidateDataUri
    ? (isValidImageDataUrl(candidateBg) ? candidateBg : meta.background)
    : candidateBg;
  const isDataUri = activeBackground ? activeBackground.startsWith('data:') : false;

  const products = useMemo(() => {
    if (config && config.active === false) return [];
    const ids =
      config && config.productIds.length > 0
        ? config.productIds
        : FALLBACK_PERIOD_PRODUCT_IDS[activePeriod];
    return resolveHomeProducts(ids, catalog.byId, PERIOD_LIMIT);
  }, [config, activePeriod, catalog.byId]);

  const containerStyle = useMemo(() => {
    if (isDataUri) {
      return {
        position: 'relative',
        overflow: 'hidden',
      } as CSSProperties;
    }
    return {
      position: 'relative',
      overflow: 'hidden',
      backgroundImage: `linear-gradient(180deg, rgba(8, 20, 14, 0.28) 0%, rgba(5, 14, 10, 0.6) 100%), url("${activeBackground}")`,
      backgroundPosition: 'right center',
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat',
    } as CSSProperties;
  }, [activeBackground, isDataUri]);

  return (
    <div className="home-period-section">
      <div className="section-header" style={{ padding: '0 8px', marginBottom: '4px', marginTop: '4px' }}>
        <h2
          style={{
            margin: 0,
            fontSize: '13.5px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.2px',
          }}
        >
          Os mais pedidos por horário
        </h2>
      </div>

      <div
        className="period-buttons-row period-buttons-row--circle period-buttons-row--pill"
        role="group"
        aria-label="Escolher período do dia"
      >
        {PERIOD_ORDER.map((id) => {
          const item = PERIOD_META[id];
          const Icon = resolvePeriodIcon(id);
          const isSelected = activePeriod === id;
          return (
            <button
              key={id}
              className={`period-button period-button--circle period-button--pill ${isSelected ? 'active' : ''}`}
              onClick={() => setActivePeriod(id)}
              type="button"
              aria-label={`${item.label}: ${periodConfig[id]?.title || item.defaultTitle}`}
              aria-pressed={isSelected}
            >
              <span className="period-icon-circle period-icon-inline" aria-hidden="true">
                <Icon size={13} strokeWidth={isSelected ? 2.3 : 2} />
              </span>
              <span className="period-button-title">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="period-products-container period-products-container--premium" style={containerStyle}>
        {/* Renderiza imagem diretamente via <img> quando for Data URI para decodificação nativa segura sem ERR_INVALID_URL */}
        {isDataUri && (
          <>
            <img
              src={activeBackground}
              alt=""
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'right center',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(180deg, rgba(8, 20, 14, 0.28) 0%, rgba(5, 14, 10, 0.6) 100%)',
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />
          </>
        )}

        <div style={{ position: 'relative', zIndex: 1 }}>
          <Section
            title={config?.title || meta.defaultTitle}
            theme="hero"
            linkText="Ver tudo >"
            to={resolveVitrineDestination({}, products)}
            loading={catalog.loading}
            isEmpty={products.length === 0}
            emptyMessage={emptyMessage(
              catalog.error,
              'Ainda não há produtos selecionados para este horário.',
            )}
          >
            {products.map((product) => (
              <ProductCard key={product.id} {...product} glassEffect />
            ))}
          </Section>
        </div>
      </div>
    </div>
  );
};
