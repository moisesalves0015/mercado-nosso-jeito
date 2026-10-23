/**
 * Contratos de dados da Home.
 *
 * Fonte oficial de produtos: coleção `products` (Firestore). A Home nunca mantém um
 * catálogo paralelo: tudo que os cartões exibem é derivado de um `HomeProduct`,
 * produzido por `normalizeHomeProduct` (src/utils/homeProducts.ts).
 */
import type { PricedProduct } from '../utils/productPricing';

export type PromoExpiry = PricedProduct['promoExpiry'];

export type HomeTheme = 'hero' | 'purple' | 'orange' | 'green';
export type HomeLayout = 'horizontal' | 'grid' | 'carousel';
export type HomePeriod = 'morning' | 'lunch' | 'afternoon' | 'night' | 'dawn';

/** Produto já validado/normalizado, pronto para os cartões da Home. */
export interface HomeProduct {
  /** ID do documento Firestore (nunca slug de título). */
  id: string;
  title: string;
  /** Preço regular, sempre numérico. O preço efetivo vem de `getHomeProductPrice`. */
  price: number;
  image: string;
  category: string;
  /** Estoque inteiro >= 0. */
  stock: number;
  active: boolean;
  promoActive?: boolean;
  promoPrice?: number;
  promoExpiry?: PromoExpiry;
  badge?: string;
  badgeStyle?: 'orange' | 'light';
  diamondReward?: number;
}

/** Destino de navegação: rota interna, busca textual ou filtro de categoria da /search. */
export type HomeLinkType = 'route' | 'search' | 'category';

/** Atalho/categoria declarativo (substitui JSX duplicado). */
export interface HomeCategoryLink {
  id: string;
  label: string;
  type: HomeLinkType;
  /** Rota (`route`), termo (`search`) ou valor do campo `category` (`category`). */
  target: string;
  order: number;
  active: boolean;
  /** Nome de ícone (atalhos rápidos) — mapeado em HomeQuickCategories. */
  icon?: string;
  /** Imagem ilustrada (carrossel de categorias). */
  image?: string;
}

// ─── Configuração editorial (Firestore: home-config/data/*) ────────────────

/** home-config/data/vitrines/{id} */
export interface VitrineConfig {
  id: string;
  title: string;
  /** Aceita string ou string[] no Firestore; a normalização sempre devolve string[]. */
  subtitle?: string | string[];
  theme: HomeTheme;
  active: boolean;
  order: number;
  layout: HomeLayout;
  maxProducts: number;
  productIds: string[];
  validFrom?: string | null;
  validUntil?: string | null;
  /** Destino do "Ver tudo": rota interna (ex.: /bebidas). Opcional e compatível com vitrines antigas. */
  linkTo?: string;
  /** Alternativa ao linkTo: valor do campo category dos produtos (abre /search?category=...). */
  category?: string;
}

/** home-config/data/period-config/{morning|lunch|afternoon|night|dawn} */
export interface PeriodConfig {
  id: HomePeriod;
  title: string;
  active: boolean;
  productIds: string[];
  isAuto: boolean;
}

/** home-config/data/mega-ofertas/{id} */
export interface MegaOfertaConfig {
  id: string;
  productId: string;
  order: number;
  badge?: string;
  badgeStyle?: 'orange' | 'light';
  validUntil?: string | null;
}

/** home-config/data/hero-banners/{id} */
export interface HeroBannerConfig {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  link: string;
  badgeText?: string;
  badgeIcon?: string;
  buttonText: string;
  highlightWords: { word: string; color: string }[];
  order: number;
}

/** home-config/data/condo-favorites/{id} — curadoria administrativa dos favoritos do condomínio. */
export interface CondoFavoriteConfig {
  id: string;
  productId: string;
  order: number;
}
