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
  const [config, setConfig] = useState<AdminConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const safetyTimer = window.setTimeout(() => setLoading(false), 5000);
    const unsub = onSnapshot(doc(db, 'settings', 'admin'), (docSnap) => {
      window.clearTimeout(safetyTimer);
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Campos ausentes/inválidos viram string vazia (nunca undefined nos componentes).
        setConfig({
          pixKey: text(data.pixKey),
          pixName: text(data.pixName),
          supportPhone: text(data.supportPhone),
          storeHours: text(data.storeHours),
          deliveryEta: text(data.deliveryEta),
        });
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
