/**
 * Utilitários puros da Home (sem React/Firebase, para poderem ser testados com `node --test`).
 *
 * Decisões de fonte de dados:
 *  - Produtos: SEMPRE o documento oficial de `products`. Configurações editoriais (vitrines,
 *    períodos, mega-ofertas, favoritos) guardam apenas IDs; título, preço, imagem e estoque
 *    vêm do produto. IDs inexistentes/inativos/sem estoque são descartados sem quebrar a seção.
 *  - Preço: o valor exibido/adicionado ao carrinho é sempre `getHomeProductPrice`
 *    (productPricing), nunca um número vindo da configuração.
 */
import type {
  CondoFavoriteConfig,
  HomeCategoryLink,
  HeroBannerConfig,
  HomePeriod,
  HomeProduct,
  HomeTheme,
  HomeLayout,
  MegaOfertaConfig,
  PeriodConfig,
  VitrineConfig,
} from '../types/home';
import { getEffectiveProductPrice, parsePrice } from './productPricing';

// ─── Produto ────────────────────────────────────────────────────────────────

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asTrimmedString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Converte um documento de `products` em `HomeProduct`.
 * Retorna `null` quando o documento não tem ID/título (não pode ser exibido com segurança).
 */
export function normalizeHomeProduct(raw: unknown): HomeProduct | null {
  if (!isRecord(raw)) return null;
  const id = asTrimmedString(raw.id);
  const title = asTrimmedString(raw.title);
  if (!id || !title) return null;

  const rawStock = Number(raw.stock);
  const stock = Number.isFinite(rawStock) && rawStock > 0 ? Math.floor(rawStock) : 0;
  const price = parsePrice(raw.price as number | string | undefined);
  const promoPrice = parsePrice(raw.promoPrice as number | string | undefined);
  const diamondReward = Number(raw.diamondReward);
  const badge = asTrimmedString(raw.badge);

  return {
    id,
    title,
    price,
    image: asTrimmedString(raw.image),
    category: asTrimmedString(raw.category),
    stock,
    // Produtos arquivados (archivedAt) nunca aparecem na vitrine pública.
    active: raw.active !== false && !raw.archivedAt,
    promoActive: raw.promoActive === true,
    promoPrice: promoPrice > 0 ? promoPrice : undefined,
    promoExpiry: (raw.promoExpiry ?? null) as HomeProduct['promoExpiry'],
    badge: badge || undefined,
    badgeStyle: raw.badgeStyle === 'light' ? 'light' : raw.badgeStyle === 'orange' ? 'orange' : undefined,
    diamondReward: Number.isFinite(diamondReward) && diamondReward > 0 ? Math.floor(diamondReward) : undefined,
  };
}

/** Preço efetivo (regular ou promocional vigente) — mesma regra da busca, detalhe e carrinho. */
export const getHomeProductPrice = (product: HomeProduct, now = new Date()): number =>
  getEffectiveProductPrice(product, now);

/** Produto existente, ativo, com preço e estoque: único estado em que a Home o oferece. */
export const isHomeProductPurchasable = (product: HomeProduct): boolean =>
  product.active && product.stock > 0 && product.price > 0;

/** Promoção realmente vigente agora (preço efetivo menor que o regular). */
export const hasCurrentPromotion = (product: HomeProduct, now = new Date()): boolean =>
  product.promoActive === true && getHomeProductPrice(product, now) < product.price;

/**
 * Resolve uma lista de IDs configurados em produtos reais: ordem preservada,
 * sem duplicatas, sem produtos indisponíveis, respeitando `limit`.
 */
export function resolveHomeProducts(
  ids: readonly string[],
  byId: ReadonlyMap<string, HomeProduct>,
  limit = Number.POSITIVE_INFINITY,
): HomeProduct[] {
  const seen = new Set<string>();
  const result: HomeProduct[] = [];
  for (const id of ids) {
    if (result.length >= limit) break;
    if (seen.has(id)) continue;
    seen.add(id);
    const product = byId.get(id);
    if (product && isHomeProductPurchasable(product)) result.push(product);
  }
  return result;
}

/** IDs configurados que não existem no catálogo (útil para avisar o painel administrativo). */
export const findMissingProductIds = (
  ids: readonly string[],
  byId: ReadonlyMap<string, HomeProduct>,
): string[] => ids.filter(id => !byId.has(id));

// ─── Datas / vigência ───────────────────────────────────────────────────────

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Interpreta datas de configuração. Datas sem hora (`YYYY-MM-DD`, vindas do input type=date do
 * painel) valem no horário local: início do dia para `validFrom`, fim do dia para `validUntil`.
 */
export function parseConfigDate(value: unknown, edge: 'start' | 'end'): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    if (DATE_ONLY.test(text)) {
      const [y, m, d] = text.split('-').map(Number);
      return edge === 'start' ? new Date(y, m - 1, d, 0, 0, 0, 0) : new Date(y, m - 1, d, 23, 59, 59, 999);
    }
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (isRecord(value)) {
    if (typeof value.toDate === 'function') {
      try {
        return parseConfigDate((value.toDate as () => Date)(), edge);
      } catch {
        return null;
      }
    }
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  }
  return null;
}

/** Vigente quando `agora` está entre validFrom e validUntil (limites ausentes = sem limite). */
export function isWithinWindow(
  validFrom: unknown,
  validUntil: unknown,
  now = new Date(),
): boolean {
  const from = parseConfigDate(validFrom, 'start');
  const until = parseConfigDate(validUntil, 'end');
  // Data preenchida porém ilegível => configuração inválida => não exibir.
  if ((validFrom && !from) || (validUntil && !until)) return false;
  if (from && now.getTime() < from.getTime()) return false;
  if (until && now.getTime() > until.getTime()) return false;
  return true;
}

// ─── Links ──────────────────────────────────────────────────────────────────

export type ResolvedLink = { kind: 'internal'; href: string } | { kind: 'external'; href: string };

/** Aceita apenas rota interna (`/algo`) ou http(s). Bloqueia `javascript:`, `//host` etc. */
export function resolveLink(value: unknown): ResolvedLink | null {
  const text = asTrimmedString(value);
  if (!text) return null;
  if (text.startsWith('/') && !text.startsWith('//') && !/\s/.test(text)) {
    return { kind: 'internal', href: text };
  }
  if (/^https?:\/\/[^\s]+$/i.test(text)) return { kind: 'external', href: text };
  return null;
}

// ─── Busca (contrato compartilhado com /search) ─────────────────────────────

/** Normaliza o texto digitado: sem caracteres de controle, espaços colapsados, até 80 caracteres. */
export function normalizeSearchQuery(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f]/g, ' ').normalize('NFC').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/** Monta `/search?q=...&category=...`; `null` quando não há nada a buscar. */
export function buildSearchPath(query?: string, category?: string): string | null {
  const q = normalizeSearchQuery(query ?? '');
  const cat = normalizeSearchQuery(category ?? '');
  if (!q && !cat) return null;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (cat) params.set('category', cat);
  return `/search?${params.toString()}`;
}

// ─── Período do dia ─────────────────────────────────────────────────────────

export function getPeriodForHour(hour: number): HomePeriod {
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 14) return 'lunch';
  if (hour >= 14 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 24) return 'night';
  return 'dawn';
}

// ─── Normalização da configuração ───────────────────────────────────────────

export interface ConfigIssue {
  scope: 'vitrines' | 'period-config' | 'mega-ofertas' | 'hero-banners' | 'condo-favorites';
  id: string;
  message: string;
}

const THEMES: HomeTheme[] = ['hero', 'purple', 'orange', 'green'];
const LAYOUTS: HomeLayout[] = ['horizontal', 'grid', 'carousel'];
const PERIODS: HomePeriod[] = ['morning', 'lunch', 'afternoon', 'night', 'dawn'];

const toOrder = (value: unknown): number => (Number.isFinite(Number(value)) ? Number(value) : 0);

function toIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value.map(asTrimmedString).filter(Boolean);
  return Array.from(new Set(ids));
}

/** `subtitle` pode ser string ou string[]: o contrato interno é sempre string[]. */
export function normalizeSubtitle(value: unknown): string[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.map(asTrimmedString).filter(Boolean);
}

/** Ordenação estável: por `order` e, em empate, por `id` (evita saltos entre renders). */
export const byOrderThenId = <T extends { order: number; id: string }>(a: T, b: T): number =>
  a.order - b.order || a.id.localeCompare(b.id);

export type NormalizedVitrine = Omit<VitrineConfig, 'subtitle'> & { subtitle: string[] };

export function normalizeVitrine(id: string, raw: unknown): { value: NormalizedVitrine | null; issues: ConfigIssue[] } {
  const issues: ConfigIssue[] = [];
  if (!isRecord(raw)) {
    return { value: null, issues: [{ scope: 'vitrines', id, message: 'Documento inválido.' }] };
  }
  const title = asTrimmedString(raw.title);
  if (!title) {
    return { value: null, issues: [{ scope: 'vitrines', id, message: 'Vitrine sem título; ignorada.' }] };
  }
  const productIds = toIdList(raw.productIds);
  if (productIds.length === 0) issues.push({ scope: 'vitrines', id, message: 'Vitrine sem produtos configurados.' });

  const maxRaw = Math.floor(Number(raw.maxProducts));
  const linkTo = resolveLink(raw.linkTo);
  if (raw.linkTo && !linkTo) issues.push({ scope: 'vitrines', id, message: 'linkTo inválido; será ignorado.' });

  return {
    value: {
      id,
      title,
      subtitle: normalizeSubtitle(raw.subtitle),
      theme: THEMES.includes(raw.theme as HomeTheme) ? (raw.theme as HomeTheme) : 'green',
      active: raw.active !== false,
      order: toOrder(raw.order),
      layout: LAYOUTS.includes(raw.layout as HomeLayout) ? (raw.layout as HomeLayout) : 'horizontal',
      maxProducts: Number.isFinite(maxRaw) && maxRaw > 0 ? Math.min(maxRaw, 30) : 10,
      productIds,
      validFrom: asTrimmedString(raw.validFrom) || null,
      validUntil: asTrimmedString(raw.validUntil) || null,
      linkTo: linkTo?.kind === 'internal' ? linkTo.href : undefined,
      category: asTrimmedString(raw.category) || undefined,
    },
    issues,
  };
}

export function normalizePeriodConfig(id: string, raw: unknown): { value: PeriodConfig | null; issues: ConfigIssue[] } {
  if (!PERIODS.includes(id as HomePeriod) || !isRecord(raw)) {
    return { value: null, issues: [{ scope: 'period-config', id, message: 'Período desconhecido ou inválido.' }] };
  }
  return {
    value: {
      id: id as HomePeriod,
      title: asTrimmedString(raw.title),
      active: raw.active !== false,
      productIds: toIdList(raw.productIds),
      isAuto: raw.isAuto === true,
    },
    issues: [],
  };
}

export function normalizeMegaOferta(id: string, raw: unknown): { value: MegaOfertaConfig | null; issues: ConfigIssue[] } {
  const productId = isRecord(raw) ? asTrimmedString(raw.productId) : '';
  if (!isRecord(raw) || !productId) {
    return { value: null, issues: [{ scope: 'mega-ofertas', id, message: 'Mega-oferta sem productId; ignorada.' }] };
  }
  const badge = asTrimmedString(raw.badge);
  return {
    value: {
      id,
      productId,
      order: toOrder(raw.order),
      badge: badge || undefined,
      badgeStyle: raw.badgeStyle === 'light' ? 'light' : 'orange',
      validUntil: asTrimmedString(raw.validUntil) || null,
    },
    issues: [],
  };
}

export function normalizeHeroBanner(id: string, raw: unknown): { value: HeroBannerConfig | null; issues: ConfigIssue[] } {
  if (!isRecord(raw)) {
    return { value: null, issues: [{ scope: 'hero-banners', id, message: 'Documento inválido.' }] };
  }
  const title = asTrimmedString(raw.title);
  const image = asTrimmedString(raw.image);
  if (!title && !image) {
    return { value: null, issues: [{ scope: 'hero-banners', id, message: 'Banner sem título e sem imagem; ignorado.' }] };
  }
  const issues: ConfigIssue[] = [];
  const link = resolveLink(raw.link);
  if (raw.link && !link) issues.push({ scope: 'hero-banners', id, message: 'Link inválido; banner ficará sem destino.' });
  if (!image) issues.push({ scope: 'hero-banners', id, message: 'Banner sem imagem; será exibido o título em texto.' });
  return {
    value: {
      id,
      title,
      subtitle: asTrimmedString(raw.subtitle),
      image,
      link: link?.href ?? '',
      badgeText: asTrimmedString(raw.badgeText) || undefined,
      badgeIcon: asTrimmedString(raw.badgeIcon) || undefined,
      buttonText: asTrimmedString(raw.buttonText),
      highlightWords: Array.isArray(raw.highlightWords) ? (raw.highlightWords as HeroBannerConfig['highlightWords']) : [],
      order: toOrder(raw.order),
    },
    issues,
  };
}

export function normalizeCondoFavorite(id: string, raw: unknown): { value: CondoFavoriteConfig | null; issues: ConfigIssue[] } {
  const productId = isRecord(raw) ? asTrimmedString(raw.productId) : '';
  if (!productId) {
    return { value: null, issues: [{ scope: 'condo-favorites', id, message: 'Favorito sem productId; ignorado.' }] };
  }
  return { value: { id, productId, order: toOrder((raw as Record<string, unknown>).order) }, issues: [] };
}

// ─── Destino do "Ver tudo" ──────────────────────────────────────────────────

/**
 * Destino de uma vitrine: `linkTo` > `category` configurada > categoria predominante entre os
 * produtos reais da vitrine. Sem nenhum dos três, devolve `undefined` (o link não é exibido,
 * em vez de apontar para `#`).
 */
export function resolveVitrineDestination(
  vitrine: Pick<NormalizedVitrine, 'linkTo' | 'category'>,
  products: readonly HomeProduct[],
): string | undefined {
  if (vitrine.linkTo) return vitrine.linkTo;
  if (vitrine.category) return buildSearchPath('', vitrine.category) ?? undefined;
  const counts = new Map<string, number>();
  for (const p of products) if (p.category) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  let best = '';
  let bestCount = 0;
  counts.forEach((count, category) => {
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  });
  return best ? buildSearchPath('', best) ?? undefined : undefined;
}

// ─── Destino de categorias declarativas ─────────────────────────────────────

/** Converte um HomeCategoryLink em href interno seguro (sempre uma rota válida do app). */
export function getCategoryHref(link: Pick<HomeCategoryLink, 'type' | 'target'>): string {
  switch (link.type) {
    case 'route': {
      const resolved = resolveLink(link.target);
      return resolved?.kind === 'internal' ? resolved.href : '/categories';
    }
    case 'category':
      return buildSearchPath('', link.target) ?? '/search';
    case 'search':
    default:
      return buildSearchPath(link.target) ?? '/search';
  }
}
