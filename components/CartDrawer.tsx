'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useCart } from '@/store/cart';

// Cargar MapboxMap de forma dinámica para mejor performance SSR
const MapboxMap = dynamic(() => import('./MapboxMap').then(m => ({ default: m.MapboxMap })), { 
  ssr: false,
  loading: () => <div className="w-full h-80 bg-gray-200 rounded-2xl animate-pulse" />
});

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
      <div className="fixed inset-0 bg-brand-dark/20 backdrop-blur-sm z-40 animate-fade-in" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-brand-paper z-50 flex flex-col animate-slide-up md:animate-none text-brand-ink shadow-2xl">

        {/* Header - Sticky */}
        <div className="sticky top-0 z-10 bg-brand-paper/95 backdrop-blur px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-6xl leading-none text-brand-ink">Carrito</h2>
              <p className="text-xs text-brand-muted mt-1 uppercase tracking-[0.15em]">{items.length} {items.length === 1 ? 'producto' : 'productos'}</p>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-brand-red/10 flex items-center justify-center text-2xl text-brand-muted hover:text-brand-red transition-all">×</button>
          </div>

          {/* Tipo de entrega - Highlighted */}
          <div className="px-4 py-3 rounded-2xl bg-gradient-to-r from-brand-orange/10 to-brand-red/10 border border-brand-orange/20">
            <p className="text-[10px] uppercase tracking-[0.25em] text-brand-muted font-bold">Método de entrega</p>
            <p className="font-display text-2xl text-brand-ink mt-1">
              {deliveryType === 'pickup' ? '🏪 Recoger en tienda' : '🛵 Domicilio'}
            </p>
          </div>

          {/* Mapa 3D para recoger */}
          {deliveryType === 'pickup' && (
            <div className="rounded-2xl overflow-hidden border border-brand-line h-80 shadow-lg">
              <MapboxMap 
                address="Crispy Charles, Matamoros, Tamaulipas"
                businessName="🍗 Crispy Charles"
                coords={[-97.503669, 25.848049]}
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-7xl mb-4 opacity-50">🍽️</div>
              <p className="text-brand-ink font-semibold text-lg">Tu carrito está vacío</p>
              <p className="text-brand-muted text-sm mt-2">Agrega productos para comenzar</p>
            </div>
          ) : (
            <div className="space-y-3">

              {/* Productos */}
              {items.map((item, idx) => (
                <div
                  key={`${item.product_id}-${item.variant_name}`}
                  className="group surface-paper rounded-2xl p-4 hover:shadow-md transition-all duration-200 animate-fade-in"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-baseline gap-2">
                        <p className="text-brand-ink font-bold text-base">{item.product_name}</p>
                        <span className="text-xs bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-lg font-semibold">${item.unit_price}</span>
                      </div>
                      <p className="text-brand-muted text-xs mt-1.5">{item.variant_name}</p>
                    </div>

                    {/* Quantity Controls - Right Aligned */}
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex items-center gap-2 border border-brand-line rounded-xl px-1 py-1 bg-white">
                        <button
                          onClick={() => item.qty === 1 ? removeItem(item.product_id) : updateQty(item.product_id, item.qty - 1)}
                          className="w-7 h-7 rounded-lg hover:bg-brand-red text-brand-muted hover:text-white font-bold flex items-center justify-center transition-all text-lg"
                        >
                          −
                        </button>
                        <span className="font-bold w-6 text-center text-sm text-brand-ink">{item.qty}</span>
                        <button
                          onClick={() => updateQty(item.product_id, item.qty + 1)}
                          className="w-7 h-7 rounded-lg hover:bg-brand-orange text-brand-muted hover:text-white font-bold flex items-center justify-center transition-all text-lg"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-black text-lg text-brand-ink">${item.subtotal}</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Extras Section */}
              {extras.length > 0 && (
                <div className="mt-6 pt-4 border-t-2 border-brand-line">
                  <p className="text-brand-muted text-[10px] uppercase tracking-[0.25em] font-bold mb-3">Extras añadidos</p>
                  <div className="space-y-2">
                    {extras.map((e, idx) => (
                      <div
                        key={e.extra_id}
                        className="surface-paper rounded-xl p-3 flex justify-between items-center animate-fade-in"
                        style={{ animationDelay: `${(items.length + idx) * 50}ms` }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-brand-red/10 text-brand-red px-2 py-0.5 rounded-lg font-bold">{e.qty}×</span>
                          <span className="text-brand-ink font-medium">{e.extra_name}</span>
                        </div>
                        <span className="font-bold text-brand-orange">${e.subtotal}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tip Section */}
              <div className="mt-6 pt-4 border-t-2 border-brand-line">
                <p className="text-brand-ink font-bold text-base mb-3 flex items-center gap-2">
                  <span>🤝 Añadir propina</span>
                  {tip > 0 && <span className="text-xs bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-lg font-bold">${tip}</span>}
                </p>

                {/* Preset Buttons */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {TIP_PRESETS.map(pct => (
                    <button
                      key={pct}
                      onClick={() => handleTipPreset(pct)}
                      className={`py-2.5 rounded-xl text-xs font-bold border-2 transition-all duration-150 ${
                        tipMode === pct
                          ? 'bg-brand-orange text-white border-brand-orange shadow-lg scale-105'
                          : 'bg-white text-brand-muted border-brand-line hover:border-brand-orange hover:text-brand-ink'
                      }`}
                    >
                      {pct === 0 ? 'Sin' : `${pct}%`}
                    </button>
                  ))}
                </div>

                {/* Custom Tip */}
                <button
                  onClick={() => setTipMode('custom')}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                    tipMode === 'custom'
                      ? 'bg-brand-orange text-white border-brand-orange'
                      : 'bg-white text-brand-muted border-brand-line hover:border-brand-orange/50'
                  }`}
                >
                  Otra cantidad
                </button>

                {tipMode === 'custom' && (
                  <div className="mt-2 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted font-bold">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.50"
                      value={customTip}
                      onChange={e => handleCustomTip(e.target.value)}
                      placeholder="0.00"
                      autoFocus
                      className="w-full border-2 border-brand-orange rounded-xl pl-7 pr-3 py-2.5 text-sm text-brand-ink bg-white/50 focus:outline-none focus:ring-2 focus:ring-brand-orange/30 transition-all"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Sticky */}
        {!isEmpty && (
          <div className="sticky bottom-0 bg-brand-paper/95 backdrop-blur px-5 py-4 border-t-2 border-brand-line space-y-4">

            {/* Breakdown */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-brand-muted">
                <span className="text-xs uppercase tracking-[0.1em]">Subtotal</span>
                <span className="font-semibold">${subtotal()}</span>
              </div>

              {deliveryFee > 0 && (
                <div className="flex justify-between text-brand-muted">
                  <span className="text-xs uppercase tracking-[0.1em]">
                    {deliveryType === 'pickup' ? '📍 Recoger' : '🛵 Envío'}
                  </span>
                  <span className="font-semibold">${deliveryFee}</span>
                </div>
              )}

              {tip > 0 && (
                <div className="flex justify-between text-brand-muted">
                  <span className="text-xs uppercase tracking-[0.1em]">Propina</span>
                  <span className="font-semibold">${tip}</span>
                </div>
              )}

              {/* Total - Highlighted */}
              <div className="flex justify-between items-center bg-gradient-to-r from-brand-orange/10 to-brand-red/10 rounded-xl px-4 py-3 border border-brand-orange/20 mt-2">
                <span className="text-xs uppercase tracking-[0.15em] font-bold text-brand-muted">Total a pagar</span>
                <span className="font-display text-4xl text-brand-ink leading-none">${total()}</span>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={() => { onClose(); router.push('/checkout'); }}
              className="w-full bg-brand-red hover:bg-brand-orange text-white font-bold py-4 px-6 rounded-2xl transition-all duration-200 active:scale-95 shadow-lg hover:shadow-xl text-lg flex items-center justify-center gap-2"
            >
              <span>Continuar a pagar</span>
              <span>→</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
