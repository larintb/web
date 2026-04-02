'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/store/cart';

interface Props {
  open: boolean;
  onClose: () => void;
}

const TIP_PRESETS = [0, 10, 15, 20];

export default function CartDrawer({ open, onClose }: Props) {
  const router       = useRouter();
  const items        = useCart(s => s.items);
  const extras       = useCart(s => s.extras);
  const subtotal     = useCart(s => s.subtotal);
  const total        = useCart(s => s.total);
  const deliveryFee  = useCart(s => s.deliveryFee);
  const deliveryType = useCart(s => s.deliveryType);
  const tip          = useCart(s => s.tip);
  const setTip       = useCart(s => s.setTip);
  const updateQty    = useCart(s => s.updateQty);
  const removeItem   = useCart(s => s.removeItem);

  const [customTip, setCustomTip] = useState('');
  const [tipMode, setTipMode]     = useState<number | 'custom'>(0);

  const isEmpty = items.length === 0;

  function handleTipPreset(pct: number) {
    setTipMode(pct);
    setCustomTip('');
    const amount = Math.round(subtotal() * (pct / 100));
    setTip(amount);
  }

  function handleCustomTip(val: string) {
    setCustomTip(val);
    setTipMode('custom');
    const parsed = parseFloat(val);
    setTip(isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100);
  }

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/70 z-40 animate-fade-in" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-brand-paper border-l border-brand-line z-50 flex flex-col animate-slide-up md:animate-none text-brand-ink">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-brand-line">
          <h2 className="font-display text-5xl leading-none">Carrito</h2>
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
        <div className="flex-1 overflow-y-auto">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full text-brand-muted p-8">
              <span className="text-5xl mb-3">🍽️</span>
              <p>Tu carrito está vacío</p>
            </div>
          ) : (
            <div className="p-5 space-y-4">

              {/* Productos */}
              {items.map(item => (
                <div key={`${item.product_id}-${item.variant_name}`} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-brand-ink font-semibold text-sm leading-tight">{item.product_name}</p>
                    <p className="text-brand-muted text-xs mt-0.5">{item.variant_name}</p>
                  </div>
                  {/* Qty */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => item.qty === 1 ? removeItem(item.product_id) : updateQty(item.product_id, item.qty - 1)}
                      className="w-7 h-7 rounded-full bg-white border border-brand-line hover:bg-brand-red hover:text-white font-bold flex items-center justify-center text-sm transition-colors"
                    >−</button>
                    <span className="font-bold w-4 text-center text-sm">{item.qty}</span>
                    <button
                      onClick={() => updateQty(item.product_id, item.qty + 1)}
                      className="w-7 h-7 rounded-full bg-white border border-brand-line hover:bg-brand-red hover:text-white font-bold flex items-center justify-center text-sm transition-colors"
                    >+</button>
                  </div>
                  <span className="font-bold text-sm w-14 text-right">${item.subtotal}</span>
                </div>
              ))}

              {/* Extras */}
              {extras.length > 0 && (
                <div className="border-t border-brand-line pt-4">
                  <p className="text-brand-muted text-[11px] uppercase tracking-[0.22em] font-semibold mb-2">Extras</p>
                  {extras.map(e => (
                    <div key={e.extra_id} className="flex justify-between text-sm py-1">
                      <span className="text-brand-ink">{e.qty}× {e.extra_name}</span>
                      <span className="font-semibold">${e.subtotal}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Propina ── */}
              <div className="border-t border-brand-line pt-4">
                <p className="text-brand-ink font-semibold text-sm mb-3">Propina 🤝</p>
                <div className="flex gap-2 mb-2">
                  {TIP_PRESETS.map(pct => (
                    <button
                      key={pct}
                      onClick={() => handleTipPreset(pct)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                        tipMode === pct
                          ? 'bg-brand-red text-white border-brand-red'
                          : 'bg-white text-brand-muted border-brand-line hover:border-brand-red/40'
                      }`}
                    >
                      {pct === 0 ? 'Sin propina' : `${pct}%`}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTipMode('custom')}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                      tipMode === 'custom'
                        ? 'bg-brand-red text-white border-brand-red'
                        : 'bg-white text-brand-muted border-brand-line hover:border-brand-red/40'
                    }`}
                  >
                    Otra cantidad
                  </button>
                  {tipMode === 'custom' && (
                    <div className="flex items-center gap-1.5 flex-1">
                      <span className="text-brand-muted text-sm">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.50"
                        value={customTip}
                        onChange={e => handleCustomTip(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 border border-brand-line rounded-lg px-2 py-1.5 text-sm text-brand-ink bg-white focus:outline-none focus:border-brand-red"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
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
              {tip > 0 && (
                <div className="flex justify-between text-brand-muted">
                  <span>Propina</span><span>${tip}</span>
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
