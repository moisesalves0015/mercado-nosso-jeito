/**
 * useDefaultCondo — nome do condomínio do usuário logado.
 *
 * Fonte: `users/{uid}/addresses` (regra Firestore: só o dono lê). O endereço padrão
 * (`isDefault`) é usado; sem ele, o primeiro endereço. O onboarding grava o condomínio em
 * `street` com `neighborhood: 'Condomínio'`.
 * Retorna `null` para visitante, usuário sem endereço ou erro de leitura.
 */
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';

export function useDefaultCondo(): string | null {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [state, setState] = useState<{ uid: string | null; name: string | null }>({ uid: null, name: null });

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      collection(db, 'users', uid, 'addresses'),
      snap => {
        const addresses = snap.docs.map(d => d.data() as { street?: unknown; isDefault?: unknown });
        const chosen = addresses.find(a => a.isDefault === true) ?? addresses[0];
        const street = typeof chosen?.street === 'string' ? chosen.street.trim() : '';
        setState({ uid, name: street || null });
      },
      error => {
        console.warn('[addresses] Não foi possível ler o endereço padrão.', error);
        setState({ uid, name: null });
      },
    );
    return () => unsub();
  }, [uid]);

  // Evita mostrar o condomínio de uma sessão anterior após logout/troca de usuário.
  return uid && state.uid === uid ? state.name : null;
}
