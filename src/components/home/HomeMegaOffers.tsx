import { useMemo } from 'react';
import { PromoCard } from '../PromoCard';
import type { HomeProduct, MegaOfertaConfig } from '../../types/home';
import type { Catalog } from '../../hooks/useCatalog';
import {
  getHomeProductPrice,
  hasCurrentPromotion,
  isHomeProductPurchasable,
  isWithinWindow,
  parseConfigDate,
} from '../../utils/homeProducts';
import { emptyMessage } from './homeMessages';

const FALLBACK_LIMIT = 8;

interface Item {
  key: string;
  product: HomeProduct;
  badge?: string;
  badgeStyle?: 'orange' | 'light';
  validUntil?: Date | null;
}

interface Props {
  catalog: Catalog;
  megaOfertas: MegaOfertaConfig[];
}

const formatDay = (date: Date) =>
  `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;

/**
 * MEGA OFERTAS.
 *  - Fonte: `home-config/data/mega-ofertas` (ordenada, respeitando `validUntil`).
 *  - Produto, preço, estoque e promoção vêm do documento oficial; o selo é o configurado.
 *  - Sem mega-ofertas válidas: mostra produtos reais com promoção vigente no catálogo
 *    (nunca produtos/descontos escritos no código). Sem promoções: estado vazio explicativo.
 */
export const HomeMegaOffers = ({ catalog, megaOfertas }: Props) => {
  const items = useMemo<Item[]>(() => {
    const now = new Date();
    const seen = new Set<string>();
    const configured: Item[] = [];
    for (const mo of megaOfertas) {
      if (seen.has(mo.productId) || !isWithinWindow(null, mo.validUntil, now)) continue;
      const product = catalog.byId.get(mo.productId);
      if (!product || !isHomeProductPurchasable(product)) continue;
      seen.add(mo.productId);
      configured.push({
        key: mo.id,
        product,
        badge: mo.badge,
        badgeStyle: mo.badgeStyle,
        validUntil: parseConfigDate(mo.validUntil, 'end'),
      });
    }
    if (configured.length > 0) return configured;

    const discount = (p: HomeProduct) => 1 - getHomeProductPrice(p, now) / p.price;
    return catalog.products
      .filter(p => isHomeProductPurchasable(p) && hasCurrentPromotion(p, now))
      .sort((a, b) => discount(b) - discount(a) || a.id.localeCompare(b.id))
      .slice(0, FALLBACK_LIMIT)
      .map(product => ({ key: `promo-${product.id}`, product }));
  }, [megaOfertas, catalog.byId, catalog.products]);

  // Subtítulo verdadeiro: só cita prazo quando alguma oferta exibida tem validade configurada.
  const subtitle = useMemo(() => {
    const dates = items.map(i => i.validUntil).filter((d): d is Date => d instanceof Date);
    if (dates.length === 0) return 'OFERTAS EM DESTAQUE';
    const earliest = dates.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
    return `VÁLIDAS ATÉ ${formatDay(earliest)}`;
  }, [items]);

  return (
    <section className="super-promo-container" aria-labelledby="home-mega-ofertas-title">
      <h2 id="home-mega-ofertas-title" className="super-promo-title">MEGA OFERTAS</h2>
      <div className="super-promo-subtitle">{subtitle}</div>

      {catalog.loading || items.length === 0 ? (
        <div className="section-state-message section-state-message--on-dark" role="status">
          {catalog.loading
            ? 'Carregando ofertas…'
            : emptyMessage(catalog.error, 'Nenhuma mega oferta ativa no momento. Volte em breve!')}
        </div>
      ) : (
        <div className="super-promo-scroll" role="group" aria-label="Mega ofertas" tabIndex={0}>
          {items.map(({ key, product, badge, badgeStyle }) => (
            <PromoCard key={key} {...product} badge={badge} badgeStyle={badgeStyle} />
          ))}
        </div>
      )}
    </section>
  );
};
