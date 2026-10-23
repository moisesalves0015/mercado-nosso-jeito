/**
 * Monta as vitrines exibidas na Home a partir da configuração + catálogo real.
 *
 * Regras:
 *  - só vitrines ativas e vigentes (`validFrom`/`validUntil`), em ordem estável;
 *  - produtos resolvidos pelo documento oficial (existentes, ativos, com estoque), sem repetir
 *    e limitados por `maxProducts`;
 *  - sem nenhuma vitrine configurada/vigente → fallback por categoria usando SOMENTE produtos
 *    reais do catálogo (nunca produtos ou preços escritos no código).
 */
import type { HomeLayout, HomeProduct, HomeTheme, VitrineConfig } from '../types/home';
import {
  buildSearchPath,
  byOrderThenId,
  findMissingProductIds,
  isHomeProductPurchasable,
  isWithinWindow,
  normalizeSubtitle,
  resolveHomeProducts,
  resolveVitrineDestination,
} from './homeProducts';

export interface Showcase {
  key: string;
  title: string;
  subtitle: string[];
  theme: HomeTheme;
  layout: HomeLayout;
  products: HomeProduct[];
  /** Destino do "Ver tudo" (undefined = sem link). */
  to?: string;
  /** IDs configurados que não existem no catálogo (diagnóstico). */
  missingIds: string[];
}

const normalizeCategory = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

interface FallbackShowcase {
  key: string;
  title: string;
  subtitle: string[];
  theme: HomeTheme;
  to: string;
  matches: (normalizedCategory: string) => boolean;
}

/** Vitrines padrão por categoria (editorial). Só os filtros e textos são fixos — os produtos não. */
const FALLBACK_SHOWCASES: FallbackShowcase[] = [
  {
    key: 'fallback-bebidas',
    title: 'Bebidas',
    subtitle: ['Gelada é aqui! 🧊', 'As melhores marcas', 'Refresque seu dia'],
    theme: 'purple',
    to: '/bebidas',
    matches: c => c === 'bebidas',
  },
  {
    key: 'fallback-alimentos',
    title: 'Alimentos',
    subtitle: ['Descubra novidades exclusivas!', 'Sabor inconfundível', 'Ofertas especiais'],
    theme: 'orange',
    to: buildSearchPath('', 'Alimentos') ?? '/search',
    matches: c => ['alimentos', 'cafe', 'padaria'].includes(c),
  },
  {
    key: 'fallback-limpeza',
    title: 'Limpeza',
    subtitle: ['Deixe tudo brilhando ✨', 'Limpeza pesada', 'Fragrâncias únicas'],
    theme: 'green',
    to: buildSearchPath('', 'Limpeza') ?? '/search',
    matches: c => c.includes('limpeza'),
  },
];

export const FALLBACK_SHOWCASE_LIMIT = 10;

export function buildShowcases(
  vitrines: readonly VitrineConfig[],
  products: readonly HomeProduct[],
  byId: ReadonlyMap<string, HomeProduct>,
  now = new Date(),
): Showcase[] {
  const current = vitrines
    .filter(v => v.active && isWithinWindow(v.validFrom, v.validUntil, now))
    .slice()
    .sort(byOrderThenId);

  if (current.length > 0) {
    return current.map(v => {
      const resolved = resolveHomeProducts(v.productIds, byId, v.maxProducts);
      return {
        key: v.id,
        title: v.title,
        subtitle: normalizeSubtitle(v.subtitle),
        theme: v.theme,
        layout: v.layout,
        products: resolved,
        to: resolveVitrineDestination(v, resolved),
        missingIds: findMissingProductIds(v.productIds, byId),
      };
    });
  }

  return FALLBACK_SHOWCASES.map(fb => {
    const items = products
      .filter(p => isHomeProductPurchasable(p) && fb.matches(normalizeCategory(p.category)))
      .slice(0, FALLBACK_SHOWCASE_LIMIT);
    return {
      key: fb.key,
      title: fb.title,
      subtitle: fb.subtitle,
      theme: fb.theme,
      layout: 'horizontal' as const,
      products: items,
      to: fb.to,
      missingIds: [],
    };
  });
}
