import {
  Beef,
  Beer,
  Candy,
  Cookie,
  Croissant,
  Droplet,
  Dumbbell,
  Flame,
  Gift,
  IceCreamCone,
  LayoutGrid,
  Moon,
  MoonStar,
  Package,
  PawPrint,
  Popcorn,
  Smartphone,
  Snowflake,
  Sparkles,
  SprayCan,
  Sun,
  Sunrise,
  Tag,
  Utensils,
  Wine,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { HomeCategoryLink, HomePeriod } from '../types/home';

export type CategoryIconKey =
  | 'tag'
  | 'flame'
  | 'candy'
  | 'cookie'
  | 'droplet'
  | 'sparkles'
  | 'spray-can'
  | 'package'
  | 'gift'
  | 'layout-grid'
  | 'beer'
  | 'croissant'
  | 'snowflake'
  | 'paw-print'
  | 'popcorn'
  | 'smartphone'
  | 'ice-cream'
  | 'wrench'
  | 'beef'
  | 'wine'
  | 'dumbbell';

/**
 * Explicit semantic mapping from `icon` key to vector icon component.
 * Used by both `HomeCategoryCarousel` and `HomeQuickCategories`.
 */
export const CATEGORY_ICON_BY_KEY: Record<CategoryIconKey, LucideIcon> = {
  tag: Tag,
  flame: Tag, // Promoções / Ofertas uses Tag (etiqueta de oferta)
  candy: Candy,
  cookie: Cookie,
  droplet: Droplet,
  sparkles: SprayCan, // Limpeza uses SprayCan (spray/limpeza)
  'spray-can': SprayCan,
  package: Package,
  gift: Package, // Combos uses Package (caixa/combo)
  'layout-grid': LayoutGrid,
  beer: Beer,
  croissant: Croissant,
  snowflake: Snowflake,
  'paw-print': PawPrint,
  popcorn: Popcorn,
  smartphone: Smartphone,
  'ice-cream': IceCreamCone,
  wrench: Wrench,
  beef: Beef,
  wine: Wine,
  dumbbell: Dumbbell,
};

/**
 * Semantic mapping by category `id` when `icon` is omitted or generic.
 */
export const CATEGORY_ICON_BY_ID: Record<string, LucideIcon> = {
  promocoes: Tag,
  ofertas: Tag,
  doces: Candy,
  biscoitos: Cookie,
  higiene: Droplet,
  limpeza: SprayCan,
  combos: Package,
  'ver-todas': LayoutGrid,
  bebidas: Beer,
  padaria: Croissant,
  congelados: Snowflake,
  petshop: PawPrint,
  salgadinhos: Popcorn,
  beleza: Sparkles,
  eletronicos: Smartphone,
  tabacaria: Flame,
  sorvetes: IceCreamCone,
  utilidades: Wrench,
  churrasco: Beef,
  adega: Wine,
  bomboniere: Gift,
  fitness: Dumbbell,
};

/**
 * Resolves the vector icon for a Home category item with a deterministic fallback (`LayoutGrid`).
 */
export function resolveCategoryIcon(
  item: Pick<HomeCategoryLink, 'id' | 'icon'>,
): LucideIcon {
  const normalizedId = (item.id || '').trim().toLowerCase();
  if (normalizedId && CATEGORY_ICON_BY_ID[normalizedId]) {
    return CATEGORY_ICON_BY_ID[normalizedId];
  }
  const normalizedIcon = (item.icon || '').trim().toLowerCase() as CategoryIconKey;
  if (normalizedIcon && CATEGORY_ICON_BY_KEY[normalizedIcon]) {
    return CATEGORY_ICON_BY_KEY[normalizedIcon];
  }
  return LayoutGrid;
}

/**
 * Vector icons for the 5 periods of the day (`HomePeriodSelector`),
 * coordinated in visual weight with the category icons.
 */
export const PERIOD_ICON_BY_ID: Record<HomePeriod, LucideIcon> = {
  morning: Sunrise,
  lunch: Utensils,
  afternoon: Sun,
  night: Moon,
  dawn: MoonStar,
};

export function resolvePeriodIcon(period: HomePeriod): LucideIcon {
  return PERIOD_ICON_BY_ID[period] ?? Sun;
}

