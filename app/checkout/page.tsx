'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/store/cart';
import PhoneInput from '@/components/PhoneInput';
import type { Extra } from '@/types';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// ── Formulario embebido de Stripe ──────────────────────────────────────────
function StripeForm({ clientSecret, orderData, onSuccess }: {
  clientSecret: string;
  orderData: Record<string, unknown>;
  onSuccess: (orderId: string) => void;
}) {
  const stripe   = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error,      setError]      = useState('');
  const clear = useCart(s => s.clear);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError('');

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message ?? 'Error al procesar el pago');
      setProcessing(false);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      // Crear la orden en Supabase
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orderData, stripe_payment_intent_id: paymentIntent.id }),
      });
      const { order } = await res.json();
      clear();
      onSuccess(order.id);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="surface-paper rounded-[28px] p-4">
        <PaymentElement />
      </div>
      {error && <p className="text-brand-red text-sm">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="btn-primary w-full text-lg"
      >
        {processing ? 'Procesando...' : 'Pagar ahora 💳'}
      </button>
    </form>
  );
}

// ── Página principal de Checkout ───────────────────────────────────────────
export default function CheckoutPage() {
  const router       = useRouter();
  const items        = useCart(s => s.items);
  const extras       = useCart(s => s.extras);
  const subtotalFn   = useCart(s => s.subtotal);
  const totalFn      = useCart(s => s.total);
  const deliveryType = useCart(s => s.deliveryType);
  const deliveryFee  = useCart(s => s.deliveryFee);
  const addExtra     = useCart(s => s.addExtra);
  const removeExtra  = useCart(s => s.removeExtra);
  const cartExtras   = useCart(s => s.extras);
  const clear        = useCart(s => s.clear);

  const [step,            setStep]            = useState<'info' | 'extras' | 'payment'>('info');
  const [availableExtras, setAvailableExtras] = useState<Extra[]>([]);
  const [paymentMethod,   setPaymentMethod]   = useState<'stripe' | 'cash'>('stripe');
  const [clientSecret,    setClientSecret]    = useState('');
  const [name,            setName]            = useState('');
  const [phone,           setPhone]           = useState('');
  const [address,         setAddress]         = useState('');
  const [notes,           setNotes]           = useState('');
  const [cashLoading,     setCashLoading]     = useState(false);
  // Timing del pedido
  const [orderTiming,     setOrderTiming]     = useState<'now' | 'later'>('now');
  const [scheduledTime,   setScheduledTime]   = useState('');
  const [timeSlots,       setTimeSlots]       = useState<string[]>([]);

  useEffect(() => {
    if (!deliveryType || items.length === 0) { router.replace('/'); return; }
    const supabase = createClient();

    Promise.all([
      supabase.from('extras').select('*').eq('active', true).order('display_order'),
      supabase.from('settings').select('business_hours').eq('id', 1).single(),
    ]).then(([{ data: extras }, { data: settings }]) => {
      setAvailableExtras(extras ?? []);

      // Parsear hora de cierre desde "Lun-Dom 12:00-22:00"
      const match = (settings?.business_hours ?? '').match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
      const closingStr = match?.[2] ?? '22:00';
      setTimeSlots(generateSlots(closingStr));
    });
  }, [deliveryType, items, router]);

  // Genera franjas de 20 min desde ahora+20min hasta hora de cierre
  function generateSlots(closingTime: string): string[] {
    const [closeH, closeM] = closingTime.split(':').map(Number);
    const closeTotal = closeH * 60 + closeM;

    const now = new Date();
    // Primera franja: redondear al siguiente múltiplo de 20 + 20 min de buffer
    const nowMins  = now.getHours() * 60 + now.getMinutes();
    const firstSlot = Math.ceil((nowMins + 20) / 20) * 20;

    const slots: string[] = [];
    for (let m = firstSlot; m <= closeTotal; m += 20) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0');
      const mm = String(m % 60).padStart(2, '0');
      slots.push(`${hh}:${mm}`);
    }
    return slots;
  }

  // Construir payload de la orden
  function buildOrderData(paymentMethod: 'stripe' | 'cash') {
    // Armar la nota combinando timing + notas del cliente
    const timingNote = orderTiming === 'later' && scheduledTime
      ? `📅 Para las ${scheduledTime}`
      : null;
    const allNotes = [timingNote, notes.trim() || null].filter(Boolean).join(' · ') || null;

    return {
      customer_name:    name.trim(),
      customer_phone:   phone.trim(),
      items,
      extras:           cartExtras,
      subtotal:         subtotalFn(),
      delivery_fee:     deliveryFee,
      total:            totalFn(),
      delivery_type:    deliveryType,
      delivery_address: deliveryType === 'delivery' ? address.trim() : null,
      payment_method:   paymentMethod,
      payment_status:   'pending',
      scheduled_time:   orderTiming === 'later' ? scheduledTime : null,
      notes:            allNotes,
    };
  }

  async function handleGoToPayment() {
    if (!name || !phone) return;
    if (deliveryType === 'delivery' && !address) return;

    if (paymentMethod === 'stripe') {
      // Crear PaymentIntent en Stripe
      const res = await fetch('/api/stripe/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: totalFn() }),
      });
      const { clientSecret: cs } = await res.json();
      setClientSecret(cs);
    }
    setStep('payment');
  }

  async function handleCashOrder() {
    setCashLoading(true);
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildOrderData('cash')),
    });
    const { order } = await res.json();
    clear();
    router.push(`/order/${order.id}`);
  }

  if (items.length === 0) return null;

  const subtotal = subtotalFn();
  const total    = totalFn();

  return (
    <div className="min-h-screen bg-brand-paper text-brand-ink">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-brand-paper/95 backdrop-blur border-b border-brand-line/80">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => step === 'info' ? router.back() : setStep(step === 'payment' ? 'extras' : 'info')}
            className="text-brand-muted hover:text-brand-ink transition-colors text-xl">←</button>
          <h1 className="font-display text-5xl leading-none text-brand-ink">
            {step === 'info' ? 'Datos' : step === 'extras' ? 'Extras' : 'Pago'}
          </h1>
        </div>
        {/* Steps indicator */}
        <div className="max-w-lg mx-auto px-4 pb-3 flex gap-1">
          {(['info', 'extras', 'payment'] as const).map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-all ${step === s || (i < (['info','extras','payment']).indexOf(step)) ? 'bg-brand-red' : 'bg-brand-line'}`} />
          ))}
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* STEP 1: Datos del cliente */}
        {step === 'info' && (
          <div className="space-y-4 animate-fade-in">
            <div className="surface-paper rounded-[28px] p-5 space-y-4">
              <div>
                <label className="text-xs uppercase tracking-[0.22em] text-brand-muted mb-2 block">Nombre</label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Ej: Juan García"
                  className="w-full bg-white border border-brand-line rounded-xl px-4 py-3 text-brand-ink placeholder-brand-muted focus:outline-none focus:border-brand-red transition-colors"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-[0.22em] text-brand-muted mb-2 block">WhatsApp</label>
                <PhoneInput value={phone} onChange={setPhone} />
              </div>
              {deliveryType === 'delivery' && (
                <div>
                  <label className="text-xs uppercase tracking-[0.22em] text-brand-muted mb-2 block">Dirección</label>
                  <textarea
                    value={address} onChange={e => setAddress(e.target.value)}
                    placeholder="Calle, número, colonia, referencias"
                    rows={3}
                    className="w-full bg-white border border-brand-line rounded-xl px-4 py-3 text-brand-ink placeholder-brand-muted focus:outline-none focus:border-brand-red transition-colors resize-none"
                  />
                </div>
              )}
              <div>
                <label className="text-xs uppercase tracking-[0.22em] text-brand-muted mb-2 block">Notas</label>
                <input
                  type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Sin cebolla, salsa aparte..."
                  className="w-full bg-white border border-brand-line rounded-xl px-4 py-3 text-brand-ink placeholder-brand-muted focus:outline-none focus:border-brand-red transition-colors"
                />
              </div>
            </div>

            {/* Timing del pedido */}
            <div>
              <label className="text-xs uppercase tracking-[0.22em] text-brand-muted mb-3 block">Cuándo</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setOrderTiming('now')}
                  className={`p-4 rounded-2xl border text-center transition-all ${orderTiming === 'now' ? 'border-brand-red bg-brand-red/10' : 'border-brand-line bg-white hover:border-brand-red/30'}`}
                >
                  <div className="text-2xl mb-1">⚡</div>
                  <p className="font-bold text-sm text-brand-ink">Ahora</p>
                  <p className="text-xs text-brand-muted">Lo antes posible</p>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderTiming('later')}
                  className={`p-4 rounded-2xl border text-center transition-all ${orderTiming === 'later' ? 'border-brand-orange bg-brand-orange/10' : 'border-brand-line bg-white hover:border-brand-orange/30'}`}
                >
                  <div className="text-2xl mb-1">🕐</div>
                  <p className="font-bold text-sm text-brand-ink">Después</p>
                  <p className="text-xs text-brand-muted">Elige hora</p>
                </button>
              </div>
              {orderTiming === 'later' && (
                <div className="mt-3">
                  {timeSlots.length === 0 ? (
                    <div className="surface-paper rounded-xl px-4 py-3 text-center text-brand-muted text-sm">
                      No hay horarios disponibles por hoy
                    </div>
                  ) : (
                    <select
                      value={scheduledTime}
                      onChange={e => setScheduledTime(e.target.value)}
                      className="w-full bg-white border border-brand-line rounded-xl px-4 py-3 text-brand-ink focus:outline-none focus:border-brand-orange transition-colors text-base appearance-none cursor-pointer"
                    >
                      <option value="" disabled>Selecciona hora</option>
                      {timeSlots.map(slot => (
                        <option key={slot} value={slot}>{slot} hrs</option>
                      ))}
                    </select>
                  )}
                  {scheduledTime && (
                    <p className="text-brand-orange text-xs mt-1.5 text-center font-semibold">
                      ✓ {deliveryType === 'delivery' ? 'Llega' : 'Listo'} a las {scheduledTime}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Resumen rápido */}
            <div className="surface-paper rounded-[28px] p-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.22em] text-brand-muted mb-3">Resumen</p>
              {items.map(i => (
                <div key={`${i.product_id}-${i.variant_name}`} className="flex justify-between text-sm">
                  <span className="text-brand-ink">{i.qty}× {i.product_name}</span>
                  <span className="text-brand-ink font-semibold">${i.subtotal}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep('extras')}
              disabled={!name || !phone || (deliveryType === 'delivery' && !address) || (orderTiming === 'later' && !scheduledTime)}
              className="btn-primary w-full text-lg"
            >
              Continuar →
            </button>
          </div>
        )}

        {/* STEP 2: Extras */}
        {step === 'extras' && (
          <div className="space-y-4 animate-fade-in">
            <p className="text-brand-muted text-sm">Extras opcionales</p>
            <div className="grid grid-cols-2 gap-3">
              {availableExtras.map(e => {
                const inCart = cartExtras.find(ce => ce.extra_id === e.id);
                return (
                  <div key={e.id} className="surface-paper rounded-[24px] p-3 flex flex-col gap-2">
                    <div>
                      <p className="text-brand-ink font-semibold text-sm">{e.name}</p>
                      <p className="text-brand-red text-sm font-bold">${e.price}</p>
                    </div>
                    {inCart ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => removeExtra(e.id)}
                          className="w-7 h-7 rounded-full bg-white border border-brand-line text-brand-ink font-bold flex items-center justify-center">−</button>
                        <span className="text-brand-ink font-bold flex-1 text-center">{inCart.qty}</span>
                        <button onClick={() => addExtra({ extra_id: e.id, extra_name: e.name, qty: 1, unit_price: e.price })}
                          className="w-7 h-7 rounded-full bg-brand-red text-white font-bold flex items-center justify-center">+</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addExtra({ extra_id: e.id, extra_name: e.name, qty: 1, unit_price: e.price })}
                        className="w-full text-xs bg-white hover:bg-brand-red hover:text-white text-brand-ink py-1.5 rounded-lg font-semibold transition-colors border border-brand-line"
                      >
                        Agregar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Método de pago */}
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-brand-muted mb-3">Pago</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentMethod('stripe')}
                  className={`p-4 rounded-2xl border text-center transition-all ${paymentMethod === 'stripe' ? 'border-brand-red bg-brand-red/10' : 'border-brand-line bg-white hover:border-brand-red/30'}`}
                >
                  <div className="text-2xl mb-1">💳</div>
                  <p className="font-bold text-sm text-brand-ink">Tarjeta</p>
                  <p className="text-xs text-brand-muted">Pago seguro</p>
                </button>
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-4 rounded-2xl border text-center transition-all ${paymentMethod === 'cash' ? 'border-brand-orange bg-brand-orange/10' : 'border-brand-line bg-white hover:border-brand-orange/30'}`}
                >
                  <div className="text-2xl mb-1">💵</div>
                  <p className="font-bold text-sm text-brand-ink">Efectivo</p>
                  <p className="text-xs text-brand-muted">Pagar al recibir</p>
                </button>
              </div>
            </div>

            {/* Total */}
            <div className="surface-paper rounded-[28px] p-4">
              <div className="flex justify-between text-sm text-brand-muted mb-1">
                <span>Subtotal</span><span>${subtotal}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between text-sm text-brand-muted mb-1">
                  <span>Envío</span><span>${deliveryFee}</span>
                </div>
              )}
              <div className="flex justify-between text-brand-ink font-black text-xl pt-2 border-t border-brand-line">
                <span>Total</span><span>${total}</span>
              </div>
            </div>

            {paymentMethod === 'stripe' ? (
              <button onClick={handleGoToPayment} className="btn-primary w-full text-lg">
                Continuar a pago
              </button>
            ) : (
              <button onClick={handleCashOrder} disabled={cashLoading} className="btn-primary w-full text-lg bg-brand-orange hover:bg-orange-700">
                {cashLoading ? 'Enviando...' : 'Confirmar orden'}
              </button>
            )}
          </div>
        )}

        {/* STEP 3: Stripe */}
        {step === 'payment' && paymentMethod === 'stripe' && clientSecret && (
          <div className="animate-fade-in">
            <div className="surface-paper rounded-[28px] p-4 mb-4">
              <div className="flex justify-between text-brand-ink font-black text-xl">
                <span>Total</span><span>${total}</span>
              </div>
            </div>
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'night' } }}>
              <StripeForm
                clientSecret={clientSecret}
                orderData={buildOrderData('stripe')}
                onSuccess={id => router.push(`/order/${id}`)}
              />
            </Elements>
          </div>
        )}
      </div>
    </div>
  );
}
