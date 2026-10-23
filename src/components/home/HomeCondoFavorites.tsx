import { useMemo } from 'react';
import { Heart } from 'lucide-react';
import { PromoCard } from '../PromoCard';
import type { CondoFavoriteConfig } from '../../types/home';
import type { Catalog } from '../../hooks/useCatalog';
import { resolveHomeProducts } from '../../utils/homeProducts';
import { emptyMessage } from './homeMessages';

const FAVORITES_LIMIT = 10;

/**
 * Favoritos do Condomínio.
 *
 * Regra atual (documentada): lista CURADA pelo administrador em
 * `home-config/data/condo-favorites` ({ productId, order }). O ranking exibido (1, 2, 3…) é a
 * posição após ordenar e descartar produtos inexistentes/inativos/sem estoque — nenhum nome,
 * posição ou produto é gerado localmente.
 * Evolução prevista: agregação real de pedidos por condomínio (Cloud Function) escrevendo nesta
 * mesma coleção, sem mudar este componente.
 */
export const HomeCondoFavorites = ({ catalog, favorites }: { catalog: Catalog; favorites: CondoFavoriteConfig[] }) => {
  const products = useMemo(
    () => resolveHomeProducts(favorites.map(f => f.productId), catalog.byId, FAVORITES_LIMIT),
    [favorites, catalog.byId],
  );

  return (
    <section style={{ margin: '24px 0 8px' }} aria-labelledby="home-favorites-title">
      <div className="section-header" style={{ padding: '0 8px', marginBottom: '10px' }}>
        <h2 id="home-favorites-title" style={{ margin: 0, fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.2px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Heart size={14} fill="#f87171" color="#f87171" aria-hidden="true" />
          Favoritos do Condomínio
        </h2>
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
