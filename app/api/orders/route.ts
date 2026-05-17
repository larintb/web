import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendText } from '@/lib/whatsapp';
import type { CreateOrderPayload } from '@/types';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

export async function POST(req: NextRequest) {
  try {
    const payload: CreateOrderPayload = await req.json();

    // Validación básica
    if (!payload.customer_name || !payload.customer_phone) {
      return NextResponse.json({ error: 'Faltan datos del cliente' }, { status: 400 });
    }
    if (!payload.items || payload.items.length === 0) {
      return NextResponse.json({ error: 'La orden no tiene items' }, { status: 400 });
    }
    if (!['pickup', 'delivery'].includes(payload.delivery_type)) {
      return NextResponse.json({ error: 'Tipo de entrega inválido' }, { status: 400 });
    }
    if (payload.delivery_type === 'delivery' && !payload.delivery_address) {
      return NextResponse.json({ error: 'Falta la dirección de entrega' }, { status: 400 });
    }
    if (!['stripe', 'cash'].includes(payload.payment_method)) {
      return NextResponse.json({ error: 'Método de pago inválido' }, { status: 400 });
    }

    // Verificar que el negocio esté abierto y no pausado
    const supabase = createServiceClient();
    const { data: settings } = await supabase
      .from('settings')
      .select('business_open, orders_paused')
      .eq('id', 1)
      .single();

    if (!settings?.business_open) {
      return NextResponse.json({ error: 'El negocio está cerrado' }, { status: 403 });
    }
    if (settings?.orders_paused) {
      return NextResponse.json({ error: 'Los pedidos están pausados temporalmente' }, { status: 503 });
    }

    // Verificar que Stripe payment intent sea válido (si aplica)
    let paymentStatus: 'pending' | 'paid' = 'pending';
    if (payload.payment_method === 'stripe' && payload.stripe_payment_intent_id) {
      const { stripe } = await import('@/lib/stripe');
      const intent = await stripe.paymentIntents.retrieve(payload.stripe_payment_intent_id);
      if (intent.status !== 'succeeded') {
        return NextResponse.json({ error: 'El pago no fue confirmado' }, { status: 402 });
      }
      paymentStatus = 'paid';
    }

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        customer_name:            payload.customer_name.trim(),
        customer_phone:           payload.customer_phone.trim(),
        items:                    payload.items,
        extras:                   payload.extras ?? [],
        subtotal:                 payload.subtotal,
        delivery_fee:             payload.delivery_fee,
        total:                    payload.total,
        delivery_type:            payload.delivery_type,
        delivery_address:         payload.delivery_address ?? null,
        payment_method:           payload.payment_method,
        payment_status:           paymentStatus,
        stripe_payment_intent_id: payload.stripe_payment_intent_id ?? null,
        scheduled_time:           payload.scheduled_time ?? null,
        notes:                    payload.notes ?? null,
        status:                   'new',
      })
      .select()
      .single();

    if (error) {
      console.error('[orders/POST] Supabase error:', error);
      return NextResponse.json({ error: 'Error al crear la orden' }, { status: 500 });
    }

    // ── WhatsApp: confirmación al cliente + alerta al admin ────────────────
    const code = order.id.slice(0, 6).toUpperCase();
    const itemLines = (payload.items ?? [])
      .map(i => `• ${i.qty}× ${i.product_name} (${i.variant_name})`)
      .join('\n');
    const scheduledLine = payload.scheduled_time
      ? `\n⏰ Hora programada: *${payload.scheduled_time}*`
      : '';
    const deliveryLine = payload.delivery_type === 'delivery'
      ? `🛵 Domicilio: ${payload.delivery_address}`
      : `🏪 Recoger en tienda`;
    const customerMsg =
      `¡Hola ${payload.customer_name.trim()}! 🍗\n\n` +
      `Recibimos tu orden *#${code}* en *Crispy Charles*.\n\n` +
      `${itemLines}\n\n` +
      `💰 Total: *$${payload.total}*\n` +
      `${deliveryLine}${scheduledLine}\n\n` +
      `Sigue el estado de tu pedido aquí:\n🔗 ${APP_URL}/order/${order.id}\n\n` +
      `¡Gracias por tu orden! 🔥`;

    // Fire and forget — la orden ya está en Supabase, no bloqueamos al cliente
    sendText({ to: payload.customer_phone.trim(), body: customerMsg })
      .catch(err => console.error('[orders/POST] WhatsApp cliente:', err));

    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    console.error('[orders/POST]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
