import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';
import { Product } from '../../types';

export interface CartLine {
  product: Product;
  quantity: number;
  salePrice?: string;
}

interface CartContextValue {
  lines: CartLine[];
  add: (product: Product, salePrice?: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'dropstore_cart';

function readCart(): CartLine[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as CartLine[];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: PropsWithChildren) {
  const [lines, setLines] = useState<CartLine[]>(readCart);
  const persist = (next: CartLine[]) => {
    setLines(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };
  const value = useMemo<CartContextValue>(() => ({
    lines,
    add: (product, salePrice) => {
      const current = lines.find((line) => line.product.id === product.id);
      persist(current
        ? lines.map((line) => line.product.id === product.id
          ? { ...line, quantity: line.quantity + 1, salePrice: salePrice ?? line.salePrice }
          : line)
        : [...lines, { product, quantity: 1, salePrice }]);
    },
    setQuantity: (productId, quantity) => {
      if (quantity < 1) {
        persist(lines.filter((line) => line.product.id !== productId));
        return;
      }
      persist(lines.map((line) => line.product.id === productId ? { ...line, quantity } : line));
    },
    remove: (productId) => persist(lines.filter((line) => line.product.id !== productId)),
    clear: () => persist([]),
  }), [lines]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}
