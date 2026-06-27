import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface ShippingConfig {
  freeShippingThreshold: number;
  baseShippingFee: number;
  condos: Record<string, number>;
}

const DEFAULT_SHIPPING: ShippingConfig = {
  freeShippingThreshold: 60,
  baseShippingFee: 5.00,
  condos: {
    'Condomínio Vitória': 0.00,
    'Residencial Flores': 5.90,
  }
};

export const useShippingConfig = () => {
  const [config, setConfig] = useState<ShippingConfig>(() => {
    const cached = localStorage.getItem('app-shipping-config');
    return cached ? JSON.parse(cached) : DEFAULT_SHIPPING;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docRef = doc(db, 'settings', 'shipping');
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as ShippingConfig;
        setConfig(data);
        localStorage.setItem('app-shipping-config', JSON.stringify(data));
      } else {
        // Initialize if not existing
        setDoc(docRef, DEFAULT_SHIPPING).catch(err => console.error(err));
        setConfig(DEFAULT_SHIPPING);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error reading shipping config:", error);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { config, loading };
};
