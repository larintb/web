'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { imgUrl } from '@/lib/image-url';
import type { Order } from '@/types';

// Cargar MapboxMap de forma dinámica para mejor SSR performance
const MapboxMap = dynamic(() => import('@/components/MapboxMap').then(m => ({ default: m.MapboxMap })), { 
  ssr: false,
  loading: () => <div className="w-full h-80 bg-gray-200 rounded-2xl animate-pulse" />
});

// ── Status config ──────────────────────────────────────────────────────────
type StepKey = 'new' | 'preparing' | 'ready' | 'delivered';

const STEPS: { key: StepKey; label: string; icon: string }[] = [
  { key: 'new',       label: 'Confirmado', icon: '✓'  },
  { key: 'preparing', label: 'Preparando', icon: '👨‍🍳' },
  { key: 'ready',     label: 'Listo',      icon: '✅'  },
  { key: 'delivered', label: 'Entregado',  icon: '🎉'  },
];

const STATUS_ORDER: StepKey[] = ['new', 'preparing', 'ready', 'delivered'];

const STATUS_HERO: Record<StepKey, { icon: string; title: (o: Order) => string; subtitle: (o: Order) => string }> = {
  new: {
    icon: '🎉',
    title: () => 'Pedido confirmado',
    subtitle: (o) =>
      o.payment_method === 'cash'
        ? `Ten listo tu dinero: $${o.total}`
        : 'Tu pago fue procesado ✓',
  },
  preparing: {
    icon: '👨‍🍳',
    title: () => 'Preparando tu pedido',
    subtitle: () => 'Estamos trabajando en tu orden…',
  },
  ready: {
    icon: '✅',
    title: (o: Order) => o.delivery_type === 'pickup' ? '¡Pasa por tu pedido!' : '¡Listo para enviarte!',
    subtitle: (o: Order) =>
      o.delivery_type === 'pickup'
        ? 'Tu orden está lista en mostrador 🏪'
        : 'Tu repartidor va en camino 🛵',
  },
  delivered: {
    icon: '🙌',
    title: () => '¡Que lo disfrutes!',
    subtitle: () => 'Pedido entregado. ¡Gracias por elegir Crispy Charles!',
  },
};

// ── Component ──────────────────────────────────────────────────────────────
export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const [order,   setOrder]   = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();

    supabase.from('orders').select('*').eq('id', id).single()
      .then(({ data }) => { setOrder(data); setLoading(false); });

    const channel = supabase.channel(`order-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}`,
      }, (payload) => setOrder(payload.new as Order))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-paper">
        <div className="w-12 h-12 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-paper text-center px-6">
        <p className="text-6xl mb-4">🔍</p>
        <h1 className="font-display text-6xl text-brand-ink mb-2">No encontrado</h1>
        <Link href="/" className="text-brand-red hover:underline mt-4 text-sm">← Regresar al inicio</Link>
      </div>
    );
  }

  const currentStep = STATUS_ORDER.indexOf(order.status);
  const hero      = STATUS_HERO[order.status];
  const orderCode = order.id.slice(0, 6).toUpperCase();

  return (
    <div className="min-h-screen bg-brand-paper text-brand-ink">

      {/* ── Header ── */}
      <header className="sticky top-0 z-10 bg-brand-paper/95 backdrop-blur border-b border-brand-line/80">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Image src={imgUrl('logo.png')!} alt="Crispy Charles" width={100} height={40} className="object-contain" />
          <span className="font-mono font-black text-brand-muted text-sm">#{orderCode}</span>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5 pb-12">

        {/* ── Hero status ── */}
        <div className="surface-paper rounded-[32px] p-6 text-center">
          <div className="text-6xl mb-3 animate-bounce-in">{hero.icon}</div>
          <h1 className="font-display text-6xl text-brand-ink leading-none mb-1">
            {hero.title(order)}
          </h1>
          <p className={`text-sm font-semibold mt-2 ${
            order.status === 'new' && order.payment_method === 'cash'
              ? 'text-brand-orange'
              : 'text-brand-muted'
          }`}>
            {hero.subtitle(order)}
          </p>
        </div>

        {/* ── Progress stepper ── */}
        <div className="surface-paper rounded-[28px] px-5 py-5">
          <div className="flex items-start">
            {STEPS.map((step, i) => {
              const done   = currentStep > i;
              const active = currentStep === i;
              const last   = i === STEPS.length - 1;
              return (
                <div key={step.key} className="flex-1 flex flex-col items-center relative">
                  {/* Connector line */}
                  {!last && (
                    <div className={`absolute top-4 left-1/2 w-full h-0.5 transition-all duration-500 ${
                      done ? 'bg-brand-red' : 'bg-brand-line'
                    }`} />
                  )}
                  {/* Circle */}
                  <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-all duration-300 ${
                    done   ? 'bg-brand-red text-white' :
                    active ? 'bg-brand-red text-white ring-4 ring-brand-red/20 scale-110' :
                             'bg-brand-line text-brand-muted'
                  }`}>
                    {done ? '✓' : active ? <span className="text-xs">{step.icon}</span> : <span className="text-xs opacity-40">{i + 1}</span>}
                  </div>
                  {/* Label */}
                  <p className={`mt-2 text-[10px] uppercase tracking-[0.15em] text-center leading-tight ${
                    active ? 'text-brand-red font-black' :
                    done   ? 'text-brand-ink font-semibold' :
                             'text-brand-muted'
                  }`}>
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Ticket ── */}
        <div className="surface-paper rounded-[28px] overflow-hidden">

          {/* Ticket header */}
          <div className="bg-brand-red px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-white/70 text-[10px] uppercase tracking-[0.25em]">Crispy Charles</p>
              <p className="text-white font-black text-lg">Tu pedido</p>
            </div>
            <div className="text-right">
              <p className="text-white/70 text-[10px] uppercase tracking-[0.25em]">Orden</p>
              <p className="text-white font-mono font-black">#{orderCode}</p>
            </div>
          </div>

          {/* Dashed divider */}
          <div className="border-b border-dashed border-brand-line mx-5" />

          {/* Items */}
          <div className="px-5 py-4 space-y-2.5">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between items-baseline gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-brand-ink font-semibold text-sm">{item.qty}×</span>
                  <span className="text-brand-ink text-sm ml-1.5">{item.product_name}</span>
                  {item.variant_name && item.variant_name !== 'Regular' && (
                    <span className="text-brand-muted text-xs ml-1">({item.variant_name})</span>
                  )}
                </div>
                <span className="text-brand-ink font-black text-sm flex-shrink-0">${item.subtotal}</span>
              </div>
            ))}
            {order.extras.length > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-[0.2em] text-brand-muted pt-1">Extras</p>
                {order.extras.map((e, i) => (
                  <div key={i} className="flex justify-between items-baseline gap-2">
                    <span className="text-brand-muted text-sm flex-1">{e.qty}× {e.extra_name}</span>
                    <span className="text-brand-ink font-semibold text-sm flex-shrink-0">${e.subtotal}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Dashed divider */}
          <div className="border-b border-dashed border-brand-line mx-5" />

          {/* Totals */}
          <div className="px-5 py-4 space-y-1.5">
            <div className="flex justify-between text-sm text-brand-muted">
              <span>Subtotal</span><span>${order.subtotal}</span>
            </div>
            {order.delivery_fee > 0 && (
              <div className="flex justify-between text-sm text-brand-muted">
                <span>Envío</span><span>${order.delivery_fee}</span>
              </div>
            )}
            <div className="flex justify-between text-brand-ink font-black text-xl pt-1">
              <span>Total</span><span>${order.total}</span>
            </div>
          </div>

          {/* Dashed divider */}
          <div className="border-b border-dashed border-brand-line mx-5" />

          {/* Delivery info */}
          <div className="px-5 py-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">Tipo</span>
              <span className="text-brand-ink font-semibold">
                {order.delivery_type === 'pickup' ? '🏪 Recoger' : '🛵 Domicilio'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-brand-muted">Pago</span>
              <span className={`font-semibold ${
                order.payment_status === 'paid' ? 'text-green-600' : 'text-brand-orange'
              }`}>
                {order.payment_method === 'stripe' ? '💳 Tarjeta' : '💵 Efectivo'}
                {' · '}
                {order.payment_status === 'paid' ? 'Pagado ✓' : 'Pagar al recibir'}
              </span>
            </div>
            {order.delivery_address && (
              <div className="flex justify-between text-sm gap-4">
                <span className="text-brand-muted flex-shrink-0">Dirección</span>
                <span className="text-brand-ink text-right">{order.delivery_address}</span>
              </div>
            )}
            {order.notes && (
              <div className="flex justify-between text-sm gap-4">
                <span className="text-brand-muted flex-shrink-0">Notas</span>
                <span className="text-brand-ink text-right">{order.notes}</span>
              </div>
            )}

            {/* Mapa 3D para pickup */}
            {order.delivery_type === 'pickup' && (
              <div className="mt-4 pt-4 border-t border-dashed border-brand-line">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-muted font-semibold mb-3">🏪 Vista ubicación del negocio</p>
                <div className="rounded-2xl overflow-hidden border border-brand-line h-80 shadow-lg">
                  <MapboxMap 
                    address="Crispy Charles, Matamoros, Tamaulipas"
                    businessName="🍗 Crispy Charles"
                    coords={[-97.503669, 25.848049]}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Ticket footer */}
          <div className="bg-brand-paper border-t border-dashed border-brand-line mx-0 px-5 py-3 text-center">
            <p className="text-[10px] uppercase tracking-[0.25em] text-brand-muted">
              Crispy Charles · Gracias por tu pedido 🍗
            </p>
          </div>
        </div>

        <Link
          href="/"
          className="block text-center text-brand-red font-semibold text-sm hover:underline"
        >
          ← Hacer otro pedido
        </Link>
      </div>
    </div>
  );
}
