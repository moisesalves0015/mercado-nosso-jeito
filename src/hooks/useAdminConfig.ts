import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface AdminConfig {
  pixKey: string;
  pixName: string;
  supportPhone: string;
  storeHours: string;
}

export const useAdminConfig = () => {
  const [config, setConfig] = useState<AdminConfig>({
    pixKey: '',
    pixName: '',
    supportPhone: '',
    storeHours: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'admin'), (docSnap) => {
      if (docSnap.exists()) {
        setConfig(docSnap.data() as AdminConfig);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { config, loading };
};
