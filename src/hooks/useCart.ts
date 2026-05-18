import { useState, useEffect } from 'react';

export interface CartItem {
  id: string;
  title: string;
  price: number;
  image: string;
  quantity: number;
}

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
    const existing = cartItems.find((item) => item.id === product.id);
    let updated: CartItem[];
    if (existing) {
      updated = cartItems.map((item) =>
        item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
      );
    } else {
      updated = [
        ...cartItems,
        {
          id: product.id,
          title: product.title,
          price: product.price || product.currentPrice || 0,
          image: product.image,
          quantity: quantity,
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
    const updated = cartItems.map((item) =>
      item.id === productId ? { ...item, quantity } : item
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
