'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useCart } from '@/store/cart';

const MapboxMap = dynamic(() => import('@/components/MapboxMap').then(m => ({ default: m.MapboxMap })), {
  ssr: false,
  loading: () => <div className="w-full h-56 bg-gray-200 rounded-2xl animate-pulse" />,
});

const TIP_PRESETS = [0, 10, 15, 20];

export default function CarritoPage() {
  const router = useRouter();

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
  const [tipMode,   setTipMode]   = useState<number | 'custom'>(10);

  // Redirigir si no hay tipo de entrega o carrito vacío
  useEffect(() => {
    if (!deliveryType) { router.replace('/'); return; }
  }, [deliveryType, router]);

  // Aplicar propina predeterminada (10%) al entrar
  useEffect(() => {
    const { tip: currentTip, subtotal: getSubtotal, setTip: applyTip } = useCart.getState();
    if (currentTip === 0 && getSubtotal() > 0) {
      applyTip(Math.round(getSubtotal() * 0.10));
    }
  }, []);

  function handleTipPreset(pct: number) {
    setTipMode(pct);
    setCustomTip('');
    setTip(Math.round(subtotal() * (pct / 100)));
  }

  function handleCustomTip(val: string) {
    setCustomTip(val);
    setTipMode('custom');
    const parsed = parseFloat(val);
    setTip(isNaN(parsed) ? 0 : Math.round(parsed * 100) / 100);
  }

  const isEmpty = items.length === 0;

  return (
    <div className="min-h-screen bg-brand-paper text-brand-ink">

      {/* Header */}
      <header className="sticky top-0 z-30 bg-brand-paper/95 backdrop-blur border-b border-brand-line/80">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-brand-muted hover:text-brand-ink transition-colors text-xl"
          >←</button>
          <div>
            <h1 className="font-display text-5xl leading-none text-brand-ink">Carrito</h1>
            {!isEmpty && (
              <p className="text-xs text-brand-muted uppercase tracking-[0.15em]">
                {items.length} {items.length === 1 ? 'producto' : 'productos'}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-36 space-y-6">

        {/* Carrito vacío */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-7xl mb-4 opacity-50">🍽️</div>
            <p className="text-brand-ink font-semibold text-lg">Tu carrito está vacío</p>
            <p className="text-brand-muted text-sm mt-2 mb-6">Agrega productos para comenzar</p>
            <button
              onClick={() => router.push('/menu')}
              className="btn-primary"
            >
              Ver menú →
            </button>
          </div>
        )}

        {!isEmpty && (
          <>
            {/* Método de entrega */}
            <div className="px-4 py-3 rounded-2xl bg-gradient-to-r from-brand-orange/10 to-brand-red/10 border border-brand-orange/20">
              <p className="text-[10px] uppercase tracking-[0.25em] text-brand-muted font-bold">Método de entrega</p>
              <p className="font-display text-2xl text-brand-ink mt-1">
                {deliveryType === 'pickup' ? '🏪 Recoger en tienda' : '🛵 Domicilio'}
              </p>
            </div>

            {/* Mapa para recoger */}
            {deliveryType === 'pickup' && (
              <div className="rounded-2xl overflow-hidden border border-brand-line h-56 shadow-lg">
                <MapboxMap
                  address="Crispy Charles, Matamoros, Tamaulipas"
                  businessName="🍗 Crispy Charles"
                  coords={[-97.503669, 25.848049]}
                />
              </div>
            )}

            {/* Productos */}
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.25em] text-brand-muted font-bold">Productos</p>
              {items.map((item, idx) => (
                <div
                  key={`${item.product_id}-${item.variant_name}`}
                  className="surface-paper rounded-2xl p-4"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <p className="text-brand-ink font-bold text-base">{item.product_name}</p>
                        <span className="text-xs bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-lg font-semibold">
                          ${item.unit_price} c/u
                        </span>
                      </div>
                      <p className="text-brand-muted text-xs mt-1">{item.variant_name}</p>
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <div className="flex items-center gap-2 border border-brand-line rounded-xl px-1 py-1 bg-white">
                        <button
                          onClick={() => item.qty === 1 ? removeItem(item.product_id) : updateQty(item.product_id, item.qty - 1)}
                          className="w-8 h-8 rounded-lg hover:bg-brand-red text-brand-muted hover:text-white font-bold flex items-center justify-center transition-all text-lg"
                        >−</button>
                        <span className="font-bold w-6 text-center text-sm text-brand-ink">{item.qty}</span>
                        <button
                          onClick={() => updateQty(item.product_id, item.qty + 1)}
                          className="w-8 h-8 rounded-lg hover:bg-brand-orange text-brand-muted hover:text-white font-bold flex items-center justify-center transition-all text-lg"
                        >+</button>
                      </div>
                      <span className="font-black text-lg text-brand-ink">${item.subtotal}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Extras */}
            {extras.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-brand-muted font-bold mb-3">Extras añadidos</p>
                <div className="space-y-2">
                  {extras.map(e => (
                    <div
                      key={e.extra_id}
                      className="surface-paper rounded-xl p-3 flex justify-between items-center"
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

            {/* Propina */}
            <div className="surface-paper rounded-[28px] p-5">
              <p className="text-brand-ink font-bold text-base mb-3 flex items-center gap-2">
                <span>🤝 Añadir propina</span>
                {tip > 0 && (
                  <span className="text-xs bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-lg font-bold">${tip}</span>
                )}
              </p>

              <div className="grid grid-cols-4 gap-2 mb-3">
                {TIP_PRESETS.map(pct => (
                  <button
                    key={pct}
                    onClick={() => handleTipPreset(pct)}
                    className={`py-3 rounded-xl text-xs font-bold border-2 transition-all duration-150 ${
                      tipMode === pct
                        ? 'bg-brand-orange text-white border-brand-orange shadow-lg scale-105'
                        : 'bg-white text-brand-muted border-brand-line hover:border-brand-orange hover:text-brand-ink'
                    }`}
                  >
                    {pct === 0 ? 'Sin' : `${pct}%`}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setTipMode('custom')}
                className={`w-full py-3 rounded-xl text-xs font-bold border-2 transition-all ${
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
                    className="w-full border-2 border-brand-orange rounded-xl pl-7 pr-3 py-3 text-sm text-brand-ink bg-white focus:outline-none focus:ring-2 focus:ring-brand-orange/30 transition-all"
                  />
                </div>
              )}
            </div>

            {/* Resumen de totales */}
            <div className="surface-paper rounded-[28px] p-5 space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-brand-muted font-bold mb-3">Resumen</p>

              <div className="flex justify-between text-sm text-brand-muted">
                <span className="uppercase tracking-[0.1em] text-xs">Subtotal</span>
                <span className="font-semibold text-brand-ink">${subtotal()}</span>
              </div>

              {deliveryFee > 0 && (
                <div className="flex justify-between text-sm text-brand-muted">
                  <span className="uppercase tracking-[0.1em] text-xs">
                    {deliveryType === 'pickup' ? '📍 Recoger' : '🛵 Envío'}
                  </span>
                  <span className="font-semibold text-brand-ink">${deliveryFee}</span>
                </div>
              )}

              {tip > 0 && (
                <div className="flex justify-between text-sm text-brand-muted">
                  <span className="uppercase tracking-[0.1em] text-xs">Propina</span>
                  <span className="font-semibold text-brand-ink">${tip}</span>
                </div>
              )}

              <div className="flex justify-between items-center bg-gradient-to-r from-brand-orange/10 to-brand-red/10 rounded-xl px-4 py-3 border border-brand-orange/20 mt-3">
                <span className="text-xs uppercase tracking-[0.15em] font-bold text-brand-muted">Total a pagar</span>
                <span className="font-display text-4xl text-brand-ink leading-none">${total()}</span>
              </div>
            </div>
          </>
        )}
      </main>

      {/* CTA fijo al fondo */}
      {!isEmpty && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-brand-paper/95 backdrop-blur border-t border-brand-line px-4 py-4">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => router.push('/checkout')}
              className="w-full bg-brand-red hover:bg-brand-orange text-white font-bold py-4 px-6 rounded-2xl transition-all duration-200 active:scale-95 shadow-lg hover:shadow-xl text-lg flex items-center justify-center gap-2"
            >
              <span>Continuar a pagar</span>
              <span>→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
