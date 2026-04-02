'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { Order, OrderStatus } from '@/types';

const STATUS_CONFIG: Record<OrderStatus, { label: string; icon: string; color: string }> = {
  new:       { label: 'Orden recibida',     icon: '📋', color: 'text-blue-400'   },
  preparing: { label: 'Preparando tu orden', icon: '👨‍🍳', color: 'text-brand-orange' },
  ready:     { label: '¡Tu orden está lista!', icon: '✅', color: 'text-green-400' },
  delivered: { label: 'Entregada',           icon: '🎉', color: 'text-gray-400'  },
};

export default function OrderPage() {
  const { id }   = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const supabase = createClient();

    // Carga inicial
    supabase.from('orders').select('*').eq('id', id).single()
      .then(({ data }) => { setOrder(data); setLoading(false); });

    // Realtime: actualizar estado en vivo
    const channel = supabase.channel(`order-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        (payload) => setOrder(payload.new as Order)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-black">
        <div className="w-12 h-12 border-4 border-brand-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-black text-center px-6">
        <p className="text-5xl mb-4">🔍</p>
        <h1 className="text-2xl font-black mb-2">Orden no encontrada</h1>
        <Link href="/" className="text-brand-red hover:underline mt-4">← Regresar al menú</Link>
      </div>
    );
  }

  const statusInfo = STATUS_CONFIG[order.status];
  const orderCode  = order.id.slice(0, 6).toUpperCase();

  return (
    <div className="min-h-screen bg-brand-black px-4 py-8 max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <p className="text-5xl mb-4 animate-bounce-in">{statusInfo.icon}</p>
        <h1 className={`text-3xl font-black mb-2 ${statusInfo.color}`}>{statusInfo.label}</h1>
        <p className="text-gray-400">Orden <span className="text-white font-mono font-bold">#{orderCode}</span></p>
        {order.status === 'ready' && (
          <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-2xl p-4">
            <p className="text-green-400 font-semibold">
              {order.delivery_type === 'pickup'
                ? '¡Pasa por tu orden! Ya está lista en mostrador. 🏪'
                : '¡Tu repartidor ya va en camino! 🛵'}
            </p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {(['new', 'preparing', 'ready', 'delivered'] as OrderStatus[]).map((s, i) => (
            <div key={s} className="flex flex-col items-center gap-1 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                order.status === s ? 'bg-brand-red text-white scale-110' :
                (['new','preparing','ready','delivered']).indexOf(order.status) > i ? 'bg-green-500 text-white' :
                'bg-brand-gray text-gray-600'
              }`}>
                {STATUS_CONFIG[s].icon}
              </div>
              {i < 3 && <div className={`hidden sm:block h-0.5 flex-1 ${(['new','preparing','ready','delivered']).indexOf(order.status) > i ? 'bg-green-500' : 'bg-brand-gray'}`} />}
            </div>
          ))}
        </div>
      </div>

      {/* Detalle de la orden */}
      <div className="bg-brand-gray rounded-2xl p-5 mb-4 space-y-3">
        <h2 className="font-black text-white">Tu pedido</h2>
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-gray-300">{item.qty}× {item.product_name} ({item.variant_name})</span>
            <span className="text-white font-semibold">${item.subtotal}</span>
          </div>
        ))}
        {order.extras.length > 0 && (
          <>
            <div className="border-t border-white/10 pt-2">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Extras</p>
              {order.extras.map((e, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-300">{e.qty}× {e.extra_name}</span>
                  <span className="text-white font-semibold">${e.subtotal}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="border-t border-white/10 pt-2 space-y-1">
          <div className="flex justify-between text-sm text-gray-400">
            <span>Subtotal</span><span>${order.subtotal}</span>
          </div>
          {order.delivery_fee > 0 && (
            <div className="flex justify-between text-sm text-gray-400">
              <span>Envío</span><span>${order.delivery_fee}</span>
            </div>
          )}
          <div className="flex justify-between text-white font-black text-lg">
            <span>Total</span><span>${order.total}</span>
          </div>
        </div>
      </div>

      {/* Info de entrega */}
      <div className="bg-brand-gray rounded-2xl p-5 mb-6 space-y-2">
        <h2 className="font-black text-white mb-2">Datos de entrega</h2>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Tipo</span>
          <span className="text-white">{order.delivery_type === 'pickup' ? '🏪 Recoger' : '🛵 Domicilio'}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Pago</span>
          <span className={`font-semibold ${order.payment_status === 'paid' ? 'text-green-400' : 'text-brand-orange'}`}>
            {order.payment_method === 'stripe' ? '💳 Tarjeta' : '💵 Efectivo'}
            {' · '}
            {order.payment_status === 'paid' ? 'Pagado ✓' : 'Pendiente'}
          </span>
        </div>
        {order.delivery_address && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Dirección</span>
            <span className="text-white text-right max-w-[60%]">{order.delivery_address}</span>
          </div>
        )}
        {order.notes && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Notas</span>
            <span className="text-white text-right max-w-[60%]">{order.notes}</span>
          </div>
        )}
      </div>

      <Link href="/" className="block text-center text-brand-red hover:underline text-sm">
        ← Hacer otro pedido
      </Link>
    </div>
  );
}
