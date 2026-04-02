'use client';

import { useRouter } from 'next/navigation';
import { useCart } from '@/store/cart';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CartDrawer({ open, onClose }: Props) {
  const router     = useRouter();
  const items      = useCart(s => s.items);
  const extras     = useCart(s => s.extras);
  const subtotal   = useCart(s => s.subtotal);
  const total      = useCart(s => s.total);
  const deliveryFee = useCart(s => s.deliveryFee);
  const deliveryType = useCart(s => s.deliveryType);
  const updateQty  = useCart(s => s.updateQty);
  const removeItem = useCart(s => s.removeItem);

  const isEmpty = items.length === 0;

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/70 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-brand-gray border-l border-white/10 z-50 flex flex-col animate-slide-up md:animate-none">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-xl font-black">Tu carrito 🛒</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        {/* Tipo de entrega */}
        <div className="px-5 py-3 border-b border-white/10 bg-brand-black/30">
          <span className="text-xs text-gray-400">Entrega: </span>
          <span className="text-sm font-semibold text-brand-orange">
            {deliveryType === 'pickup' ? '🏪 Recoger en tienda' : '🛵 Domicilio'}
          </span>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <span className="text-5xl mb-3">🍽️</span>
              <p>Tu carrito está vacío</p>
            </div>
          ) : (
            <>
              {items.map(item => (
                <div key={`${item.product_id}-${item.variant_name}`} className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-white font-semibold text-sm">{item.product_name}</p>
                    <p className="text-gray-400 text-xs">{item.variant_name} · ${item.unit_price} c/u</p>
                  </div>
                  {/* Qty controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(item.product_id, item.variant_name, item.qty - 1)}
                      className="w-7 h-7 rounded-full bg-brand-card hover:bg-brand-red text-white font-bold flex items-center justify-center text-sm transition-colors"
                    >
                      −
                    </button>
                    <span className="text-white font-bold w-4 text-center text-sm">{item.qty}</span>
                    <button
                      onClick={() => updateQty(item.product_id, item.variant_name, item.qty + 1)}
                      className="w-7 h-7 rounded-full bg-brand-card hover:bg-brand-red text-white font-bold flex items-center justify-center text-sm transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-white font-bold text-sm w-14 text-right">${item.subtotal}</span>
                </div>
              ))}

              {extras.length > 0 && (
                <>
                  <div className="border-t border-white/10 pt-3">
                    <p className="text-gray-400 text-xs mb-2 font-semibold uppercase tracking-wider">Extras</p>
                    {extras.map(e => (
                      <div key={e.extra_id} className="flex justify-between text-sm py-1">
                        <span className="text-gray-300">{e.qty}× {e.extra_name}</span>
                        <span className="text-white font-semibold">${e.subtotal}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!isEmpty && (
          <div className="p-5 border-t border-white/10 space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal</span><span>${subtotal()}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between text-gray-400">
                  <span>Envío</span><span>${deliveryFee}</span>
                </div>
              )}
              <div className="flex justify-between text-white font-black text-lg pt-1 border-t border-white/10">
                <span>Total</span><span>${total()}</span>
              </div>
            </div>
            <button
              onClick={() => { onClose(); router.push('/checkout'); }}
              className="btn-primary w-full text-center text-base"
            >
              Ir a pagar →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
