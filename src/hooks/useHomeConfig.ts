/**
 * useHomeConfig — configuração editorial da Home (Firestore: home-config/data/*).
 *
 * Cada coleção passa por uma função de normalização (src/utils/homeProducts.ts) que garante
 * tipos/valores seguros. Documentos inválidos são descartados e registrados via console.warn
 * (uma única vez por problema) — nunca derrubam a navegação.
 *
 * Os tipos de configuração vivem em src/types/home.ts e são reexportados aqui para manter
 * compatibilidade com quem já importava deste módulo (AdminMarketing, AdminProductDetail).
 */
import { useState, useEffect } from 'react';
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

export type {
  VitrineConfig,
  PeriodConfig,
  MegaOfertaConfig,
  HeroBannerConfig,
  CondoFavoriteConfig,
  HomeLayoutBlock,
  RoundCardItem,
} from '../types/home';

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
  /** true até a primeira resposta das vitrines (ou erro). */
  loading: boolean;
  /** true se alguma coleção falhou na leitura (erro temporário/permissão). */
  error: boolean;
}

const reportedIssues = new Set<string>();
function reportIssues(issues: ConfigIssue[]) {
  issues.forEach(issue => {
    const key = `${issue.scope}/${issue.id}/${issue.message}`;
    if (reportedIssues.has(key)) return;
    reportedIssues.add(key);
    console.warn(`[home-config] ${issue.scope}/${issue.id}: ${issue.message}`);
  });
}

const STORAGE_KEY = 'app-home-config';

function loadCachedHomeConfig(): HomeConfig {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const vitrines = Array.isArray(parsed.vitrines) ? parsed.vitrines : [];
        const heroBanners = Array.isArray(parsed.heroBanners) ? parsed.heroBanners : [];
        if (vitrines.length > 0 || heroBanners.length > 0) {
          return {
            vitrines,
            periodConfig: parsed.periodConfig || {},
            megaOfertas: Array.isArray(parsed.megaOfertas) ? parsed.megaOfertas : [],
            heroBanners,
            condoFavorites: Array.isArray(parsed.condoFavorites) ? parsed.condoFavorites : [],
            homeLayout: Array.isArray(parsed.homeLayout) ? parsed.homeLayout : [],
            brands: Array.isArray(parsed.brands) ? parsed.brands : [],
            localPartners: Array.isArray(parsed.localPartners) ? parsed.localPartners : [],
            issues: [],
            loading: false,
            error: false,
          };
        }
      }
    }
  } catch (err) {
    console.warn('[home-config] Falha ao ler cache local de home-config', err);
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
    loading: true,
    error: false,
  };
}

function persistHomeConfigCache(cfg: HomeConfig) {
  try {
    if (typeof window === 'undefined') return;
    const safeHeroBanners = (cfg.heroBanners || []).map(b => {
      if (b.videoUrl && b.videoUrl.startsWith('data:') && b.videoUrl.length > 500_000) {
        return { ...b, videoUrl: '' };
      }
      return b;
    });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        vitrines: cfg.vitrines,
        periodConfig: cfg.periodConfig,
        megaOfertas: cfg.megaOfertas,
        heroBanners: safeHeroBanners,
        condoFavorites: cfg.condoFavorites,
        homeLayout: cfg.homeLayout,
        brands: cfg.brands,
        localPartners: cfg.localPartners,
      })
    );
  } catch {
    // safe fallback if storage quota exceeded
  }
}

type Normalizer<T> = (id: string, raw: unknown) => { value: T | null; issues: ConfigIssue[] };

function readCollection<T>(docs: QueryDocumentSnapshot<DocumentData>[], normalize: Normalizer<T>) {
  const values: T[] = [];
  const issues: ConfigIssue[] = [];
  docs.forEach(d => {
    const result = normalize(d.id, d.data());
    if (result.value) values.push(result.value);
    issues.push(...result.issues);
  });
  reportIssues(issues);
  return { values, issues };
}

export const useHomeConfig = () => {
  const [config, setConfig] = useState<HomeConfig>(loadCachedHomeConfig);

  useEffect(() => {
    const fail = (name: string) => (err: unknown) => {
      console.error(`[home-config] Falha ao ler ${name}.`, err);
      setConfig(prev => ({ ...prev, loading: false, error: true }));
    };

    const unsubs = [
      onSnapshot(collection(db, 'home-config', 'data', 'vitrines'), snap => {
        const { values, issues } = readCollection(snap.docs, normalizeVitrine);
        setConfig(prev => {
          const next = {
            ...prev,
            vitrines: values.sort(byOrderThenId),
            issues: [...prev.issues.filter(i => i.scope !== 'vitrines'), ...issues],
            loading: false,
          };
          persistHomeConfigCache(next);
          return next;
        });
      }, fail('vitrines')),

      onSnapshot(collection(db, 'home-config', 'data', 'period-config'), snap => {
        const { values } = readCollection(snap.docs, normalizePeriodConfig);
        const periods: Record<string, PeriodConfig> = {};
        values.forEach(p => { periods[p.id] = p; });
        setConfig(prev => {
          const next = { ...prev, periodConfig: periods };
          persistHomeConfigCache(next);
          return next;
        });
      }, fail('period-config')),

      onSnapshot(collection(db, 'home-config', 'data', 'mega-ofertas'), snap => {
        const { values } = readCollection(snap.docs, normalizeMegaOferta);
        setConfig(prev => {
          const next = { ...prev, megaOfertas: values.sort(byOrderThenId) };
          persistHomeConfigCache(next);
          return next;
        });
      }, fail('mega-ofertas')),

      onSnapshot(collection(db, 'home-config', 'data', 'hero-banners'), snap => {
        const { values } = readCollection(snap.docs, normalizeHeroBanner);
        setConfig(prev => {
          const next = { ...prev, heroBanners: values.sort(byOrderThenId) };
          persistHomeConfigCache(next);
          return next;
        });
      }, fail('hero-banners')),

      onSnapshot(collection(db, 'home-config', 'data', 'condo-favorites'), snap => {
        const { values } = readCollection(snap.docs, normalizeCondoFavorite);
        setConfig(prev => {
          const next = { ...prev, condoFavorites: values.sort(byOrderThenId) };
          persistHomeConfigCache(next);
          return next;
        });
      }, fail('condo-favorites')),

      onSnapshot(collection(db, 'home-config', 'data', 'home-layout'), snap => {
        const { values } = readCollection(snap.docs, normalizeHomeLayoutBlock);
        setConfig(prev => {
          const next = { ...prev, homeLayout: values.sort(byOrderThenId) };
          persistHomeConfigCache(next);
          return next;
        });
      }, fail('home-layout')),

      onSnapshot(collection(db, 'home-config', 'data', 'home-brands'), snap => {
        const { values } = readCollection(snap.docs, (id, raw) => normalizeRoundCardItem('home-brands', id, raw));
        setConfig(prev => {
          const next = { ...prev, brands: values.sort(byOrderThenId) };
          persistHomeConfigCache(next);
          return next;
        });
      }, fail('home-brands')),

      onSnapshot(collection(db, 'home-config', 'data', 'home-partners'), snap => {
        const { values } = readCollection(snap.docs, (id, raw) => normalizeRoundCardItem('home-partners', id, raw));
        setConfig(prev => {
          const next = { ...prev, localPartners: values.sort(byOrderThenId) };
          persistHomeConfigCache(next);
          return next;
        });
      }, fail('home-partners')),
    ];

    return () => unsubs.forEach(unsub => unsub());
  }, []);

  return config;
};
