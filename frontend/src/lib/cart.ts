/**
 * Store cart (Do'kon) — LocalStorage-backed, inquiry-style.
 * Items are persisted under "uy:" and survive page reloads. The cart is a
 * request list, not a payment basket: checkout bundles every line into one
 * store inquiry (POST /api/calc/inquiry/).
 */
import type { StoreProduct } from '../api/client';

export interface CartItem {
  product: StoreProduct;
  quantity: number;
}

const STORAGE_KEY = 'uy:store-cart';
const MAX_QUANTITY = 999;

type Listener = () => void;
const listeners = new Set<Listener>();

function read(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (i): i is CartItem =>
        Boolean(i) &&
        typeof (i as CartItem).product?.id === 'number' &&
        (i as CartItem).quantity > 0,
    );
  } catch {
    return [];
  }
}

function write(items: CartItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage full / private mode — cart stays in memory for the session
  }
  listeners.forEach((l) => l());
}

/** Subscribe to cart changes; returns an unsubscribe fn. */
export function subscribeCart(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCart(): CartItem[] {
  return read();
}

export function getCartCount(): number {
  return read().reduce((n, i) => n + i.quantity, 0);
}

export function getCartSubtotal(): number {
  return read().reduce((s, i) => s + i.product.price * i.quantity, 0);
}

/** Orderable quantity is capped by available stock (min 1 so restock requests work). */
export function getMaxQty(product: StoreProduct): number {
  return Math.min(MAX_QUANTITY, Math.max(1, product.stock_quantity));
}

export function addToCart(product: StoreProduct, quantity = 1): CartItem[] {
  const items = read();
  const existing = items.find((i) => i.product.id === product.id);
  const max = getMaxQty(product);
  if (existing) existing.quantity = Math.min(existing.quantity + quantity, max);
  else items.push({ product, quantity: Math.min(quantity, max) });
  write(items);
  return items;
}

export function addManyToCart(entries: { product: StoreProduct; quantity: number }[]): CartItem[] {
  const items = read();
  for (const { product, quantity } of entries) {
    if (!product || quantity <= 0) continue;
    const existing = items.find((i) => i.product.id === product.id);
    const max = getMaxQty(product);
    if (existing) existing.quantity = Math.min(existing.quantity + quantity, max);
    else items.push({ product, quantity: Math.min(quantity, max) });
  }
  write(items);
  return items;
}

export function removeFromCart(productId: number): CartItem[] {
  const items = read().filter((i) => i.product.id !== productId);
  write(items);
  return items;
}

export function setCartQuantity(productId: number, quantity: number): CartItem[] {
  const items = read();
  const existing = items.find((i) => i.product.id === productId);
  if (existing) {
    existing.quantity = Math.min(
      Math.max(1, Math.round(quantity)),
      getMaxQty(existing.product),
    );
    write(items);
  }
  return items;
}

export function clearCart(): void {
  write([]);
}
