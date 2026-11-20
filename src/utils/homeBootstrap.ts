/**
 * homeBootstrap — utilitários puros para o carregamento atômico da Home.
 *
 * Política de cache (Política A com fallback Política B):
 *  - Política A (cache coerente primeiro + atualização silenciosa):
 *    Se existir um snapshot v2 validado (schema, TTL, todas as 8 coleções sincronizadas),
 *    a Home pode ser revelada de forma completa e coerente imediatamente (`stale`), enquanto
 *    os listeners do Firestore atualizam em segundo plano sem desmontar a página.
 *  - Política B (aguardar primeira sincronização completa):
 *    Sem cache coerente válido (cache frio, incompleto, expirado ou corrompido), o coordenador
 *    mantém `loading` até que TODAS as fontes críticas respondam pela primeira vez (incluindo
 *    coleções vazias válidas) e os assets críticos do Hero sejam preparados (com timeout seguro).
 */
import type {
  CondoFavoriteConfig,
  HeroBannerConfig,
  HomeLayoutBlock,
  MegaOfertaConfig,
  PeriodConfig,
  RoundCardItem,
  VitrineConfig,
} from '../types/home';
import {
  byOrderThenId,
  normalizeCondoFavorite,
  normalizeHeroBanner,
  normalizeHomeLayoutBlock,
  normalizeMegaOferta,
  normalizePeriodConfig,
  normalizeRoundCardItem,
  normalizeVitrine,
} from './homeProducts';
import { sanitizeBannerImageUrl } from './imageUrl';

export const HOME_SNAPSHOT_SCHEMA_VERSION = 2;
export const HOME_SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas
export const HOME_SNAPSHOT_STORAGE_KEY = 'app-home-config-v2';

export type HomeSourceStatus = 'pending' | 'resolved' | 'error';

export type HomeBootstrapState = 'idle' | 'loading' | 'stale' | 'ready' | 'error';

export const HOME_CONFIG_SOURCES = [
  'vitrines',
  'periodConfig',
  'megaOfertas',
  'heroBanners',
  'condoFavorites',
  'homeLayout',
  'brands',
  'localPartners',
] as const;

export type HomeConfigSourceKey = (typeof HOME_CONFIG_SOURCES)[number];

export interface CoherentHomeSnapshot {
  version: typeof HOME_SNAPSHOT_SCHEMA_VERSION;
  savedAt: number;
  allSourcesSynced: true;
  vitrines: VitrineConfig[];
  periodConfig: Record<string, PeriodConfig>;
  megaOfertas: MegaOfertaConfig[];
  heroBanners: HeroBannerConfig[];
  condoFavorites: CondoFavoriteConfig[];
  homeLayout: HomeLayoutBlock[];
  brands: RoundCardItem[];
  localPartners: RoundCardItem[];
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Valida e re-normaliza um snapshot de cache da Home.
 * Retorna `null` se o JSON estiver corrompido, expirado, com versão incompatível
 * ou incompleto (evitando misturar dados parciais de coleções diferentes).
 */
export function validateHomeSnapshotCache(
  raw: unknown,
  now: number = Date.now(),
): CoherentHomeSnapshot | null {
  if (!isPlainObject(raw)) return null;
  if (raw.version !== HOME_SNAPSHOT_SCHEMA_VERSION) return null;
  if (raw.allSourcesSynced !== true) return null;

  const savedAt = typeof raw.savedAt === 'number' ? raw.savedAt : NaN;
  if (!Number.isFinite(savedAt) || savedAt <= 0) return null;
  // Rejeita cache expirado ou com timestamp futuro absurdo (> 5 min)
  if (now - savedAt > HOME_SNAPSHOT_TTL_MS || savedAt - now > 5 * 60 * 1000) {
    return null;
  }

  // Todas as coleções precisam existir com o tipo esperado (arrays ou objeto)
  if (
    !Array.isArray(raw.vitrines) ||
    !isPlainObject(raw.periodConfig) ||
    !Array.isArray(raw.megaOfertas) ||
    !Array.isArray(raw.heroBanners) ||
    !Array.isArray(raw.condoFavorites) ||
    !Array.isArray(raw.homeLayout) ||
    !Array.isArray(raw.brands) ||
    !Array.isArray(raw.localPartners)
  ) {
    return null;
  }

  const normalizeList = <T>(
    arr: unknown[],
    fn: (id: string, item: unknown) => { value: T | null },
  ): T[] => {
    const out: T[] = [];
    for (const entry of arr) {
      if (!isPlainObject(entry) || typeof entry.id !== 'string' || !entry.id.trim()) continue;
      const res = fn(entry.id, entry);
      if (res.value) out.push(res.value);
    }
    return out;
  };

  const vitrines = normalizeList(raw.vitrines, normalizeVitrine).sort(byOrderThenId);
  const megaOfertas = normalizeList(raw.megaOfertas, normalizeMegaOferta).sort(byOrderThenId);
  const heroBanners = normalizeList(raw.heroBanners, normalizeHeroBanner).sort(byOrderThenId);
  const condoFavorites = normalizeList(raw.condoFavorites, normalizeCondoFavorite).sort(byOrderThenId);
  const homeLayout = normalizeList(raw.homeLayout, normalizeHomeLayoutBlock).sort(byOrderThenId);
  const brands = normalizeList(raw.brands, (id, item) =>
    normalizeRoundCardItem('home-brands', id, item),
  ).sort(byOrderThenId);
  const localPartners = normalizeList(raw.localPartners, (id, item) =>
    normalizeRoundCardItem('home-partners', id, item),
  ).sort(byOrderThenId);

  const periodConfig: Record<string, PeriodConfig> = {};
  for (const [key, val] of Object.entries(raw.periodConfig)) {
    const res = normalizePeriodConfig(key, val);
    if (res.value) periodConfig[res.value.id] = res.value;
  }

  return {
    version: HOME_SNAPSHOT_SCHEMA_VERSION,
    savedAt,
    allSourcesSynced: true,
    vitrines,
    periodConfig,
    megaOfertas,
    heroBanners,
    condoFavorites,
    homeLayout,
    brands,
    localPartners,
  };
}

/**
 * Monta um snapshot seguro para persistência em localStorage.
 * Remove Data URIs gigantes de vídeo (> 500KB) para nunca estourar quota do navegador.
 */
export function buildHomeSnapshotForCache(
  data: Omit<CoherentHomeSnapshot, 'version' | 'savedAt' | 'allSourcesSynced'>,
  now: number = Date.now(),
): CoherentHomeSnapshot {
  const safeHeroBanners = data.heroBanners.map((b) => {
    if (b.videoUrl && b.videoUrl.startsWith('data:') && b.videoUrl.length > 500_000) {
      return { ...b, videoUrl: '' };
    }
    return b;
  });

  return {
    version: HOME_SNAPSHOT_SCHEMA_VERSION,
    savedAt: now,
    allSourcesSynced: true,
    vitrines: data.vitrines,
    periodConfig: data.periodConfig,
    megaOfertas: data.megaOfertas,
    heroBanners: safeHeroBanners,
    condoFavorites: data.condoFavorites,
    homeLayout: data.homeLayout,
    brands: data.brands,
    localPartners: data.localPartners,
  };
}

export interface HomeReadinessInput {
  catalogStatus: 'loading' | 'ready' | 'error';
  catalogCount: number;
  homeConfigStatus: 'loading' | 'stale' | 'ready' | 'error';
  adminConfigLoading: boolean;
  shippingConfigLoading: boolean;
  criticalAssetsReady: boolean;
  /** true quando há um snapshot coerente em cache sendo atualizado em segundo plano. */
  hasCoherentCache: boolean;
}

/**
 * Avalia de forma determinística o estado global de prontidão da Home.
 *
 * Regras:
 *  - Nunca retorna `ready`/`stale` enquanto o catálogo ou os dados críticos ainda estão em `loading`.
 *  - Se há cache coerente (`hasCoherentCache`) e o catálogo + assets críticos estão prontos,
 *    libera como `stale` (revelação atômica imediata + sync silencioso).
 *  - Se todas as fontes críticas falharam (catálogo ou homeConfig em `error` sem dados utilizáveis),
 *    retorna `error` para exibir tela de erro + retry (nunca Home parcial).
 *  - Coleções vazias válidas entram como `ready` — nunca travam em `loading`.
 */
export function evaluateHomeReadiness(input: HomeReadinessInput): HomeBootstrapState {
  // Falha crítica: catálogo falhou sem produtos ou home-config falhou completamente sem cache coerente
  if (input.catalogStatus === 'error' && input.catalogCount === 0) {
    return 'error';
  }
  if (input.homeConfigStatus === 'error' && !input.hasCoherentCache) {
    return 'error';
  }

  // Ainda aguardando fontes críticas
  if (input.catalogStatus === 'loading') {
    return 'loading';
  }
  if (input.homeConfigStatus === 'loading') {
    return 'loading';
  }

  // Sem cache coerente, aguarda também settings/admin e settings/shipping (ambos têm timeout/fallback)
  if (!input.hasCoherentCache && (input.adminConfigLoading || input.shippingConfigLoading)) {
    return 'loading';
  }

  // Aguarda decodificação/preparo dos assets críticos acima da dobra (com timeout próprio)
  if (!input.criticalAssetsReady) {
    return 'loading';
  }

  if (input.homeConfigStatus === 'stale') {
    return 'stale';
  }

  return 'ready';
}

/**
 * Extrai a(s) URL(s) de imagem crítica acima da dobra (primeiro slide do Hero)
 * para pré-carregamento e decode antes da revelação atômica.
 */
export function getCriticalHeroImageUrls(
  slides: ReadonlyArray<{ image?: string; posterImage?: string; mediaType?: 'image' | 'video'; videoUrl?: string }>,
): string[] {
  const first = slides[0];
  if (!first) return [];

  const urls: string[] = [];
  const isVideo = first.mediaType === 'video' || Boolean(first.videoUrl);

  if (isVideo) {
    const poster = first.posterImage ? sanitizeBannerImageUrl(first.posterImage, '') : '';
    if (poster) urls.push(poster);
  } else {
    const img = first.image ? sanitizeBannerImageUrl(first.image, '') : '';
    if (img) urls.push(img);
  }

  return urls;
}

/**
 * Pré-carrega e decodifica imagens críticas do Hero com timeout seguro,
 * evitando pop-in visual sem nunca bloquear indefinidamente em rede lenta ou URL quebrada.
 */
export function preloadCriticalImages(urls: readonly string[], timeoutMs = 2500): Promise<void> {
  if (typeof window === 'undefined' || typeof Image === 'undefined' || urls.length === 0) {
    return Promise.resolve();
  }

  const tasks = urls.map(
    (url) =>
      new Promise<void>((resolve) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          resolve();
        };

        const timer = window.setTimeout(done, timeoutMs);
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => {
          if (typeof img.decode === 'function') {
            img.decode().then(done).catch(done);
          } else {
            done();
          }
        };
        img.onerror = done;
        img.src = url;

        if (img.complete && img.naturalWidth > 0) {
          if (typeof img.decode === 'function') {
            img.decode().then(done).catch(done);
          } else {
            done();
          }
        }
      }),
  );

  return Promise.all(tasks).then(() => undefined);
}

