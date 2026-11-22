import { useState, useEffect } from 'react';

export interface CartItem {
  id: string;
  title: string;
  price: number;
  image: string;
  quantity: number;
}

// Security: limit quantity per item to prevent cart abuse and stock transaction crashes.
const MAX_QUANTITY_PER_ITEM = 50;

// Security: clamp price to a sensible range so manipulated localStorage values
// don't silently pass through to createOrder.
const sanitizePrice = (raw: unknown): number => {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (isNaN(n) || n <= 0) return 0;
  // Upper bound: R$ 9 999,99 — any value above this is almost certainly manipulation.
  return Math.min(Math.max(n, 0), 9999.99);
};

/**
 * Sanitizes cart items before serializing to localStorage.
 * If an item has a massive data URI image (base64 > 1.5KB), strip the image payload
 * to protect the 5MB browser storage quota while retaining vital product data (id, title, price, quantity).
 */
const sanitizeCartItemsForStorage = (items: CartItem[]): CartItem[] => {
  return items.map((item) => {
    const isHugeDataUri =
      typeof item.image === 'string' &&
      item.image.startsWith('data:') &&
      item.image.length > 1500;
    return {
      id: item.id,
      title: item.title,
      price: item.price,
      image: isHugeDataUri ? '' : (item.image || ''),
      quantity: item.quantity,
    };
  });
};

/**
 * Safely persists cart to storage with multi-level self-healing fallback:
 * 1. Standard localStorage.setItem
 * 2. If QuotaExceededError, evicts non-critical caches ('app-products', 'home_snapshot_v1') and retries
 * 3. If still full, strips all images from cart storage
 * 4. If localStorage fails entirely, stores in sessionStorage
 */
const persistCartToStorage = (items: CartItem[]) => {
  const sanitized = sanitizeCartItemsForStorage(items);
  const payload = JSON.stringify(sanitized);

  try {
    localStorage.setItem('app-cart', payload);
    return;
  } catch (err) {
    console.warn('localStorage quota exceeded on app-cart. Attempting self-healing cleanup...', err);
  }

  // Self-healing attempt 1: Evict dispensable large client-side caches (can be re-fetched from Firestore)
  try {
    localStorage.removeItem('app-products');
    localStorage.removeItem('home_snapshot_v1');
    localStorage.setItem('app-cart', payload);
    return;
  } catch {
    // Continue to next fallback
  }

  // Self-healing attempt 2: Strip all images from cart payload
  try {
    const minimalPayload = JSON.stringify(
      items.map((item) => ({
        id: item.id,
        title: item.title,
        price: item.price,
        image: '',
        quantity: item.quantity,
      }))
    );
    localStorage.setItem('app-cart', minimalPayload);
    return;
  } catch {
    // Continue to next fallback
  }

  // Self-healing attempt 3: Fallback to sessionStorage
  try {
    sessionStorage.setItem('app-cart', payload);
  } catch (e) {
    console.error('All storage attempts failed for app-cart:', e);
  }
};

const readCartFromStorage = (): CartItem[] => {
  try {
    const stored = localStorage.getItem('app-cart') || sessionStorage.getItem('app-cart');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export function useCart() {
  const [cartItems, setCartItems] = useState<CartItem[]>(() => readCartFromStorage());

  const loadCart = () => {
    try {
      const items = readCartFromStorage();
      setCartItems(items);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const handleStorageChange = () => {
      loadCart();
    };

    window.addEventListener('app-cart-updated', handleStorageChange);
    return () => {
      window.removeEventListener('app-cart-updated', handleStorageChange);
    };
  }, []);

  const saveCart = (items: CartItem[]) => {
    persistCartToStorage(items);
    setCartItems(items);
    window.dispatchEvent(new Event('app-cart-updated'));
  };

  const addToCart = (product: { id: string; title: string; price?: number; currentPrice?: number; image?: string }, quantity: number = 1) => {
    const sanitizedPrice = sanitizePrice(product.price ?? product.currentPrice);
    const existing = cartItems.find((item) => item.id === product.id);
    let updated: CartItem[];
    if (existing) {
      const newQty = Math.min(existing.quantity + quantity, MAX_QUANTITY_PER_ITEM);
      updated = cartItems.map((item) =>
        item.id === product.id ? { ...item, quantity: newQty } : item
      );
    } else {
      const clampedQty = Math.min(Math.max(quantity, 1), MAX_QUANTITY_PER_ITEM);
      updated = [
        ...cartItems,
        {
          id: product.id,
          title: product.title,
          price: sanitizedPrice,
          image: product.image ?? '',
          quantity: clampedQty,
        },
      ];
    }
    saveCart(updated);
  };

  const removeFromCart = (productId: string) => {
    const updated = cartItems.filter((item) => item.id !== productId);
    saveCart(updated);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    const clampedQty = Math.min(quantity, MAX_QUANTITY_PER_ITEM);
    const updated = cartItems.map((item) =>
      item.id === productId ? { ...item, quantity: clampedQty } : item
    );
    saveCart(updated);
  };

  const clearCart = () => {
    try {
      localStorage.removeItem('app-cart');
      sessionStorage.removeItem('app-cart');
    } catch {
      // Ignore
    }
    setCartItems([]);
    window.dispatchEvent(new Event('app-cart-updated'));
  };

  const totalItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const totalPrice = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    totalItems,
    totalPrice,
  };
}
