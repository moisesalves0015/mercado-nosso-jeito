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

export const normalizeCondosMap = (rawCondos: any): Record<string, number> => {
  if (!rawCondos) return { ...DEFAULT_SHIPPING.condos };
  const result: Record<string, number> = {};
  if (Array.isArray(rawCondos)) {
    rawCondos.forEach((item: any) => {
      if (typeof item === 'string' && item.trim()) {
        result[item.trim()] = 0;
      } else if (item && typeof item === 'object' && item.name) {
        result[String(item.name).trim()] = Number(item.fee) || 0;
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
  const [config, setConfig] = useState<ShippingConfig>(() => {
    try {
      const cached = localStorage.getItem('app-shipping-config');
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          freeShippingThreshold: Number(parsed.freeShippingThreshold ?? DEFAULT_SHIPPING.freeShippingThreshold),
          baseShippingFee: Number(parsed.baseShippingFee ?? DEFAULT_SHIPPING.baseShippingFee),
          condos: normalizeCondosMap(parsed.condos),
        };
      }
    } catch (e) {
      console.error('Error parsing cached shipping config', e);
    }
    return DEFAULT_SHIPPING;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'settings', 'shipping');
    const unsub = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const normalized: ShippingConfig = {
          freeShippingThreshold: Number(data.freeShippingThreshold ?? DEFAULT_SHIPPING.freeShippingThreshold),
          baseShippingFee: Number(data.baseShippingFee ?? DEFAULT_SHIPPING.baseShippingFee),
          condos: normalizeCondosMap(data.condos || data.condosList),
        };
        setConfig(normalized);
        localStorage.setItem('app-shipping-config', JSON.stringify(normalized));
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
            localStorage.setItem('app-shipping-config', JSON.stringify(normalized));
          } else {
            setConfig(DEFAULT_SHIPPING);
          }
        } catch {
          setConfig(DEFAULT_SHIPPING);
        }
        setLoading(false);
      }
    }, (error) => {
      console.warn("Could not subscribe to settings/shipping, trying configs/shipping fallback:", error);
      getDoc(doc(db, 'configs', 'shipping')).then(fallbackSnap => {
        if (fallbackSnap.exists()) {
          const data = fallbackSnap.data();
          const normalized: ShippingConfig = {
            freeShippingThreshold: Number(data.freeShippingThreshold ?? DEFAULT_SHIPPING.freeShippingThreshold),
            baseShippingFee: Number(data.baseShippingFee ?? DEFAULT_SHIPPING.baseShippingFee),
            condos: normalizeCondosMap(data.condos || data.condosList),
          };
          setConfig(normalized);
          localStorage.setItem('app-shipping-config', JSON.stringify(normalized));
        }
      }).catch(e => {
        console.error("Fallback error:", e);
      }).finally(() => {
        setLoading(false);
      });
    });

    return () => unsub();
  }, []);

  return { config, loading };
};
