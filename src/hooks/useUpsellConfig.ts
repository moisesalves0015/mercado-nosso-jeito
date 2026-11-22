import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { UpsellShowcaseConfig, UpsellShowcaseId } from '../types/home';
import { defaultUpsellConfig, normalizeUpsellConfig } from '../utils/upsellRecommendations';

export interface UpsellConfigMap {
  cart: UpsellShowcaseConfig;
  checkout: UpsellShowcaseConfig;
}

const DEFAULT_MAP: UpsellConfigMap = {
  cart: defaultUpsellConfig('cart'),
  checkout: defaultUpsellConfig('checkout'),
};

export function useUpsellConfig(): UpsellConfigMap {
  const [configs, setConfigs] = useState<UpsellConfigMap>(DEFAULT_MAP);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'home-config', 'data', 'upsell-config'),
      (snap) => {
        const next: UpsellConfigMap = {
          cart: defaultUpsellConfig('cart'),
          checkout: defaultUpsellConfig('checkout'),
        };
        snap.docs.forEach((d) => {
          if (d.id === 'cart' || d.id === 'checkout') {
            const id = d.id as UpsellShowcaseId;
            next[id] = normalizeUpsellConfig(id, d.data() as Record<string, unknown>);
          }
        });
        setConfigs(next);
      },
      () => {
        // Fallback silencioso para configuração padrão em modo auto
      },
    );
    return unsub;
  }, []);

  return configs;
}
