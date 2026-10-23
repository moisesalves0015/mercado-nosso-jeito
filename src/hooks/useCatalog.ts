/**
 * useCatalog — catálogo oficial para a Home.
 *
 * Fonte: coleção Firestore `products`. O App.tsx mantém um listener em tempo real e grava o
 * resultado em `localStorage['app-products']`, disparando `app-products-updated`; este hook
 * apenas LÊ esse cache (o mesmo usado por busca, detalhe e carrinho), de modo que todas as
 * telas compartilham exatamente o mesmo catálogo.
 *
 * Estados:
 *  - `loading`: o cache ainda não foi gravado (o Firestore não respondeu).
 *  - `error`: cache ilegível, ou sem resposta após `LOAD_TIMEOUT_MS`.
 *  - `ready`: catálogo carregado (pode estar vazio — isso é "sem conteúdo", não "carregando").
 */
import { useEffect, useMemo, useState } from 'react';
import type { HomeProduct } from '../types/home';
import { normalizeHomeProduct } from '../utils/homeProducts';

const STORAGE_KEY = 'app-products';
const UPDATE_EVENT = 'app-products-updated';
const LOAD_TIMEOUT_MS = 8000;

export type CatalogStatus = 'loading' | 'ready' | 'error';

interface CatalogState {
  products: HomeProduct[];
  status: CatalogStatus;
}

function readCatalog(): CatalogState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return { products: [], status: 'loading' };
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return { products: [], status: 'error' };
    const products = parsed
      .map(normalizeHomeProduct)
      .filter((p): p is HomeProduct => p !== null);
    return { products, status: 'ready' };
  } catch (error) {
    console.error('Não foi possível ler o catálogo armazenado.', error);
    return { products: [], status: 'error' };
  }
}

export function useCatalog() {
  const [state, setState] = useState<CatalogState>(readCatalog);

  useEffect(() => {
    const refresh = () => setState(readCatalog());
    window.addEventListener(UPDATE_EVENT, refresh);
    window.addEventListener('storage', refresh);

    // Sem resposta do Firestore: não deixar a Home em "carregando" para sempre.
    const timeout = window.setTimeout(() => {
      setState(prev => (prev.status === 'loading' ? { products: [], status: 'error' } : prev));
    }, LOAD_TIMEOUT_MS);

    return () => {
      window.removeEventListener(UPDATE_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      window.clearTimeout(timeout);
    };
  }, []);

  const byId = useMemo(() => new Map(state.products.map(p => [p.id, p] as const)), [state.products]);

  return {
    products: state.products,
    byId,
    status: state.status,
    loading: state.status === 'loading',
    error: state.status === 'error',
  };
}

export type Catalog = ReturnType<typeof useCatalog>;
