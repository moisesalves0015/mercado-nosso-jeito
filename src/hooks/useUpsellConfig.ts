import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { UpsellShowcaseConfig, UpsellShowcaseId } from '../types/home';
import { defaultUpsellConfig, normalizeUpsellConfig } from '../utils/upsellRecommendations';

export interface UpsellConfigMap {
  cart: UpsellShowcaseConfig;
  checkout: UpsellShowcaseConfig;
}

const STORAGE_KEY = 'app-upsell-config';

const DEFAULT_MAP: UpsellConfigMap = {
  cart: defaultUpsellConfig('cart'),
  checkout: defaultUpsellConfig('checkout'),
};

function loadCachedUpsell(): UpsellConfigMap {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UpsellConfigMap>;
      return {
        cart: parsed.cart ? normalizeUpsellConfig('cart', parsed.cart as unknown as Record<string, unknown>) : DEFAULT_MAP.cart,
        checkout: parsed.checkout ? normalizeUpsellConfig('checkout', parsed.checkout as unknown as Record<string, unknown>) : DEFAULT_MAP.checkout,
      };
    }
  } catch {
    // ignore corrupted cache
  }
  return DEFAULT_MAP;
}

export function useUpsellConfig(): UpsellConfigMap {
  const [configs, setConfigs] = useState<UpsellConfigMap>(loadCachedUpsell);

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
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore storage quota
        }
      },
      () => {
        // Fallback silencioso para configuração padrão em modo auto
      },
    );
    return unsub;
  }, []);

  return configs;
}
