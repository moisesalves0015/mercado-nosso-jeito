import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

/** `settings/admin` — leitura pública (regras Firestore); escrita apenas por admin. */
export interface AdminConfig {
  pixKey: string;
  pixName: string;
  supportPhone: string;
  storeHours: string;
  /** Prazo de entrega exibido na Home (ex.: "20 min"). Vazio = a Home não promete prazo. */
  deliveryEta: string;
}

const DEFAULT_CONFIG: AdminConfig = {
  pixKey: '',
  pixName: '',
  supportPhone: '',
  storeHours: '',
  deliveryEta: '',
};

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const useAdminConfig = () => {
  const [initialState] = useState<{ config: AdminConfig; hasCache: boolean }>(() => {
    try {
      const cached = typeof window !== 'undefined' ? localStorage.getItem('app-admin-config') : null;
      if (cached) {
        const data = JSON.parse(cached);
        if (data && typeof data === 'object') {
          return {
            config: {
              pixKey: text(data.pixKey),
              pixName: text(data.pixName),
              supportPhone: text(data.supportPhone),
              storeHours: text(data.storeHours),
              deliveryEta: text(data.deliveryEta),
            },
            hasCache: true,
          };
        }
      }
    } catch {
      // ignore corrupted cache
    }
    return { config: DEFAULT_CONFIG, hasCache: false };
  });

  const [config, setConfig] = useState<AdminConfig>(initialState.config);
  const [loading, setLoading] = useState(!initialState.hasCache);

  useEffect(() => {
    const safetyTimer = window.setTimeout(() => setLoading(false), 2200);
    const unsub = onSnapshot(doc(db, 'settings', 'admin'), (docSnap) => {
      window.clearTimeout(safetyTimer);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const next: AdminConfig = {
          pixKey: text(data.pixKey),
          pixName: text(data.pixName),
          supportPhone: text(data.supportPhone),
          storeHours: text(data.storeHours),
          deliveryEta: text(data.deliveryEta),
        };
        setConfig(next);
        try {
          localStorage.setItem('app-admin-config', JSON.stringify(next));
        } catch {
          // ignore quota error
        }
      }
      setLoading(false);
    }, () => {
      window.clearTimeout(safetyTimer);
      console.warn('[settings/admin] Falha ao ler configuração.');
      setLoading(false);
    });
    return () => {
      window.clearTimeout(safetyTimer);
      unsub();
    };
  }, []);

  return { config, loading };
};
