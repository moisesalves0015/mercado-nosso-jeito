import { useState, useEffect } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface ShippingConfig {
  freeShippingThreshold: number;
  baseShippingFee: number;
  condos: Record<string, number>;
}

export const DEFAULT_SHIPPING: ShippingConfig = {
  freeShippingThreshold: 60,
  baseShippingFee: 5.00,
  condos: {
    'Condomínio Vitória': 0.00,
    'Residencial Flores': 5.90,
  }
};

export const normalizeCondosMap = (rawCondos: unknown): Record<string, number> => {
  if (!rawCondos) return { ...DEFAULT_SHIPPING.condos };
  const result: Record<string, number> = {};
  if (Array.isArray(rawCondos)) {
    rawCondos.forEach((item: unknown) => {
      if (typeof item === 'string' && item.trim()) {
        result[item.trim()] = 0;
      } else if (item && typeof item === 'object' && 'name' in item) {
        const namedItem = item as { name: unknown; fee?: unknown };
        result[String(namedItem.name).trim()] = Number(namedItem.fee) || 0;
      }
    });
  } else if (typeof rawCondos === 'object') {
    Object.entries(rawCondos).forEach(([k, v]) => {
      if (k && k.trim()) {
        result[k.trim()] = Number(v) || 0;
      }
    });
  }
  return Object.keys(result).length > 0 ? result : { ...DEFAULT_SHIPPING.condos };
};

export const useShippingConfig = () => {
  const [initialState] = useState<{ config: ShippingConfig; hasCache: boolean }>(() => {
    try {
      const cached = localStorage.getItem('app-shipping-config');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          return {
            config: {
              freeShippingThreshold: Number(parsed.freeShippingThreshold ?? DEFAULT_SHIPPING.freeShippingThreshold),
              baseShippingFee: Number(parsed.baseShippingFee ?? DEFAULT_SHIPPING.baseShippingFee),
              condos: normalizeCondosMap(parsed.condos),
            },
            hasCache: true,
          };
        }
      }
    } catch {
      // ignore corrupted shipping cache
    }
    return { config: DEFAULT_SHIPPING, hasCache: false };
  });

  const [config, setConfig] = useState<ShippingConfig>(initialState.config);
  const [loading, setLoading] = useState(!initialState.hasCache);

  useEffect(() => {
    const safetyTimer = window.setTimeout(() => setLoading(false), 5000);
    const docRef = doc(db, 'settings', 'shipping');
    const unsub = onSnapshot(docRef, async (docSnap) => {
      window.clearTimeout(safetyTimer);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const normalized: ShippingConfig = {
          freeShippingThreshold: Number(data.freeShippingThreshold ?? DEFAULT_SHIPPING.freeShippingThreshold),
          baseShippingFee: Number(data.baseShippingFee ?? DEFAULT_SHIPPING.baseShippingFee),
          condos: normalizeCondosMap(data.condos || data.condosList),
        };
        setConfig(normalized);
        try {
          localStorage.setItem('app-shipping-config', JSON.stringify(normalized));
        } catch {
          // ignore quota error
        }
        setLoading(false);
      } else {
        // Try fallback to configs/shipping
        try {
          const fallbackSnap = await getDoc(doc(db, 'configs', 'shipping'));
          if (fallbackSnap.exists()) {
            const data = fallbackSnap.data();
            const normalized: ShippingConfig = {
              freeShippingThreshold: Number(data.freeShippingThreshold ?? DEFAULT_SHIPPING.freeShippingThreshold),
              baseShippingFee: Number(data.baseShippingFee ?? DEFAULT_SHIPPING.baseShippingFee),
              condos: normalizeCondosMap(data.condos || data.condosList),
            };
            setConfig(normalized);
            try {
              localStorage.setItem('app-shipping-config', JSON.stringify(normalized));
            } catch {
              // ignore quota error
            }
          } else {
            setConfig(DEFAULT_SHIPPING);
          }
        } catch {
          setConfig(DEFAULT_SHIPPING);
        }
        setLoading(false);
      }
    }, () => {
      window.clearTimeout(safetyTimer);
      getDoc(doc(db, 'configs', 'shipping')).then(fallbackSnap => {
        if (fallbackSnap.exists()) {
          const data = fallbackSnap.data();
          const normalized: ShippingConfig = {
            freeShippingThreshold: Number(data.freeShippingThreshold ?? DEFAULT_SHIPPING.freeShippingThreshold),
            baseShippingFee: Number(data.baseShippingFee ?? DEFAULT_SHIPPING.baseShippingFee),
            condos: normalizeCondosMap(data.condos || data.condosList),
          };
          setConfig(normalized);
          try {
            localStorage.setItem('app-shipping-config', JSON.stringify(normalized));
          } catch {
            // ignore quota error
          }
        }
      }).catch(() => {
        // fallback silently to DEFAULT_SHIPPING
      }).finally(() => {
        setLoading(false);
      });
    });

    return () => {
      window.clearTimeout(safetyTimer);
      unsub();
    };
  }, []);

  return { config, loading };
};
