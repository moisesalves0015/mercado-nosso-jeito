import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { HomeBootstrapState } from '../utils/homeBootstrap';

interface HomeReadinessContextValue {
  /** Estado atual do coordenador de prontidão da Home. */
  homeState: HomeBootstrapState;
  /** true assim que a Home já foi revelada ao menos uma vez na sessão (evita flash ao voltar de outra rota). */
  hasEverRevealed: boolean;
  /** true quando o shell global (Topbar + BottomNav + mini-carrinho) pode aparecer na rota `/`. */
  isHomeShellReady: boolean;
  /** Atualiza o estado do coordenador da Home. */
  reportHomeState: (next: HomeBootstrapState) => void;
  /** Remove o splash global `#pwa-splash-screen` de forma idempotente e respeitando `prefers-reduced-motion`. */
  dismissAppSplash: () => void;
}

const HomeReadinessContext = createContext<HomeReadinessContextValue | null>(null);

export const HomeReadinessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [homeState, setHomeState] = useState<HomeBootstrapState>('loading');
  const [hasEverRevealed, setHasEverRevealed] = useState(false);
  const splashDismissedRef = useRef(false);

  const dismissAppSplash = useCallback(() => {
    if (splashDismissedRef.current) return;
    splashDismissedRef.current = true;

    const splash = typeof document !== 'undefined' ? document.getElementById('pwa-splash-screen') : null;
    if (!splash) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      splash.remove();
      return;
    }

    splash.classList.add('fade-out');
    window.setTimeout(() => {
      splash.remove();
    }, 420);
  }, []);

  const reportHomeState = useCallback((next: HomeBootstrapState) => {
    setHomeState((prev) => (prev === next ? prev : next));
    if (next === 'ready' || next === 'stale') {
      setHasEverRevealed(true);
    }
  }, []);

  const isHomeShellReady =
    hasEverRevealed || homeState === 'ready' || homeState === 'stale' || homeState === 'error';

  const value = useMemo<HomeReadinessContextValue>(
    () => ({
      homeState,
      hasEverRevealed,
      isHomeShellReady,
      reportHomeState,
      dismissAppSplash,
    }),
    [homeState, hasEverRevealed, isHomeShellReady, reportHomeState, dismissAppSplash],
  );

  return (
    <HomeReadinessContext.Provider value={value}>
      {children}
    </HomeReadinessContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useHomeReadiness(): HomeReadinessContextValue {
  const ctx = useContext(HomeReadinessContext);
  if (!ctx) {
    // Fallback seguro caso renderizado isoladamente em testes
    return {
      homeState: 'ready',
      hasEverRevealed: true,
      isHomeShellReady: true,
      reportHomeState: () => {},
      dismissAppSplash: () => {},
    };
  }
  return ctx;
}

