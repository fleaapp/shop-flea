import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Listing } from '@/types/listing';

const CART_STORAGE_KEY = 'flea-cart-items';

interface CartContextType {
  cartItems: Listing[];
  addToCart: (listing: Listing) => void;
  removeFromCart: (id: string) => void;
  isInCart: (id: string) => boolean;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cartItems, setCartItems] = useState<Listing[]>(() => {
    // Initialize from localStorage
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Persist to localStorage whenever cart changes
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch (error) {
      console.error('Failed to save cart to localStorage:', error);
    }
  }, [cartItems]);

  const addToCart = (listing: Listing) => {
    setCartItems((prev) => {
      if (prev.find((item) => item.id === listing.id)) return prev;
      return [...prev, listing];
    });
  };

  const removeFromCart = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const isInCart = (id: string) => {
    return cartItems.some((item) => item.id === id);
  };

  const clearCart = () => {
    setCartItems([]);
  };

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, isInCart, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
