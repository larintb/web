'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Category, Product, Extra, CartItem, CartExtra } from '@/types';

interface Props {
  categories:  Category[];
  allProducts: Product[];
  allExtras:   Extra[];
  compact?:    boolean;
}

type POSPayment = 'cash' | 'card_manual';

const QUICK_AMOUNTS = [50, 100, 200, 500];

const CATEGORY_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-yellow-500',
];

export default function POSTab({ categories, allProducts, allExtras, compact = false }: Props) {
  const [items,          setItems]          = useState<CartItem[]>([]);
  const [extras,         setExtras]         = useState<CartExtra[]>([]);
  const [customerName,   setCustomerName]   = useState('');
  const [customerPhone,  setCustomerPhone]  = useState('');
  const [countryCode,    setCountryCode]    = useState('+52');
  const [notes,          setNotes]          = useState('');
  const [payment,        setPayment]        = useState<POSPayment>('cash');
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [successCode,    setSuccessCode]    = useState<string | null>(null);
  const [variantModal,   setVariantModal]   = useState<Product | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [mobileView,     setMobileView]     = useState<'catalog' | 'cart'>('catalog');
  const [showNumpad,     setShowNumpad]     = useState(false);
  const [numpadValue,    setNumpadValue]    = useState('');

  const activeCategories = categories.filter(c => c.active);
  const effectiveCategory = activeCategory || (activeCategories[0]?.id ?? '');

  const filteredProducts = effectiveCategory !== 'extras'
    ? allProducts.filter(p => p.active && p.category_id === effectiveCategory)
    : [];
  const activeExtras = allExtras.filter(e => e.active);

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0) + extras.reduce((s, e) => s + e.subtotal, 0);
  const total    = subtotal;
  const cartCount = items.reduce((s, i) => s + i.qty, 0) + extras.reduce((s, e) => s + e.qty, 0);

  const numpadNum = parseFloat(numpadValue);
  const change = !isNaN(numpadNum) && numpadValue !== '' ? numpadNum - total : null;

  function numpadPress(key: string) {
    setNumpadValue(prev => {
      if (key === '⌫') return prev.slice(0, -1);
      if (key === 'C') return '';
      if (key === '00') return prev === '' ? '' : prev + '00';
      if (key === '.' && prev.includes('.')) return prev;
      if (prev === '0' && key !== '.') return key;
      return prev + key;
    });
  }

  function openNumpad() {
    if (!customerName.trim()) { setError('El nombre del cliente es obligatorio.'); return; }
    if (items.length === 0)   { setError('Agrega al menos un producto.'); return; }
    setError(null);
    setNumpadValue('');
    setShowNumpad(true);
  }

  function addItem(product: Product, variant: { name: string; price: number }) {
    setItems(prev => {
      const idx = prev.findIndex(i => i.product_id === product.id && i.variant_name === variant.name);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1, subtotal: (updated[idx].qty + 1) * updated[idx].unit_price };
        return updated;
      }
      return [...prev, { product_id: product.id, product_name: product.name, variant_name: variant.name, unit_price: variant.price, qty: 1, subtotal: variant.price }];
    });
  }

  function updateItemQty(product_id: string, variant_name: string, qty: number) {
    setItems(prev =>
      prev.map(i => i.product_id === product_id && i.variant_name === variant_name
        ? { ...i, qty, subtotal: qty * i.unit_price }
        : i
      ).filter(i => i.qty > 0)
    );
  }

  function toggleExtra(extra: Extra) {
    setExtras(prev => {
      const has = prev.some(e => e.extra_id === extra.id);
      if (has) return prev.filter(e => e.extra_id !== extra.id);
      return [...prev, { extra_id: extra.id, extra_name: extra.name, unit_price: extra.price, qty: 1, subtotal: extra.price }];
    });
  }

  function updateExtraQty(extra_id: string, qty: number) {
    setExtras(prev =>
      prev.map(e => e.extra_id === extra_id ? { ...e, qty, subtotal: qty * e.unit_price } : e)
          .filter(e => e.qty > 0)
    );
  }

  function clearCart() {
    setItems([]);
    setExtras([]);
    setCustomerName('');
    setCustomerPhone('');
    setCountryCode('+52');
    setNotes('');
    setPayment('cash');
    setNumpadValue('');
    setError(null);
  }

  async function handleSubmit() {
    setLoading(true);
    setShowNumpad(false);
    try {
      const res = await fetch('/api/admin/orders/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name:  customerName.trim(),
          customer_phone: customerPhone.trim() ? `${countryCode}${customerPhone.trim()}` : undefined,
          items, extras, subtotal, total,
          payment_method: payment,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al crear la orden.'); return; }
      const code = (data.order.id as string).slice(0, 6).toUpperCase();
      clearCart();
      setSuccessCode(code);
      setTimeout(() => setSuccessCode(null), 5000);
    } catch {
      setError('Error de conexión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* ── Variant selector modal ── */}
      {variantModal && (
        <div className="fixed inset-0 z-50 bg-brand-dark/30 flex items-center justify-center p-4">
          <div className="surface-paper rounded-3xl w-full max-w-sm p-6">
            <h2 className="font-display text-5xl text-brand-ink leading-none mb-4">{variantModal.name}</h2>
            <div className="space-y-2">
              {variantModal.variants.map(v => (
                v.disabled ? (
                  <div key={v.name}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 border border-brand-line opacity-50 cursor-not-allowed">
                    <div className="text-left">
                      <p className="font-semibold text-brand-muted line-through">{v.name} {v.badge ?? ''}</p>
                      <p className="text-xs text-brand-muted">Agotado</p>
                    </div>
                    <p className="font-black text-brand-muted">${v.price}</p>
                  </div>
                ) : (
                  <button key={v.name}
                    onClick={() => { addItem(variantModal, v); setVariantModal(null); }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-brand-paper border border-brand-line hover:border-brand-red hover:bg-red-50 transition-colors">
                    <div className="text-left">
                      <p className="font-semibold text-brand-ink">{v.name} {v.badge ?? ''}</p>
                      {v.includes && <p className="text-xs text-brand-muted">{v.includes}</p>}
                    </div>
                    <p className="font-black text-brand-red">${v.price}</p>
                  </button>
                )
              ))}
            </div>
            <button onClick={() => setVariantModal(null)}
              className="w-full mt-4 py-3 rounded-2xl border border-brand-line text-brand-muted font-semibold hover:text-brand-ink transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Numpad / cobro modal ── */}
      {showNumpad && (
        <div className="fixed inset-0 z-50 bg-brand-dark/40 flex items-center justify-center p-4">
          <div className="surface-paper rounded-3xl w-full max-w-sm p-6">

            {payment === 'cash' ? (
              <>
                {/* Header */}
                <div className="text-center mb-5">
                  <p className="text-xs text-brand-muted uppercase tracking-[0.2em] mb-1">Total a cobrar</p>
                  <p className="font-display text-6xl text-brand-red leading-none">${total}</p>
                </div>

                {/* Display amount received */}
                <div className="bg-brand-paper rounded-2xl px-4 py-3 mb-4 text-right">
                  <p className="text-xs text-brand-muted mb-0.5">Recibido</p>
                  <p className={`font-display text-5xl leading-none ${numpadValue ? 'text-brand-ink' : 'text-brand-muted'}`}>
                    ${numpadValue || '0'}
                  </p>
                </div>

                {/* Change display */}
                {change !== null && (
                  <div className={`rounded-2xl px-4 py-3 mb-4 text-center ${change >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <p className="text-xs text-brand-muted mb-0.5">Cambio</p>
                    <p className={`font-display text-4xl leading-none font-black ${change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      ${change.toFixed(2)}
                    </p>
                  </div>
                )}

                {/* Quick amounts */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {QUICK_AMOUNTS.filter(a => a >= total).map(a => (
                    <button key={a} onClick={() => setNumpadValue(String(a))}
                      className={`py-2 rounded-xl text-sm font-bold border-2 transition-all ${numpadValue === String(a) ? 'border-brand-orange bg-orange-50 text-brand-orange' : 'border-brand-line text-brand-muted hover:border-brand-orange hover:text-brand-orange'}`}>
                      ${a}
                    </button>
                  ))}
                </div>

                {/* Numpad grid */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {['1','2','3','4','5','6','7','8','9','00','0','⌫'].map(k => (
                    <button key={k} onClick={() => numpadPress(k)}
                      className={`py-4 rounded-2xl font-bold text-lg transition-all ${k === '⌫' ? 'bg-brand-line text-brand-muted hover:bg-red-100 hover:text-red-500' : 'bg-brand-paper border border-brand-line text-brand-ink hover:bg-brand-line'}`}>
                      {k}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              /* Card confirmation */
              <div className="text-center py-4">
                <p className="text-5xl mb-3">💳</p>
                <p className="font-display text-5xl text-brand-ink leading-none mb-2">Cobro con tarjeta</p>
                <p className="text-brand-muted text-sm mb-6">Confirma el cobro de <span className="font-black text-brand-ink">${total}</span> con terminal</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button onClick={() => setShowNumpad(false)}
                className="flex-1 py-3 rounded-2xl border border-brand-line text-brand-muted font-semibold hover:text-brand-ink transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || (payment === 'cash' && (change === null || change < 0))}
                className="flex-1 py-3 rounded-2xl bg-brand-red text-white font-semibold disabled:opacity-40 hover:bg-red-700 transition-colors">
                {loading ? 'Creando...' : '✓ Confirmar cobro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success toast ── */}
      {successCode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white font-semibold px-5 py-3 rounded-2xl shadow-xl whitespace-nowrap">
          ✅ Orden #{successCode} creada
        </div>
      )}

      {/* Mobile view switcher */}
      <div className="flex gap-2 mb-4 lg:hidden">
        {(['catalog', 'cart'] as const).map(v => (
          <button key={v} onClick={() => setMobileView(v)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${mobileView === v ? 'bg-brand-red text-white' : 'bg-white border border-brand-line text-brand-muted'}`}>
            {v === 'catalog' ? '🍗 Catálogo' : `🛒 Carrito${cartCount > 0 ? ` (${cartCount})` : ''}`}
          </button>
        ))}
      </div>

      <div className={`grid gap-6 items-start ${compact ? 'grid-cols-1' : 'lg:grid-cols-2'}`}>

        {/* ── Catalog panel ── */}
        <div className={mobileView === 'cart' ? 'hidden lg:block' : ''}>
          <div className="flex gap-2 flex-wrap mb-4">
            {activeCategories.map((c, i) => {
              const solid = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
              const isActive = effectiveCategory === c.id;
              return (
                <button key={c.id} onClick={() => setActiveCategory(c.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${isActive ? `${solid} text-white` : 'bg-white border border-brand-line text-brand-muted hover:text-brand-ink'}`}>
                  {c.name}
                </button>
              );
            })}
            {activeExtras.length > 0 && (
              <button onClick={() => setActiveCategory('extras')}
                className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${effectiveCategory === 'extras' ? 'bg-purple-500 text-white' : 'bg-white border border-brand-line text-brand-muted hover:text-brand-ink'}`}>
                Extras
              </button>
            )}
          </div>

          {effectiveCategory !== 'extras' ? (
            <div className="grid grid-cols-2 gap-3">
              {filteredProducts.map(p => (
                <button key={p.id}
                  onClick={() => p.variants.length === 1 ? addItem(p, p.variants[0]) : setVariantModal(p)}
                  className="bg-white rounded-2xl p-4 text-left border border-brand-line hover:border-brand-red transition-all">
                  {p.image_url && (
                    <Image src={p.image_url} alt={p.name} width={200} height={200} className="w-full aspect-square object-cover rounded-xl mb-2" />
                  )}
                  <p className="font-semibold text-brand-ink text-sm leading-tight">{p.name}</p>
                  {p.variants.length === 1
                    ? <p className="text-brand-red font-black mt-1 text-base">${p.variants[0].price}</p>
                    : <p className="text-xs text-brand-muted mt-1">{p.variants.length} opciones · desde ${Math.min(...p.variants.map(v => v.price))}</p>}
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <p className="col-span-2 text-sm text-brand-muted text-center py-8">Sin productos en esta categoría</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {activeExtras.map(e => {
                const inCart = extras.some(x => x.extra_id === e.id);
                return (
                  <button key={e.id} onClick={() => toggleExtra(e)}
                    className={`bg-white rounded-2xl p-4 text-left border-2 transition-all ${inCart ? 'border-brand-orange bg-orange-50' : 'border-brand-line hover:border-brand-orange'}`}>
                    {e.image_url && (
                      <Image src={e.image_url} alt={e.name} width={200} height={200} className="w-full aspect-square object-cover rounded-xl mb-2" />
                    )}
                    <p className="font-semibold text-brand-ink text-sm leading-tight">{e.name}</p>
                    <p className="text-brand-orange font-black mt-1 text-base">${e.price}</p>
                    {inCart && <p className="text-xs text-brand-orange mt-0.5 font-semibold">Añadido ✓</p>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Cart + checkout panel ── */}
        <div className={`space-y-4 ${mobileView === 'catalog' ? 'hidden lg:block' : ''}`}>

          {/* Cart items */}
          <div className="surface-paper rounded-2xl p-4">
            <p className="text-xs text-brand-muted uppercase tracking-[0.2em] mb-3">Carrito</p>
            {items.length === 0 && extras.length === 0 ? (
              <p className="text-sm text-brand-muted text-center py-6">Sin productos aún</p>
            ) : (
              <div className="space-y-3">
                {items.map(item => (
                  <div key={`${item.product_id}-${item.variant_name}`} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-brand-ink truncate">{item.product_name}</p>
                      <p className="text-xs text-brand-muted">{item.variant_name} · ${item.unit_price} c/u</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => updateItemQty(item.product_id, item.variant_name, item.qty - 1)}
                        className="w-7 h-7 rounded-full border border-brand-line flex items-center justify-center font-bold text-sm hover:bg-brand-line transition-colors">−</button>
                      <span className="w-5 text-center text-sm font-bold text-brand-ink">{item.qty}</span>
                      <button onClick={() => updateItemQty(item.product_id, item.variant_name, item.qty + 1)}
                        className="w-7 h-7 rounded-full border border-brand-line flex items-center justify-center font-bold text-sm hover:bg-brand-line transition-colors">+</button>
                    </div>
                    <span className="text-sm font-black text-brand-ink w-14 text-right flex-shrink-0">${item.subtotal}</span>
                  </div>
                ))}
                {extras.map(e => (
                  <div key={e.extra_id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-brand-ink truncate">+ {e.extra_name}</p>
                      <p className="text-xs text-brand-muted">${e.unit_price} c/u</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => updateExtraQty(e.extra_id, e.qty - 1)}
                        className="w-7 h-7 rounded-full border border-brand-line flex items-center justify-center font-bold text-sm hover:bg-brand-line transition-colors">−</button>
                      <span className="w-5 text-center text-sm font-bold text-brand-ink">{e.qty}</span>
                      <button onClick={() => updateExtraQty(e.extra_id, e.qty + 1)}
                        className="w-7 h-7 rounded-full border border-brand-line flex items-center justify-center font-bold text-sm hover:bg-brand-line transition-colors">+</button>
                    </div>
                    <span className="text-sm font-black text-brand-ink w-14 text-right flex-shrink-0">${e.subtotal}</span>
                  </div>
                ))}
                <div className="border-t border-brand-line pt-3 flex justify-between items-center">
                  <span className="font-semibold text-brand-ink">Total</span>
                  <span className="text-3xl font-black text-brand-red">${total}</span>
                </div>
              </div>
            )}
          </div>

          {/* Customer info */}
          <div className="surface-paper rounded-2xl p-4 space-y-2.5">
            <p className="text-xs text-brand-muted uppercase tracking-[0.2em] mb-1">Cliente</p>
            <input
              type="text"
              placeholder="Nombre *"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              className="w-full bg-brand-paper border border-brand-line rounded-xl px-3 py-2.5 text-brand-ink text-sm placeholder-brand-muted focus:outline-none focus:border-brand-red transition-colors"
            />
            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={e => setCountryCode(e.target.value)}
                className="bg-brand-paper border border-brand-line rounded-xl px-2 py-2.5 text-brand-ink text-sm focus:outline-none focus:border-brand-red transition-colors"
              >
                <option value="+52">🇲🇽 +52</option>
                <option value="+1">🇺🇸 +1</option>
              </select>
              <input
                type="tel"
                placeholder="Teléfono (opcional)"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                className="flex-1 bg-brand-paper border border-brand-line rounded-xl px-3 py-2.5 text-brand-ink text-sm placeholder-brand-muted focus:outline-none focus:border-brand-red transition-colors"
              />
            </div>
            <input
              type="text"
              placeholder="Notas (opcional)"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-brand-paper border border-brand-line rounded-xl px-3 py-2.5 text-brand-ink text-sm placeholder-brand-muted focus:outline-none focus:border-brand-red transition-colors"
            />
          </div>

          {/* Payment method */}
          <div className="surface-paper rounded-2xl p-4">
            <p className="text-xs text-brand-muted uppercase tracking-[0.2em] mb-3">Método de pago</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setPayment('cash')}
                className={`py-3 rounded-xl font-semibold text-sm transition-all ${payment === 'cash' ? 'bg-green-500 text-white' : 'bg-green-50 border border-green-200 text-green-700'}`}>
                Efectivo
              </button>
              <button onClick={() => setPayment('card_manual')}
                className={`py-3 rounded-xl font-semibold text-sm transition-all ${payment === 'card_manual' ? 'bg-blue-500 text-white' : 'bg-blue-50 border border-blue-200 text-blue-700'}`}>
                Tarjeta
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 font-semibold bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3">
            <button onClick={clearCart}
              className="py-3 px-4 rounded-2xl border border-brand-line text-brand-muted text-sm font-semibold hover:text-brand-ink transition-colors">
              Limpiar
            </button>
            <button onClick={openNumpad} disabled={loading}
              className="flex-1 btn-primary text-sm disabled:opacity-60">
              {loading ? 'Creando...' : `Cobrar · $${total}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
