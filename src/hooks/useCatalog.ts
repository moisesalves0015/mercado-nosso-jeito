/**
 * useCatalog — catálogo oficial e resiliente para a Home, Carrinho, Checkout e Vitrines.
 *
 * Estratégia de carregamento em múltiplos níveis (Offline-First):
 *  1. Memória ativa em tempo real (getInMemoryProducts)
 *  2. Cache persistente em localStorage['app-products']
 *  3. Cache secundário em sessionStorage['app-products']
 *  4. Fallback imediato e consistente com defaultProducts
 *
 * Garante que a aplicação NUNCA trave em "carregando" ou exiba "erro de sinal / sem conexão"
 * caso o localStorage falhe por quota ou o Firestore demore a responder.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HomeProduct } from '../types/home';
import { normalizeHomeProduct } from '../utils/homeProducts';
import { getInMemoryProducts } from '../services/imageUploadService';
import { defaultProducts } from '../data/defaultProducts';

const STORAGE_KEY = 'app-products';
const UPDATE_EVENT = 'app-products-updated';
const ERROR_EVENT = 'app-products-error';
const RETRY_EVENT = 'app-products-retry';
const LOAD_TIMEOUT_MS = 6000;

export type CatalogStatus = 'loading' | 'ready' | 'error';

interface CatalogState {
  products: HomeProduct[];
  status: CatalogStatus;
}

const getDefaultCatalogProducts = (): HomeProduct[] => {
  try {
    return (defaultProducts as unknown as Record<string, unknown>[])
      .map(normalizeHomeProduct)
      .filter((p): p is HomeProduct => p !== null && p.active !== false);
  } catch {
    return [];
  }
};

function readCatalog(): CatalogState {
  try {
    // 1. Memória ativa mais recente em tempo real
    const mem = getInMemoryProducts();
    if (mem && mem.length > 0) {
      const products = mem
        .map(normalizeHomeProduct)
        .filter((p): p is HomeProduct => p !== null);
      if (products.length > 0) {
        return { products, status: 'ready' };
      }
    }

    // 2. Cache em localStorage
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored !== null) {
      try {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const products = parsed
            .map(normalizeHomeProduct)
            .filter((p): p is HomeProduct => p !== null);
          if (products.length > 0) {
            return { products, status: 'ready' };
          }
        }
      } catch {
        // Cache corrompido, limpa com segurança
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
      }
    }

    // 3. Cache secundário em sessionStorage
    const sessionStored = typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null;
    if (sessionStored !== null) {
      try {
        const parsed: unknown = JSON.parse(sessionStored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const products = parsed
            .map(normalizeHomeProduct)
            .filter((p): p is HomeProduct => p !== null);
          if (products.length > 0) {
            return { products, status: 'ready' };
          }
        }
      } catch {
        // ignore
      }
    }

    // 4. Fallback imediato com defaultProducts para disponibilidade garantida
    const defaults = getDefaultCatalogProducts();
    if (defaults.length > 0) {
      return { products: defaults, status: 'ready' };
    }

    return { products: [], status: 'loading' };
  } catch (err) {
    console.warn('[catalog] Falha ao ler catálogo local, aplicando produtos padrão:', err);
    const defaults = getDefaultCatalogProducts();
    return { products: defaults, status: 'ready' };
  }
}

export function useCatalog() {
  const [state, setState] = useState<CatalogState>(readCatalog);
  const [retryNonce, setRetryNonce] = useState(0);

  const retry = useCallback(() => {
    setState((prev) => (prev.products.length > 0 ? prev : readCatalog()));
    setRetryNonce((n) => n + 1);
    window.dispatchEvent(new Event(RETRY_EVENT));
  }, []);

  useEffect(() => {
    const refresh = () => setState(readCatalog());
    const onError = () => {
      setState((prev) => {
        if (prev.products.length > 0) return prev;
        const defaults = getDefaultCatalogProducts();
        return { products: defaults, status: defaults.length > 0 ? 'ready' : 'error' };
      });
    };

    window.addEventListener(UPDATE_EVENT, refresh);
    window.addEventListener(ERROR_EVENT, onError);
    window.addEventListener('storage', refresh);

    // Sem resposta do Firestore: se ainda estiver em loading sem produtos, promove fallback defaultProducts
    const timeout = window.setTimeout(() => {
      setState((prev) => {
        if (prev.status !== 'loading' || prev.products.length > 0) return prev;
        const defaults = getDefaultCatalogProducts();
        return { products: defaults, status: defaults.length > 0 ? 'ready' : 'error' };
      });
    }, LOAD_TIMEOUT_MS);

    return () => {
      window.removeEventListener(UPDATE_EVENT, refresh);
      window.removeEventListener(ERROR_EVENT, onError);
      window.removeEventListener('storage', refresh);
      window.clearTimeout(timeout);
    };
  }, [retryNonce]);

  const byId = useMemo(
    () => new Map(state.products.map((p) => [p.id, p] as const)),
    [state.products],
  );

  return {
    products: state.products,
    byId,
    status: state.status,
    loading: state.status === 'loading',
    error: state.status === 'error',
    retry,
  };
}

export type Catalog = ReturnType<typeof useCatalog>;
