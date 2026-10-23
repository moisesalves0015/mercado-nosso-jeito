/**
 * useUserDiamonds — saldo real de diamantes do usuário no Clube.
 *
 * Fonte oficial: `users/{uid}/clube/profile` (Firestore).
 * Retorna `null` quando o usuário não estiver autenticado ou o documento ainda não existir.
 * Não utiliza valores fixos ou pontos demonstrativos.
 */
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';

export function useUserDiamonds(): { diamonds: number | null; loading: boolean } {
  const { user } = useAuth();
  const [diamonds, setDiamonds] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(() => Boolean(user));

  useEffect(() => {
    if (!user) {
      return;
    }

    const clubeRef = doc(db, 'users', user.uid, 'clube', 'profile');
    const unsub = onSnapshot(
      clubeRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const val = Number(data.diamonds);
          setDiamonds(Number.isFinite(val) && val >= 0 ? Math.floor(val) : 0);
        } else {
          setDiamonds(null);
        }
        setLoading(false);
      },
      (error) => {
        console.warn('[useUserDiamonds] Não foi possível ler o saldo do clube:', error);
        setDiamonds(null);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  return {
    diamonds: user ? diamonds : null,
    loading: user ? loading : false,
  };
}
