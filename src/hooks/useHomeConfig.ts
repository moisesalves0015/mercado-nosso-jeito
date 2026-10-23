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
  MegaOfertaConfig,
  PeriodConfig,
  VitrineConfig,
} from '../types/home';
import {
  byOrderThenId,
  normalizeCondoFavorite,
  normalizeHeroBanner,
  normalizeMegaOferta,
  normalizePeriodConfig,
  normalizeVitrine,
} from '../utils/homeProducts';
import type { ConfigIssue } from '../utils/homeProducts';

export type {
  VitrineConfig,
  PeriodConfig,
  MegaOfertaConfig,
  HeroBannerConfig,
  CondoFavoriteConfig,
} from '../types/home';

export interface HomeConfig {
  vitrines: VitrineConfig[];
  periodConfig: Record<string, PeriodConfig>;
  megaOfertas: MegaOfertaConfig[];
  heroBanners: HeroBannerConfig[];
  condoFavorites: CondoFavoriteConfig[];
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
  const [config, setConfig] = useState<HomeConfig>({
    vitrines: [],
    periodConfig: {},
    megaOfertas: [],
    heroBanners: [],
    condoFavorites: [],
    issues: [],
    loading: true,
    error: false,
  });

  useEffect(() => {
    const fail = (name: string) => (err: unknown) => {
      console.error(`[home-config] Falha ao ler ${name}.`, err);
      setConfig(prev => ({ ...prev, loading: false, error: true }));
    };

    const unsubs = [
      onSnapshot(collection(db, 'home-config', 'data', 'vitrines'), snap => {
        const { values, issues } = readCollection(snap.docs, normalizeVitrine);
        setConfig(prev => ({
          ...prev,
          vitrines: values.sort(byOrderThenId),
          issues: [...prev.issues.filter(i => i.scope !== 'vitrines'), ...issues],
          loading: false,
        }));
      }, fail('vitrines')),

      onSnapshot(collection(db, 'home-config', 'data', 'period-config'), snap => {
        const { values } = readCollection(snap.docs, normalizePeriodConfig);
        const periods: Record<string, PeriodConfig> = {};
        values.forEach(p => { periods[p.id] = p; });
        setConfig(prev => ({ ...prev, periodConfig: periods }));
      }, fail('period-config')),

      onSnapshot(collection(db, 'home-config', 'data', 'mega-ofertas'), snap => {
        const { values } = readCollection(snap.docs, normalizeMegaOferta);
        setConfig(prev => ({ ...prev, megaOfertas: values.sort(byOrderThenId) }));
      }, fail('mega-ofertas')),

      onSnapshot(collection(db, 'home-config', 'data', 'hero-banners'), snap => {
        const { values } = readCollection(snap.docs, normalizeHeroBanner);
        setConfig(prev => ({ ...prev, heroBanners: values.sort(byOrderThenId) }));
      }, fail('hero-banners')),

      onSnapshot(collection(db, 'home-config', 'data', 'condo-favorites'), snap => {
        const { values } = readCollection(snap.docs, normalizeCondoFavorite);
        setConfig(prev => ({ ...prev, condoFavorites: values.sort(byOrderThenId) }));
      }, fail('condo-favorites')),
    ];

    return () => unsubs.forEach(unsub => unsub());
  }, []);

  return config;
};
