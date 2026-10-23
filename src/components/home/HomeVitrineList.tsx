import { Section } from '../Section';
import { ProductCard } from '../ProductCard';
import type { Showcase } from '../../utils/homeShowcases';
import type { Catalog } from '../../hooks/useCatalog';
import { emptyMessage } from './homeMessages';

interface Props {
  showcases: Showcase[];
  catalog: Catalog;
}

/** Vitrines configuradas (ou o fallback por categoria já resolvido em `buildShowcases`). */
export const HomeVitrineList = ({ showcases, catalog }: Props) => (
  <>
    {showcases.map(showcase => (
      <Section
        key={showcase.key}
        title={showcase.title}
        subtitle={showcase.subtitle}
        linkText="Ver tudo >"
        to={showcase.to}
        theme={showcase.theme}
        layout={showcase.layout}
        loading={catalog.loading}
        isEmpty={showcase.products.length === 0}
        emptyMessage={emptyMessage(
          catalog.error,
          showcase.missingIds.length > 0
            ? 'Os produtos desta vitrine estão indisponíveis no momento.'
            : 'Nenhum produto disponível nesta vitrine no momento.',
        )}
      >
        {showcase.products.map(product => (
          <ProductCard key={product.id} {...product} />
        ))}
      </Section>
    ))}
  </>
);
