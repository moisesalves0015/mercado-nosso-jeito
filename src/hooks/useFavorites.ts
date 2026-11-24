import { useState, useEffect, useCallback } from 'react';

const FAVORITES_KEY = 'mercado_favorites_ids';

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const stored = localStorage.getItem(FAVORITES_KEY);
        setFavoriteIds(stored ? JSON.parse(stored) : []);
      } catch {
        setFavoriteIds([]);
      }
    };

    window.addEventListener('favorites-updated', handleStorageChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('favorites-updated', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const toggleFavorite = useCallback((productId: string) => {
    if (!productId) return;
    setFavoriteIds(prev => {
      const exists = prev.includes(productId);
      const updated = exists ? prev.filter(id => id !== productId) : [...prev, productId];
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error('Erro ao salvar favoritos no localStorage', err);
      }
      window.dispatchEvent(new Event('favorites-updated'));
      return updated;
    });
  }, []);

  const isFavorite = useCallback((productId: string) => {
    return favoriteIds.includes(productId);
  }, [favoriteIds]);

  return {
    favoriteIds,
    toggleFavorite,
    isFavorite,
    count: favoriteIds.length,
  };
}
