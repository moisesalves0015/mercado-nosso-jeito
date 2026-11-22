import type { HomeProduct, UpsellShowcaseConfig, UpsellShowcaseId } from '../types/home';
import { hasCurrentPromotion, isHomeProductPurchasable, resolveHomeProducts } from './homeProducts';

export function defaultUpsellConfig(id: UpsellShowcaseId): UpsellShowcaseConfig {
  return {
    id,
    title: 'Leve também',
    active: true,
    isAuto: true,
    productIds: [],
    maxProducts: id === 'cart' ? 8 : 6,
  };
}

export function normalizeUpsellConfig(
  id: UpsellShowcaseId,
  raw: Record<string, unknown> | undefined | null,
): UpsellShowcaseConfig {
  const base = defaultUpsellConfig(id);
  if (!raw || typeof raw !== 'object') return base;
  const maxProducts =
    typeof raw.maxProducts === 'number' && Number.isFinite(raw.maxProducts) && raw.maxProducts >= 1
      ? Math.min(20, Math.floor(raw.maxProducts))
      : base.maxProducts;
  return {
    id,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 60) : base.title,
    active: raw.active !== false,
    isAuto: raw.isAuto !== false,
    productIds: Array.isArray(raw.productIds)
      ? raw.productIds.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : [],
    maxProducts,
  };
}

function norm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

type ProductCluster =
  | 'coffee_bakery'
  | 'beverage'
  | 'alcohol'
  | 'sweet_candy'
  | 'savory_snack'
  | 'dairy_cold'
  | 'grocery_meal'
  | 'cleaning_hygiene';

const CANDY_KEYWORDS = [
  'chocolate',
  'bombom',
  'doce',
  'bala',
  'chiclete',
  'pirulito',
  'biscoito',
  'bolacha',
  'cookie',
  'brownie',
  'nutella',
  'kinder',
  'lacta',
  'bis',
  'ouro branco',
  'sonho de valsa',
  'snickers',
  'twix',
  'kitkat',
  'kit kat',
  'hershey',
  'haribo',
  'fini',
  'trident',
  'mentos',
  'halls',
  'sorvete',
  'picole',
  'sobremesa',
  'paçoquinha',
  'pacoca',
  'brigadeiro',
  'pudim',
  'alfajor',
  'wafer',
  'prestigio',
  'diamante negro',
  'alpino',
  'talento',
  'serenata',
  'guloseima',
  'chocolates',
  'doces',
];

const SAVORY_SNACK_KEYWORDS = [
  'salgadinho',
  'doritos',
  'ruffles',
  'cheetos',
  'elma',
  'pringles',
  'pipoca',
  'amendoim',
  'castanha',
  'batata',
  'snack',
  'torrada',
  'biscoito salgado',
  'cream cracker',
];

const COFFEE_BAKERY_KEYWORDS = [
  'cafe',
  'cappuccino',
  'melitta',
  'pilao',
  'nescafe',
  'pao',
  'bolo',
  'manteiga',
  'requeijao',
  'geleia',
  'leite',
  'achocolatado',
  'nescau',
  'toddy',
  'croissant',
];

const ALCOHOL_KEYWORDS = [
  'cerveja',
  'heineken',
  'spaten',
  'brahma',
  'skol',
  'stella',
  'corona',
  'budweiser',
  'vinho',
  'vodka',
  'whisky',
  'gin',
  'chopp',
  'ice',
];

const BEVERAGE_KEYWORDS = [
  'refrigerante',
  'coca',
  'guarana',
  'pepsi',
  'fanta',
  'sprite',
  'suco',
  'agua',
  'energetico',
  'monster',
  'red bull',
  'cha',
  'isotônico',
  'isotonico',
  'h2oh',
  'tonica',
];

const DAIRY_COLD_KEYWORDS = [
  'queijo',
  'presunto',
  'peito de peru',
  'iogurte',
  'danone',
  'mussarela',
  'mortadela',
  'salame',
];

function classifyProduct(title: string, category = ''): ProductCluster {
  const hay = `${norm(category)} ${norm(title)}`;
  if (CANDY_KEYWORDS.some((k) => hay.includes(k))) return 'sweet_candy';
  if (SAVORY_SNACK_KEYWORDS.some((k) => hay.includes(k))) return 'savory_snack';
  if (ALCOHOL_KEYWORDS.some((k) => hay.includes(k))) return 'alcohol';
  if (COFFEE_BAKERY_KEYWORDS.some((k) => hay.includes(k))) return 'coffee_bakery';
  if (DAIRY_COLD_KEYWORDS.some((k) => hay.includes(k))) return 'dairy_cold';
  if (BEVERAGE_KEYWORDS.some((k) => hay.includes(k)) || norm(category).includes('bebida')) {
    return 'beverage';
  }
  if (norm(category).includes('limpeza') || norm(category).includes('higiene')) {
    return 'cleaning_hygiene';
  }
  return 'grocery_meal';
}

const COMPLEMENTARY_MATRIX: Record<ProductCluster, Partial<Record<ProductCluster, number>>> = {
  coffee_bakery: {
    dairy_cold: 5,
    coffee_bakery: 4,
    sweet_candy: 3,
    beverage: 2,
  },
  beverage: {
    savory_snack: 5,
    sweet_candy: 4,
    dairy_cold: 3,
    beverage: 1,
  },
  alcohol: {
    savory_snack: 6,
    dairy_cold: 4,
    beverage: 3,
    sweet_candy: 2,
  },
  sweet_candy: {
    beverage: 5,
    coffee_bakery: 3,
    sweet_candy: 3,
  },
  savory_snack: {
    beverage: 5,
    alcohol: 4,
    sweet_candy: 3,
    savory_snack: 2,
  },
  dairy_cold: {
    coffee_bakery: 5,
    beverage: 3,
    savory_snack: 3,
  },
  grocery_meal: {
    beverage: 5,
    sweet_candy: 4,
    dairy_cold: 3,
    coffee_bakery: 2,
  },
  cleaning_hygiene: {
    cleaning_hygiene: 4,
    beverage: 3,
    sweet_candy: 2,
  },
};

export interface CartSeedItem {
  id: string;
  title: string;
  category?: string;
}

/**
 * Monta os produtos da vitrine "Leve também" do Carrinho.
 * - Modo manual (`!config.isAuto`): usa exatamente os produtos escolhidos no Admin.
 * - Modo auto (`config.isAuto`): recomenda itens disponíveis que combinam com os itens já no carrinho.
 */
export function buildCartComplementaryProducts({
  config,
  cartItems,
  products,
  productsById,
}: {
  config: UpsellShowcaseConfig;
  cartItems: readonly CartSeedItem[];
  products: readonly HomeProduct[];
  productsById: ReadonlyMap<string, HomeProduct>;
}): HomeProduct[] {
  if (!config.active) return [];

  const inCartIds = new Set(cartItems.map((c) => c.id));
  const manualResolved = resolveHomeProducts(config.productIds, productsById, config.maxProducts).filter(
    (p) => !inCartIds.has(p.id),
  );

  if (!config.isAuto) {
    return manualResolved;
  }

  const cartClusters = new Set<ProductCluster>();
  const cartCategories = new Set<string>();
  for (const item of cartItems) {
    const prod = productsById.get(item.id);
    const cat = prod?.category || item.category || '';
    if (cat) cartCategories.add(norm(cat));
    cartClusters.add(classifyProduct(prod?.title || item.title, cat));
  }

  const now = new Date();
  const seen = new Set<string>(manualResolved.map((p) => p.id));

  const scored = products
    .filter((p) => !inCartIds.has(p.id) && !seen.has(p.id) && isHomeProductPurchasable(p))
    .map((p) => {
      const cluster = classifyProduct(p.title, p.category);
      let score = 0;

      for (const cc of cartClusters) {
        score += COMPLEMENTARY_MATRIX[cc]?.[cluster] ?? 0;
      }

      // Complemento diferente da categoria já no carrinho ganha leve bônus para variedade
      if (p.category && !cartCategories.has(norm(p.category))) {
        score += 1.5;
      }
      if (hasCurrentPromotion(p, now)) {
        score += 2;
      }
      if (p.price <= 25) {
        score += 1;
      }

      return { product: p, score };
    })
    .sort((a, b) => b.score - a.score || a.product.price - b.product.price || a.product.id.localeCompare(b.product.id))
    .map((entry) => entry.product);

  return [...manualResolved, ...scored].slice(0, config.maxProducts);
}

/**
 * Monta os produtos da vitrine "Leve também" do Checkout.
 * - Modo manual (`!config.isAuto`): usa exatamente os produtos escolhidos no Admin.
 * - Modo auto (`config.isAuto`): prioriza guloseimas (doces, chocolates, snacks e sobremesas) de compra por impulso.
 */
export function buildCheckoutCandyProducts({
  config,
  cartItems,
  products,
  productsById,
}: {
  config: UpsellShowcaseConfig;
  cartItems: readonly { id: string }[];
  products: readonly HomeProduct[];
  productsById: ReadonlyMap<string, HomeProduct>;
}): HomeProduct[] {
  if (!config.active) return [];

  const inCartIds = new Set(cartItems.map((c) => c.id));
  const manualResolved = resolveHomeProducts(config.productIds, productsById, config.maxProducts).filter(
    (p) => !inCartIds.has(p.id),
  );

  if (!config.isAuto) {
    return manualResolved;
  }

  const now = new Date();
  const seen = new Set<string>(manualResolved.map((p) => p.id));

  const scored = products
    .filter((p) => !inCartIds.has(p.id) && !seen.has(p.id) && isHomeProductPurchasable(p))
    .map((p) => {
      const hay = `${norm(p.category || '')} ${norm(p.title)}`;
      const cluster = classifyProduct(p.title, p.category);
      let score = 0;

      if (cluster === 'sweet_candy') score += 10;
      else if (cluster === 'savory_snack') score += 6;
      else if (hay.includes('doce') || hay.includes('sobremesa') || hay.includes('lanche')) score += 5;

      if (hasCurrentPromotion(p, now)) score += 2;
      if (p.price <= 20) score += 2;
      else if (p.price <= 35) score += 1;

      return { product: p, score };
    })
    .sort((a, b) => b.score - a.score || a.product.price - b.product.price || a.product.id.localeCompare(b.product.id))
    .map((entry) => entry.product);

  return [...manualResolved, ...scored].slice(0, config.maxProducts);
}
