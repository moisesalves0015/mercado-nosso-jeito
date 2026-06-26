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

export function useCart() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const loadCart = () => {
    try {
      const stored = localStorage.getItem('app-cart');
      if (stored) {
        setCartItems(JSON.parse(stored));
      } else {
        setCartItems([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadCart();

    const handleStorageChange = () => {
      loadCart();
    };

    window.addEventListener('app-cart-updated', handleStorageChange);
    return () => {
      window.removeEventListener('app-cart-updated', handleStorageChange);
    };
  }, []);

  const saveCart = (items: CartItem[]) => {
    localStorage.setItem('app-cart', JSON.stringify(items));
    setCartItems(items);
    window.dispatchEvent(new Event('app-cart-updated'));
  };

  const addToCart = (product: any, quantity: number = 1) => {
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
          image: product.image,
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
    saveCart([]);
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
