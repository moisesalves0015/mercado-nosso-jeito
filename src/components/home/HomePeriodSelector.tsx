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
import { emptyMessage } from './homeMessages';

const PERIOD_LIMIT = 12;

interface Props {
  catalog: Catalog;
  periodConfig: Record<string, PeriodConfig>;
}

/**
 * "Os mais pedidos por horário" — Estilo 02 (Mercado Premium).
 *  - Botões de turno da mesma família visual das categorias (ícone vetorial dentro do círculo + rótulo fora, abaixo).
 *  - Estado inicial = período do horário atual; seleção manual atualiza título e produtos.
 *  - Painel da vitrine em verde-floresta limpo; a imagem de atmosfera do turno (`meta.background`)
 *    fica exclusivamente no background de cada cartão de produto com efeito embaçado (`blur`).
 */
export const HomePeriodSelector = ({ catalog, periodConfig }: Props) => {
  const [activePeriod, setActivePeriod] = useState<HomePeriod>(() =>
    getPeriodForHour(new Date().getHours()),
  );
  const meta = PERIOD_META[activePeriod];
  const config = periodConfig[activePeriod];

  const products = useMemo(() => {
    if (config && config.active === false) return [];
    const ids =
      config && config.productIds.length > 0
        ? config.productIds
        : FALLBACK_PERIOD_PRODUCT_IDS[activePeriod];
    return resolveHomeProducts(ids, catalog.byId, PERIOD_LIMIT);
  }, [config, activePeriod, catalog.byId]);

  const containerStyle = useMemo(
    () =>
      ({
        '--period-card-bg': `url(${meta.background})`,
      }) as CSSProperties,
    [meta.background],
  );

  return (
    <div className="home-period-section">
      <div className="section-header" style={{ padding: '0 8px', marginBottom: '6px', marginTop: '6px' }}>
        <h2
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.2px',
          }}
        >
          Os mais pedidos por horário
        </h2>
      </div>

      <div
        className="period-buttons-row period-buttons-row--circle"
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
              className={`period-button period-button--circle ${isSelected ? 'active' : ''}`}
              onClick={() => setActivePeriod(id)}
              type="button"
              aria-label={`${item.label}: ${periodConfig[id]?.title || item.defaultTitle}`}
              aria-pressed={isSelected}
            >
              <span className="period-icon-circle" aria-hidden="true">
                <Icon size={21} strokeWidth={isSelected ? 2.25 : 1.9} />
              </span>
              <span className="period-button-title">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="period-products-container period-products-container--premium" style={containerStyle}>
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
  );
};
