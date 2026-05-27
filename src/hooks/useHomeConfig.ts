import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface VitrineConfig {
  id: string;
  title: string;
  subtitle?: string | string[];
  theme: 'hero' | 'purple' | 'orange' | 'green';
  active: boolean;
  order: number;
  layout: 'horizontal' | 'grid' | 'carousel';
  maxProducts: number;
  productIds: string[];
  validFrom?: string | null;
  validUntil?: string | null;
}

export interface PeriodConfig {
  id: 'morning' | 'lunch' | 'afternoon' | 'night' | 'dawn';
  title: string;
  active: boolean;
  productIds: string[];
  isAuto: boolean; // Se true, o sistema pode mesclar com mais vendidos
}

export interface MegaOfertaConfig {
  id: string;
  productId: string;
  order: number;
  badge?: string;
  badgeStyle?: 'orange' | 'light';
  validUntil?: string | null;
}

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

export interface HomeConfig {
  vitrines: VitrineConfig[];
  periodConfig: Record<string, PeriodConfig>;
  megaOfertas: MegaOfertaConfig[];
  heroBanners: HeroBannerConfig[];
  loading: boolean;
}

export const useHomeConfig = () => {
  const [config, setConfig] = useState<HomeConfig>({
    vitrines: [],
    periodConfig: {},
    megaOfertas: [],
    heroBanners: [],
    loading: true,
  });

  useEffect(() => {
    // Escutar vitrines
    const unsubVitrines = onSnapshot(collection(db, 'home-config', 'data', 'vitrines'), (snap) => {
      const vitrinesData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as VitrineConfig));
      setConfig(prev => ({ ...prev, vitrines: vitrinesData }));
    });

    // Escutar configurações de período
    const unsubPeriods = onSnapshot(collection(db, 'home-config', 'data', 'period-config'), (snap) => {
      const periodsData: Record<string, PeriodConfig> = {};
      snap.docs.forEach(doc => {
        periodsData[doc.id] = { id: doc.id as any, ...doc.data() } as PeriodConfig;
      });
      setConfig(prev => ({ ...prev, periodConfig: periodsData }));
    });

    // Escutar mega ofertas
    const unsubMegaOfertas = onSnapshot(collection(db, 'home-config', 'data', 'mega-ofertas'), (snap) => {
      const megaOfertasData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MegaOfertaConfig));
      setConfig(prev => ({ ...prev, megaOfertas: megaOfertasData }));
    });

    // Escutar hero banners
    const unsubHeroBanners = onSnapshot(collection(db, 'home-config', 'data', 'hero-banners'), (snap) => {
      const heroBannersData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HeroBannerConfig));
      setConfig(prev => ({ ...prev, heroBanners: heroBannersData }));
    });

    // Set loading to false after initial subscriptions
    setConfig(prev => ({ ...prev, loading: false }));

    return () => {
      unsubVitrines();
      unsubPeriods();
      unsubMegaOfertas();
      unsubHeroBanners();
    };
  }, []);

  return config;
};
