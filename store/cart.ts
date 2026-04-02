'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem, CartExtra, DeliveryType } from '@/types';

interface CartState {
  items:        CartItem[];
  extras:       CartExtra[];
  deliveryType: DeliveryType | null;
  deliveryFee:  number;
  tip:          number;

  // Delivery type
  setDeliveryType: (type: DeliveryType, fee: number) => void;

  // Items
  addItem:    (item: Omit<CartItem, 'subtotal'>) => void;
  removeItem: (product_id: string) => void;
  updateQty:  (product_id: string, qty: number) => void;

  // Extras
  addExtra:       (extra: Omit<CartExtra, 'subtotal'>) => void;
  removeExtra:    (extra_id: string) => void;
  updateExtraQty: (extra_id: string, qty: number) => void;

  // Tip
  setTip: (amount: number) => void;

  // Totals
  subtotal: () => number;
  total:    () => number;

  // Reset
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items:        [],
      extras:       [],
      deliveryType: null,
      deliveryFee:  0,
      tip:          0,

      setDeliveryType: (type, fee) => set({ deliveryType: type, deliveryFee: fee }),

      addItem: (incoming) => {
        const { items } = get();
        const idx = items.findIndex(i => i.product_id === incoming.product_id && i.variant_name === incoming.variant_name);
        if (idx >= 0) {
          const updated = [...items];
          updated[idx] = {
            ...updated[idx],
            qty: updated[idx].qty + incoming.qty,
            subtotal: (updated[idx].qty + incoming.qty) * updated[idx].unit_price,
          };
          set({ items: updated });
        } else {
          set({ items: [...items, { ...incoming, subtotal: incoming.qty * incoming.unit_price }] });
        }
      },

      removeItem: (product_id) => set(s => ({
        items: s.items.filter(i => i.product_id !== product_id),
      })),

      updateQty: (product_id, qty) => set(s => ({
        items: s.items.map(i =>
          i.product_id === product_id
            ? { ...i, qty, subtotal: qty * i.unit_price }
            : i
        ).filter(i => i.qty > 0),
      })),

      addExtra: (incoming) => {
        const { extras } = get();
        const idx = extras.findIndex(e => e.extra_id === incoming.extra_id);
        if (idx >= 0) {
          const updated = [...extras];
          updated[idx] = {
            ...updated[idx],
            qty: updated[idx].qty + incoming.qty,
            subtotal: (updated[idx].qty + incoming.qty) * updated[idx].unit_price,
          };
          set({ extras: updated });
        } else {
          set({ extras: [...extras, { ...incoming, subtotal: incoming.qty * incoming.unit_price }] });
        }
      },

      removeExtra: (extra_id) => set(s => ({
        extras: s.extras.filter(e => e.extra_id !== extra_id),
      })),

      updateExtraQty: (extra_id, qty) => set(s => ({
        extras: s.extras.map(e =>
          e.extra_id === extra_id
            ? { ...e, qty, subtotal: qty * e.unit_price }
            : e
        ).filter(e => e.qty > 0),
      })),

      setTip: (amount) => set({ tip: amount }),

      subtotal: () => {
        const { items, extras } = get();
        return (
          items.reduce((s, i) => s + i.subtotal, 0) +
          extras.reduce((s, e) => s + e.subtotal, 0)
        );
      },

      total: () => get().subtotal() + get().deliveryFee + get().tip,

      clear: () => set({ items: [], extras: [], deliveryType: null, deliveryFee: 0, tip: 0 }),
    }),
    { name: 'crispy-cart' }
  )
);
