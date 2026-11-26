/**
 * useHomeConfig — configuração editorial da Home (Firestore: home-config/data/*).
 *
 * Coordenação atômica de bootstrap:
 *  - Política A (cache coerente v2): se existir snapshot completo, normalizado e dentro do TTL,
 *    inicia em `status: 'stale'` (revelação imediata e coerente) e sincroniza silenciosamente.
 *  - Política B (sem cache coerente): inicia em `status: 'loading'`, acumula em memória a primeira
 *    resposta de TODAS as 8 coleções em paralelo (inclusive coleções vazias válidas) e só promove
 *    para `status: 'ready'` em um único commit atômico — eliminando montagem por etapas.
 *  - Após a primeira sincronização, atualizações em tempo real do CRM continuam aplicando em
 *    segundo plano sem desmontar ou piscar a Home.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
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
} from '../utils/homeProducts';
import type { ConfigIssue } from '../utils/homeProducts';
import {
  HOME_CONFIG_SOURCES,
  HOME_SNAPSHOT_STORAGE_KEY,
  buildHomeSnapshotForCache,
  validateHomeSnapshotCache,
} from '../utils/homeBootstrap';
import type { HomeConfigSourceKey } from '../utils/homeBootstrap';

export type {
  VitrineConfig,
  PeriodConfig,
  MegaOfertaConfig,
  HeroBannerConfig,
  CondoFavoriteConfig,
  HomeLayoutBlock,
  RoundCardItem,
} from '../types/home';

export type HomeConfigStatus = 'loading' | 'stale' | 'ready' | 'error';

export interface HomeConfig {
  vitrines: VitrineConfig[];
  periodConfig: Record<string, PeriodConfig>;
  megaOfertas: MegaOfertaConfig[];
  heroBanners: HeroBannerConfig[];
  condoFavorites: CondoFavoriteConfig[];
  homeLayout: HomeLayoutBlock[];
  brands: RoundCardItem[];
  localPartners: RoundCardItem[];
  /** Problemas de configuração encontrados na última leitura (para diagnóstico/painel). */
  issues: ConfigIssue[];
  /** Estado explícito de prontidão do conjunto de coleções editoriais. */
  status: HomeConfigStatus;
  /** true enquanto o snapshot inicial coerente não está disponível. */
  loading: boolean;
  /** true quando a coleção `hero-banners` já respondeu (ou veio de cache coerente). */
  heroBannersReady: boolean;
  /** true se houve falha em alguma coleção. */
  error: boolean;
  /** true quando o estado inicial partiu de um snapshot v2 validado em cache. */
  hasCoherentCache: boolean;
  /** Reexecuta a sincronização inicial em caso de falha. */
  retry: () => void;
}

const INITIAL_SYNC_TIMEOUT_MS = 3_800;
const CRITICAL_CONFIG_SOURCES: readonly HomeConfigSourceKey[] = ['vitrines', 'heroBanners', 'homeLayout'];

const reportedIssues = new Set<string>();
function reportIssues(issues: ConfigIssue[]) {
  issues.forEach((issue) => {
    const key = `${issue.scope}/${issue.id}/${issue.message}`;
    if (reportedIssues.has(key)) return;
    reportedIssues.add(key);
    console.warn(`[home-config] ${issue.scope}/${issue.id}: ${issue.message}`);
  });
}

type InternalHomeConfigState = Omit<HomeConfig, 'retry'>;

function loadCoherentCachedConfig(): InternalHomeConfigState {
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(HOME_SNAPSHOT_STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        const validated = validateHomeSnapshotCache(parsed);
        if (validated) {
          return {
            vitrines: validated.vitrines,
            periodConfig: validated.periodConfig,
            megaOfertas: validated.megaOfertas,
            heroBanners: validated.heroBanners,
            condoFavorites: validated.condoFavorites,
            homeLayout: validated.homeLayout,
            brands: validated.brands,
            localPartners: validated.localPartners,
            issues: [],
            status: 'stale',
            loading: false,
            heroBannersReady: true,
            error: false,
            hasCoherentCache: true,
          };
        }
        // Snapshot antigo/corrompido/expirado: limpa para evitar reprocessamento
        localStorage.removeItem(HOME_SNAPSHOT_STORAGE_KEY);
      }
    }
  } catch {
    try {
      localStorage.removeItem(HOME_SNAPSHOT_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }

  return {
    vitrines: [],
    periodConfig: {},
    megaOfertas: [],
    heroBanners: [],
    condoFavorites: [],
    homeLayout: [],
    brands: [],
    localPartners: [],
    issues: [],
    status: 'loading',
    loading: true,
    heroBannersReady: false,
    error: false,
    hasCoherentCache: false,
  };
}

function persistCoherentHomeSnapshot(state: InternalHomeConfigState) {
  try {
    if (typeof window === 'undefined') return;
    const snapshot = buildHomeSnapshotForCache({
      vitrines: state.vitrines,
      periodConfig: state.periodConfig,
      megaOfertas: state.megaOfertas,
      heroBanners: state.heroBanners,
      condoFavorites: state.condoFavorites,
      homeLayout: state.homeLayout,
      brands: state.brands,
      localPartners: state.localPartners,
    });
    localStorage.setItem(HOME_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // safe fallback if storage quota exceeded
  }
}

type Normalizer<T> = (id: string, raw: unknown) => { value: T | null; issues: ConfigIssue[] };

function readCollection<T>(docs: QueryDocumentSnapshot<DocumentData>[], normalize: Normalizer<T>) {
  const values: T[] = [];
  const issues: ConfigIssue[] = [];
  docs.forEach((d) => {
    const result = normalize(d.id, d.data());
    if (result.value) values.push(result.value);
    issues.push(...result.issues);
  });
  reportIssues(issues);
  return { values, issues };
}

export const useHomeConfig = (): HomeConfig => {
  const [config, setConfig] = useState<InternalHomeConfigState>(loadCoherentCachedConfig);
  const [retryNonce, setRetryNonce] = useState(0);
  const hasCoherentCacheRef = useRef(config.hasCoherentCache);

  const retry = useCallback(() => {
    hasCoherentCacheRef.current = false;
    setConfig((prev) => ({
      ...prev,
      status: 'loading',
      loading: true,
      heroBannersReady: false,
      error: false,
      hasCoherentCache: false,
    }));
    setRetryNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    let active = true;
    let initialCommitted = false;

    const settled = new Set<HomeConfigSourceKey>();
    const failed = new Set<HomeConfigSourceKey>();

    // Buffer mutável para acumular o primeiro lote completo antes do commit atômico
    const buffer: InternalHomeConfigState = {
      vitrines: [],
      periodConfig: {},
      megaOfertas: [],
      heroBanners: [],
      condoFavorites: [],
      homeLayout: [],
      brands: [],
      localPartners: [],
      issues: [],
      status: hasCoherentCacheRef.current ? 'stale' : 'loading',
      loading: !hasCoherentCacheRef.current,
      heroBannersReady: hasCoherentCacheRef.current,
      error: false,
      hasCoherentCache: hasCoherentCacheRef.current,
    };

    let postCommitTimer: number | null = null;

    const commitAtomicSnapshot = (timedOut = false) => {
      if (!active) return;

      const allCriticalFailed =
        !timedOut &&
        CRITICAL_CONFIG_SOURCES.every((key) => failed.has(key)) &&
        settled.size >= CRITICAL_CONFIG_SOURCES.length;

      if (allCriticalFailed && !hasCoherentCacheRef.current) {
        initialCommitted = true;
        setConfig((prev) => ({
          ...prev,
          status: 'error',
          loading: false,
          heroBannersReady: true,
          error: true,
        }));
        return;
      }

      const nextState: InternalHomeConfigState = {
        ...buffer,
        status: 'ready',
        loading: false,
        heroBannersReady: hasCoherentCacheRef.current || settled.has('heroBanners'),
        error: failed.size > 0,
        hasCoherentCache: hasCoherentCacheRef.current,
      };

      initialCommitted = true;
      setConfig(nextState);

      // Só persiste no cache v2 se todas as 8 coleções responderam sem falha crítica
      if (settled.size === HOME_CONFIG_SOURCES.length && failed.size === 0) {
        persistCoherentHomeSnapshot(nextState);
      }
    };

    const flushPostBootstrapUpdate = () => {
      if (!active) return;
      const updatedState: InternalHomeConfigState = {
        ...buffer,
        status: 'ready',
        loading: false,
        heroBannersReady: hasCoherentCacheRef.current || settled.has('heroBanners'),
        error: failed.size > 0,
        hasCoherentCache: hasCoherentCacheRef.current,
      };
      setConfig(updatedState);
      if (settled.size === HOME_CONFIG_SOURCES.length && failed.size === 0) {
        persistCoherentHomeSnapshot(updatedState);
      }
    };

    const markSettled = (key: HomeConfigSourceKey, isError = false) => {
      settled.add(key);
      if (isError) {
        failed.add(key);
      } else {
        failed.delete(key);
      }

      if (!initialCommitted) {
        const criticalSettled = CRITICAL_CONFIG_SOURCES.every((k) => settled.has(k));
        if (settled.size >= HOME_CONFIG_SOURCES.length || (criticalSettled && failed.size === 0)) {
          window.clearTimeout(bootstrapTimer);
          commitAtomicSnapshot(false);
        }
        return;
      }

      // Pós-bootstrap: agrupa atualizações simultâneas do Firestore para evitar múltiplos re-renders
      if (postCommitTimer !== null) {
        window.clearTimeout(postCommitTimer);
      }
      postCommitTimer = window.setTimeout(() => {
        postCommitTimer = null;
        flushPostBootstrapUpdate();
      }, 80);
    };

    const fail = (key: HomeConfigSourceKey, label: string) => () => {
      console.warn(`[home-config] Falha ao ler ${label}.`);
      markSettled(key, true);
    };

    const bootstrapTimer = window.setTimeout(() => {
      if (!initialCommitted) {
        commitAtomicSnapshot(true);
      }
    }, INITIAL_SYNC_TIMEOUT_MS);

    const unsubs = [
      onSnapshot(
        collection(db, 'home-config', 'data', 'vitrines'),
        (snap) => {
          const { values, issues } = readCollection(snap.docs, normalizeVitrine);
          buffer.vitrines = values.sort(byOrderThenId);
          buffer.issues = [...buffer.issues.filter((i) => i.scope !== 'vitrines'), ...issues];
          markSettled('vitrines');
        },
        fail('vitrines', 'vitrines'),
      ),

      onSnapshot(
        collection(db, 'home-config', 'data', 'period-config'),
        (snap) => {
          const { values } = readCollection(snap.docs, normalizePeriodConfig);
          const periods: Record<string, PeriodConfig> = {};
          values.forEach((p) => {
            periods[p.id] = p;
          });
          buffer.periodConfig = periods;
          markSettled('periodConfig');
        },
        fail('periodConfig', 'period-config'),
      ),

      onSnapshot(
        collection(db, 'home-config', 'data', 'mega-ofertas'),
        (snap) => {
          const { values } = readCollection(snap.docs, normalizeMegaOferta);
          buffer.megaOfertas = values.sort(byOrderThenId);
          markSettled('megaOfertas');
        },
        fail('megaOfertas', 'mega-ofertas'),
      ),

      onSnapshot(
        collection(db, 'home-config', 'data', 'hero-banners'),
        (snap) => {
          const { values } = readCollection(snap.docs, normalizeHeroBanner);
          buffer.heroBanners = values.sort(byOrderThenId);
          markSettled('heroBanners');
        },
        fail('heroBanners', 'hero-banners'),
      ),

      onSnapshot(
        collection(db, 'home-config', 'data', 'condo-favorites'),
        (snap) => {
          const { values } = readCollection(snap.docs, normalizeCondoFavorite);
          buffer.condoFavorites = values.sort(byOrderThenId);
          markSettled('condoFavorites');
        },
        fail('condoFavorites', 'condo-favorites'),
      ),

      onSnapshot(
        collection(db, 'home-config', 'data', 'home-layout'),
        (snap) => {
          const { values } = readCollection(snap.docs, normalizeHomeLayoutBlock);
          buffer.homeLayout = values.sort(byOrderThenId);
          markSettled('homeLayout');
        },
        fail('homeLayout', 'home-layout'),
      ),

      onSnapshot(
        collection(db, 'home-config', 'data', 'home-brands'),
        (snap) => {
          const { values } = readCollection(snap.docs, (id, raw) =>
            normalizeRoundCardItem('home-brands', id, raw),
          );
          buffer.brands = values.sort(byOrderThenId);
          markSettled('brands');
        },
        fail('brands', 'home-brands'),
      ),

      onSnapshot(
        collection(db, 'home-config', 'data', 'home-partners'),
        (snap) => {
          const { values } = readCollection(snap.docs, (id, raw) =>
            normalizeRoundCardItem('home-partners', id, raw),
          );
          buffer.localPartners = values.sort(byOrderThenId);
          markSettled('localPartners');
        },
        fail('localPartners', 'home-partners'),
      ),
    ];

    return () => {
      active = false;
      window.clearTimeout(bootstrapTimer);
      if (postCommitTimer !== null) window.clearTimeout(postCommitTimer);
      unsubs.forEach((unsub) => unsub());
    };
  }, [retryNonce]);

  return {
    ...config,
    retry,
  };
};
