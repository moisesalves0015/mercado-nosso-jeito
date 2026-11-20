import { useMemo } from 'react';
import { PromoCard } from '../PromoCard';
import type { CondoFavoriteConfig } from '../../types/home';
import type { Catalog } from '../../hooks/useCatalog';
import { resolveHomeProducts } from '../../utils/homeProducts';
import { emptyMessage } from './homeMessages';

const FAVORITES_LIMIT = 10;

const DEFAULT_FALLBACK_FAVORITE_IDS = [
  'coca-cola-350ml',
  'monster-energy',
  'heineken-330ml',
  'paodequeijo-novo',
  'cafe-novo',
  'suco-dobem',
  'pao-de-forma',
  'queijo-minas',
  'manteiga-itambe',
  'peito-de-peru',
];

/**
 * Favoritos do Condomínio.
 *
 * Regra atual (documentada): lista CURADA pelo administrador em
 * `home-config/data/condo-favorites` ({ productId, order }). O ranking exibido (1, 2, 3…) é a
 * posição após ordenar e descartar produtos inexistentes/inativos/sem estoque — nenhum nome,
 * posição ou produto é gerado localmente.
 * Se nenhuma lista customizada foi configurada no admin, usa os favoritos padrão da loja.
 */
export const HomeCondoFavorites = ({ catalog, favorites }: { catalog: Catalog; favorites: CondoFavoriteConfig[] }) => {
  const products = useMemo(() => {
    const ids = favorites && favorites.length > 0
      ? favorites.map(f => f.productId)
      : DEFAULT_FALLBACK_FAVORITE_IDS;
    return resolveHomeProducts(ids, catalog.byId, FAVORITES_LIMIT);
  }, [favorites, catalog.byId]);

  return (
    <section className="section standard-section" style={{ margin: '24px 0 8px' }} aria-labelledby="home-favorites-title">
      <div className="section-header">
        <div className="section-header-left">
          <h2 id="home-favorites-title">Favoritos do Condomínio</h2>
        </div>
      </div>
      {catalog.loading || products.length === 0 ? (
        <div className="section-state-message" role="status">
          {catalog.loading
            ? 'Carregando favoritos…'
            : emptyMessage(catalog.error, 'Os favoritos do seu condomínio serão exibidos aqui em breve.')}
        </div>
      ) : (
        <div className="condo-favorites-scroll" role="group" aria-label="Favoritos do condomínio" tabIndex={0}>
          {products.map((product, index) => (
            <PromoCard key={product.id} {...product} rank={index + 1} />
          ))}
        </div>
      )}
    </section>
  );
};
