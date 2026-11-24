import React from 'react';
import {
  Beef,
  Beer,
  Croissant,
  Dumbbell,
  Flame,
  IceCreamCone,
  PawPrint,
  Popcorn,
  Smartphone,
  Snowflake,
  Sparkles,
  Wine,
  Wrench,
} from 'lucide-react';
import type { HomeCategoryLink, HomePeriod } from '../types/home';

export interface SfGlyphProps {
  size?: number | string;
  strokeWidth?: number | string;
  active?: boolean;
  className?: string;
}

export type SfGlyphComponent = React.FC<SfGlyphProps>;

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

/* =========================================================
   SF SYMBOLS — CATEGORIAS RÁPIDAS (Outline fino vs Preenchido escultural)
========================================================= */

/** Promoções / Ofertas — Etiqueta Boutique SF Symbol */
const SfPromoTagGlyph: SfGlyphComponent = ({ size = 22, active = false }) =>
  active ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.25 5.5A2.25 2.25 0 0 1 5.5 3.25h5.38c.6 0 1.17.24 1.59.66l8.12 8.12a2.25 2.25 0 0 1 0 3.18l-5.38 5.38a2.25 2.25 0 0 1-3.18 0l-8.12-8.12a2.25 2.25 0 0 1-.66-1.59V5.5Zm4.5 2.25a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"
        fill="currentColor"
      />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.75 5.75A2 2 0 0 1 5.75 3.75h5.13c.53 0 1.04.21 1.42.59l7.95 7.95a2 2 0 0 1 0 2.83l-5.13 5.13a2 2 0 0 1-2.83 0l-7.95-7.95a2 2 0 0 1-.59-1.42V5.75Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.35" fill="currentColor" />
    </svg>
  );

/** Doces — Bombom / Confeitaria Fina SF Symbol */
const SfCandyGlyph: SfGlyphComponent = ({ size = 22, active = false }) =>
  active ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.2 5.4c.4-.9 1.5-1.1 2.2-.4l2.1 2.1-3.1 3.1-2.1-2.1c-.7-.7-.5-1.8.4-2.2l.5-.5ZM19.8 18.6c-.4.9-1.5 1.1-2.2.4l-2.1-2.1 3.1-3.1 2.1 2.1c.7.7.5 1.8-.4 2.2l-.5.5Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 6.75a5.25 5.25 0 1 0 0 10.5 5.25 5.25 0 0 0 0-10.5Zm-1.85 3.4a.75.75 0 0 1 1.06 0l2.64 2.64a.75.75 0 1 1-1.06 1.06L10.15 11.2a.75.75 0 0 1 0-1.06Z"
        fill="currentColor"
      />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.6" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M10.2 10.2 13.8 13.8M8.3 8.3 5.5 5.5c-.6-.6-1.6-.3-1.9.5l-.3.9-.9.3c-.8.3-1.1 1.3-.5 1.9l2.8 2.8M15.7 15.7l2.8 2.8c.6.6 1.6.3 1.9-.5l.3-.9.9-.3c.8-.3 1.1-1.3.5-1.9l-2.8-2.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

/** Biscoitos — Cookie Artesanal SF Symbol */
const SfCookieGlyph: SfGlyphComponent = ({ size = 22, active = false }) =>
  active ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2.75c.55 0 .97.48.9 1.02a2.6 2.6 0 0 0 2.9 2.9c.52-.07.98.33 1.01.85a2.6 2.6 0 0 0 2.77 2.46c.54-.04 1.02.38.98.92a9.25 9.25 0 1 1-8.56-8.15ZM8.5 10.25a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Zm3.25 4.25a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Zm3.5-2.75a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2ZM10.5 7a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
        fill="currentColor"
      />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5a3.1 3.1 0 0 0 3.4 3.4 3.1 3.1 0 0 0 3.3 2.9 3.1 3.1 0 0 0 1.8 2.2 8.5 8.5 0 1 1-8.5-8.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8.75" cy="11.5" r="1.1" fill="currentColor" />
      <circle cx="12" cy="15.25" r="1.1" fill="currentColor" />
      <circle cx="14.75" cy="12.5" r="1" fill="currentColor" />
      <circle cx="10.5" cy="8" r="0.9" fill="currentColor" />
    </svg>
  );

/** Higiene — Gota Cristalina SF Symbol */
const SfDropletGlyph: SfGlyphComponent = ({ size = 22, active = false }) =>
  active ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.2 2.85a1 1 0 0 1 1.6 0c2.25 2.88 6.45 8.1 6.45 12.15a7.25 7.25 0 1 1-14.5 0c0-4.05 4.2-9.27 6.45-12.15Zm-1.95 10.4a.75.75 0 0 1 .75.75 2.75 2.75 0 0 0 2.75 2.75.75.75 0 0 1 0 1.5 4.25 4.25 0 0 1-4.25-4.25.75.75 0 0 1 .75-.75Z"
        fill="currentColor"
      />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3.5c2.4 3.05 6.5 8.05 6.5 11.75a6.5 6.5 0 1 1-13 0C5.5 11.55 9.6 6.55 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.25 14.5a3 3 0 0 0 3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );

/** Limpeza — Estrelas de Brilho (Sparkles iOS SF Symbol) */
const SfSparkleCleanGlyph: SfGlyphComponent = ({ size = 22, active = false }) =>
  active ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M11.5 2.5c.3-.7 1.3-.7 1.6 0l1.65 4.12c.24.6.72 1.08 1.32 1.32l4.12 1.65c.7.3.7 1.3 0 1.6l-4.12 1.65c-.6.24-1.08.72-1.32 1.32l-1.65 4.12c-.3.7-1.3.7-1.6 0l-1.65-4.12a2.25 2.25 0 0 0-1.32-1.32L4.41 11.2c-.7-.3-.7-1.3 0-1.6l4.12-1.65c.6-.24 1.08-.72 1.32-1.32L11.5 2.5Z"
        fill="currentColor"
      />
      <path
        d="M5.5 16.2c.18-.45.82-.45 1 0l.65 1.62.18.18 1.62.65c.45.18.45.82 0 1l-1.62.65-.18.18-.65 1.62c-.18.45-.82.45-1 0l-.65-1.62-.18-.18-1.62-.65c-.45-.18-.45-.82 0-1l1.62-.65.18-.18.65-1.62Z"
        fill="currentColor"
      />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="m12 3 1.75 4.35a2.2 2.2 0 0 0 1.25 1.25L19.35 10.35 15 12.1a2.2 2.2 0 0 0-1.25 1.25L12 17.7l-1.75-4.35A2.2 2.2 0 0 0 9 12.1l-4.35-1.75L9 8.6a2.2 2.2 0 0 0 1.25-1.25L12 3Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m6 16.5.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

/** Combos / Presentes — Gift Box Boutique SF Symbol */
const SfGiftComboGlyph: SfGlyphComponent = ({ size = 22, active = false }) =>
  active ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9.25 3.25a2.5 2.5 0 0 0-1.95 4.06h3.95V5.5a2.25 2.25 0 0 0-2-2.25Zm5.5 0a2.25 2.25 0 0 0-2 2.25v1.81h3.95a2.5 2.5 0 0 0-1.95-4.06Z"
        fill="currentColor"
      />
      <path
        d="M3.5 8.5A1.5 1.5 0 0 1 5 7h6.25v4H3.5V8.5ZM12.75 7H19a1.5 1.5 0 0 1 1.5 1.5V11h-7.75V7ZM4.5 12.5h6.75V20.5H6.5a2 2 0 0 1-2-2v-6ZM12.75 12.5h6.75v6a2 2 0 0 1-2 2h-4.75v-8Z"
        fill="currentColor"
      />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="7.5" width="17" height="4" rx="1.2" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5 11.5v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7M12 7.5v13"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M12 7.5H8.75a2.25 2.25 0 1 1 0-4.5C11 3 12 7.5 12 7.5Zm0 0h3.25a2.25 2.25 0 1 0 0-4.5C13 3 12 7.5 12 7.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

/** Ver todas — Grid iOS SF Symbol (square.grid.2x2) */
const SfGridGlyph: SfGlyphComponent = ({ size = 22, active = false }) =>
  active ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2.2" fill="currentColor" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="2.2" fill="currentColor" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="2.2" fill="currentColor" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="2.2" fill="currentColor" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.75" y="3.75" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13.25" y="3.75" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="3.75" y="13.25" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13.25" y="13.25" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );

/* =========================================================
   SF SYMBOLS — PERÍODOS DO DIA (Manhã, Almoço, Tarde, Noite, Madrugada)
========================================================= */

/** Manhã — Sol Nascente no Horizonte (sunrise.fill / sunrise) */
const SfMorningGlyph: SfGlyphComponent = ({ size = 14, active = false }) =>
  active ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3.25a.9.9 0 0 1 .9.9v2.1a.9.9 0 0 1-1.8 0v-2.1a.9.9 0 0 1 .9-.9ZM5.3 6.03a.9.9 0 0 1 1.27 0l1.48 1.48a.9.9 0 1 1-1.27 1.27L5.3 7.3a.9.9 0 0 1 0-1.27Zm13.4 0a.9.9 0 0 1 0 1.27l-1.48 1.48a.9.9 0 0 1-1.27-1.27l1.48-1.48a.9.9 0 0 1 1.27 0Z" fill="currentColor" />
      <path d="M6.5 14.5a5.5 5.5 0 0 1 11 0H6.5Z" fill="currentColor" />
      <path d="M3 17.25h18M6 20.25h12" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4v2.2M5.8 6.8l1.6 1.6M18.2 6.8l-1.6 1.6M6.8 14.5a5.2 5.2 0 0 1 10.4 0M3.5 17.25h17M6.5 20.25h11" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" />
    </svg>
  );

/** Almoço — Talheres de Alta Gastronomia (fork.knife) */
const SfLunchGlyph: SfGlyphComponent = ({ size = 14, active = false }) =>
  active ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.25 3a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 1 1.5 0v4.5a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 1 1.5 0v5a3.75 3.75 0 0 1-3 3.68V20a1 1 0 1 1-2 0v-7.57a3.75 3.75 0 0 1-3-3.68v-5A.75.75 0 0 1 6.25 3ZM17.75 3c.69 0 1.25.56 1.25 1.25V20a1 1 0 1 1-2 0v-5.5h-1.25A1.25 1.25 0 0 1 14.5 13.25v-5.5A4.75 4.75 0 0 1 17.75 3Z"
        fill="currentColor"
      />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 3.5v5a3 3 0 0 0 3 3v9M9 3.5v5M12 3.5v5a3 3 0 0 1-3 3M17.75 3.5v17M17.75 3.5c-2 0-3.25 2-3.25 4.5v5h3.25"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

/** Tarde — Sol Radiante (sun.max.fill / sun.max) */
const SfAfternoonGlyph: SfGlyphComponent = ({ size = 14, active = false }) =>
  active ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.8" fill="currentColor" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.55 1.55M17.75 17.75l1.55 1.55M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.55-1.55M17.75 6.25l1.55-1.55"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4.3" stroke="currentColor" strokeWidth="1.85" />
      <path
        d="M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
      />
    </svg>
  );

/** Noite — Lua Crescente Esculpida (moon.fill / moon) */
const SfNightGlyph: SfGlyphComponent = ({ size = 14, active = false }) =>
  active ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20.35 14.65A8.5 8.5 0 0 1 9.35 3.65a.75.75 0 0 0-.96-.93 9.25 9.25 0 1 0 12.89 12.89.75.75 0 0 0-.93-.96Z"
        fill="currentColor"
      />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20.2 14.8A8.2 8.2 0 0 1 9.2 3.8a8.6 8.6 0 1 0 11 11Z"
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

/** Madrugada — Lua com Estrelas (moon.stars.fill / moon.stars) */
const SfDawnGlyph: SfGlyphComponent = ({ size = 14, active = false }) =>
  active ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M19.8 15.1A8 8 0 0 1 8.9 4.2a.7.7 0 0 0-.9-.88 8.75 8.75 0 1 0 12.68 12.68.7.7 0 0 0-.88-.9Z"
        fill="currentColor"
      />
      <path
        d="m16.5 3 1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1 1-2.2Z"
        fill="currentColor"
      />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M19.5 15.2A7.8 7.8 0 0 1 8.8 4.5a8.2 8.2 0 1 0 10.7 10.7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 3.5v4M14.5 5.5h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );

export const CATEGORY_ICON_BY_KEY: Record<CategoryIconKey, SfGlyphComponent> = {
  tag: SfPromoTagGlyph,
  flame: SfPromoTagGlyph,
  candy: SfCandyGlyph,
  cookie: SfCookieGlyph,
  droplet: SfDropletGlyph,
  sparkles: SfSparkleCleanGlyph,
  'spray-can': SfSparkleCleanGlyph,
  package: SfGiftComboGlyph,
  gift: SfGiftComboGlyph,
  'layout-grid': SfGridGlyph,
  beer: Beer as unknown as SfGlyphComponent,
  croissant: Croissant as unknown as SfGlyphComponent,
  snowflake: Snowflake as unknown as SfGlyphComponent,
  'paw-print': PawPrint as unknown as SfGlyphComponent,
  popcorn: Popcorn as unknown as SfGlyphComponent,
  smartphone: Smartphone as unknown as SfGlyphComponent,
  'ice-cream': IceCreamCone as unknown as SfGlyphComponent,
  wrench: Wrench as unknown as SfGlyphComponent,
  beef: Beef as unknown as SfGlyphComponent,
  wine: Wine as unknown as SfGlyphComponent,
  dumbbell: Dumbbell as unknown as SfGlyphComponent,
};

export const CATEGORY_ICON_BY_ID: Record<string, SfGlyphComponent> = {
  promocoes: SfPromoTagGlyph,
  ofertas: SfPromoTagGlyph,
  doces: SfCandyGlyph,
  biscoitos: SfCookieGlyph,
  higiene: SfDropletGlyph,
  limpeza: SfSparkleCleanGlyph,
  combos: SfGiftComboGlyph,
  'ver-todas': SfGridGlyph,
  bebidas: Beer as unknown as SfGlyphComponent,
  padaria: Croissant as unknown as SfGlyphComponent,
  congelados: Snowflake as unknown as SfGlyphComponent,
  petshop: PawPrint as unknown as SfGlyphComponent,
  salgadinhos: Popcorn as unknown as SfGlyphComponent,
  beleza: Sparkles as unknown as SfGlyphComponent,
  eletronicos: Smartphone as unknown as SfGlyphComponent,
  tabacaria: Flame as unknown as SfGlyphComponent,
  sorvetes: IceCreamCone as unknown as SfGlyphComponent,
  utilidades: Wrench as unknown as SfGlyphComponent,
  churrasco: Beef as unknown as SfGlyphComponent,
  adega: Wine as unknown as SfGlyphComponent,
  bomboniere: SfGiftComboGlyph,
  fitness: Dumbbell as unknown as SfGlyphComponent,
};

export function resolveCategoryIcon(
  item: Pick<HomeCategoryLink, 'id' | 'icon'>,
): SfGlyphComponent {
  const normalizedId = (item.id || '').trim().toLowerCase();
  if (normalizedId && CATEGORY_ICON_BY_ID[normalizedId]) {
    return CATEGORY_ICON_BY_ID[normalizedId];
  }
  const normalizedIcon = (item.icon || '').trim().toLowerCase() as CategoryIconKey;
  if (normalizedIcon && CATEGORY_ICON_BY_KEY[normalizedIcon]) {
    return CATEGORY_ICON_BY_KEY[normalizedIcon];
  }
  return SfGridGlyph;
}

export const PERIOD_ICON_BY_ID: Record<HomePeriod, SfGlyphComponent> = {
  morning: SfMorningGlyph,
  lunch: SfLunchGlyph,
  afternoon: SfAfternoonGlyph,
  night: SfNightGlyph,
  dawn: SfDawnGlyph,
};

export function resolvePeriodIcon(period: HomePeriod): SfGlyphComponent {
  return PERIOD_ICON_BY_ID[period] ?? SfAfternoonGlyph;
}
