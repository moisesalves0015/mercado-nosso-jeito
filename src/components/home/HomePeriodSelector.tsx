import { useMemo, useState } from 'react';
import { Section } from '../Section';
import { ProductCard } from '../ProductCard';
import type { HomePeriod } from '../../types/home';
import type { PeriodConfig } from '../../types/home';
import type { Catalog } from '../../hooks/useCatalog';
import { FALLBACK_PERIOD_PRODUCT_IDS, PERIOD_META, PERIOD_ORDER } from '../../data/homePeriods';
import { getPeriodForHour, resolveHomeProducts, resolveVitrineDestination } from '../../utils/homeProducts';
import { emptyMessage } from './homeMessages';

const PERIOD_LIMIT = 12;

interface Props {
  catalog: Catalog;
  periodConfig: Record<string, PeriodConfig>;
}

/**
 * "Os mais pedidos por horário".
 *  - Estado inicial = período do horário atual; seleção manual depois.
 *  - Produtos: `period-config/{periodo}.productIds`; sem configuração usa os IDs editoriais de
 *    src/data/homePeriods.ts (apenas IDs — cada um precisa existir/ativo/com estoque no catálogo).
 *  - Período explicitamente desativado no painel (`active: false`) mostra estado vazio.
 */
export const HomePeriodSelector = ({ catalog, periodConfig }: Props) => {
  const [activePeriod, setActivePeriod] = useState<HomePeriod>(() => getPeriodForHour(new Date().getHours()));
  const meta = PERIOD_META[activePeriod];
  const config = periodConfig[activePeriod];

  const products = useMemo(() => {
    if (config && config.active === false) return [];
    const ids = config && config.productIds.length > 0 ? config.productIds : FALLBACK_PERIOD_PRODUCT_IDS[activePeriod];
    return resolveHomeProducts(ids, catalog.byId, PERIOD_LIMIT);
  }, [config, activePeriod, catalog.byId]);

  return (
    <>
      <div className="section-header" style={{ padding: '0 8px', marginBottom: '2px', marginTop: '2px' }}>
        <h2 style={{ margin: 0, fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>Os mais pedidos por horário</h2>
      </div>

      <div className="period-buttons-row" role="group" aria-label="Escolher período do dia">
        {PERIOD_ORDER.map(id => {
          const item = PERIOD_META[id];
          return (
            <button
              key={id}
              className={`period-button ${activePeriod === id ? 'active' : ''}`}
              onClick={() => setActivePeriod(id)}
              style={{ backgroundImage: `url(${item.background})` }}
              type="button"
              aria-label={`${item.label}: ${periodConfig[id]?.title || item.defaultTitle}`}
              aria-pressed={activePeriod === id}
            >
              <div className="period-button-text">
                <span className="period-button-title">{item.label}</span>
                <span className="period-button-subtitle">{item.buttonSubtitle}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div
        className="period-products-container"
        style={{
          backgroundImage: `url(${meta.background})`,
          backgroundSize: 'cover',
          backgroundPosition: 'right center',
          backgroundRepeat: 'no-repeat',
          paddingTop: '4px',
          paddingBottom: '4px',
          marginBottom: '16px',
        }}
      >
        <Section
          title={config?.title || meta.defaultTitle}
          theme="hero"
          linkText="Ver tudo >"
          to={resolveVitrineDestination({}, products)}
          loading={catalog.loading}
          isEmpty={products.length === 0}
          emptyMessage={emptyMessage(catalog.error, 'Ainda não há produtos selecionados para este horário.')}
        >
          {products.map(product => (
            <ProductCard key={product.id} {...product} glassEffect />
          ))}
        </Section>
      </div>
    </>
  );
};
