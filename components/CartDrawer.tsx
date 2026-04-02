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
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-brand-paper border-l border-brand-line z-50 flex flex-col animate-slide-up md:animate-none text-brand-ink">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-brand-line">
          <h2 className="font-display text-5xl leading-none text-brand-ink">Carrito</h2>
          <button onClick={onClose} className="text-brand-muted hover:text-brand-ink text-2xl leading-none">&times;</button>
        </div>

        {/* Tipo de entrega */}
        <div className="px-5 py-3 border-b border-brand-line bg-white/60">
          <span className="text-[11px] uppercase tracking-[0.22em] text-brand-muted">Entrega</span>
          <span className="ml-2 text-sm font-semibold text-brand-ink">
            {deliveryType === 'pickup' ? '🏪 Recoger en tienda' : '🛵 Domicilio'}
          </span>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full text-brand-muted">
              <span className="text-5xl mb-3">🍽️</span>
              <p>Tu carrito está vacío</p>
            </div>
          ) : (
            <>
              {items.map(item => (
                <div key={`${item.product_id}-${item.variant_name}`} className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-brand-ink font-semibold text-sm">{item.product_name}</p>
                    <p className="text-brand-muted text-xs">{item.variant_name}</p>
                  </div>
                  {/* Qty controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(item.product_id, item.variant_name, item.qty - 1)}
                      className="w-7 h-7 rounded-full bg-white hover:bg-brand-red hover:text-white text-brand-ink font-bold flex items-center justify-center text-sm transition-colors border border-brand-line"
                    >
                      −
                    </button>
                    <span className="text-brand-ink font-bold w-4 text-center text-sm">{item.qty}</span>
                    <button
                      onClick={() => updateQty(item.product_id, item.variant_name, item.qty + 1)}
                      className="w-7 h-7 rounded-full bg-white hover:bg-brand-red hover:text-white text-brand-ink font-bold flex items-center justify-center text-sm transition-colors border border-brand-line"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-brand-ink font-bold text-sm w-14 text-right">${item.subtotal}</span>
                </div>
              ))}

              {extras.length > 0 && (
                <>
                  <div className="border-t border-brand-line pt-3">
                    <p className="text-brand-muted text-[11px] mb-2 font-semibold uppercase tracking-[0.22em]">Extras</p>
                    {extras.map(e => (
                      <div key={e.extra_id} className="flex justify-between text-sm py-1">
                        <span className="text-brand-ink">{e.qty}× {e.extra_name}</span>
                        <span className="text-brand-ink font-semibold">${e.subtotal}</span>
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
          <div className="p-5 border-t border-brand-line space-y-3 bg-white/60">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-brand-muted">
                <span>Subtotal</span><span>${subtotal()}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between text-brand-muted">
                  <span>Envío</span><span>${deliveryFee}</span>
                </div>
              )}
              <div className="flex justify-between text-brand-ink font-black text-lg pt-1 border-t border-brand-line">
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
