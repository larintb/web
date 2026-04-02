import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { CreateOrderPayload } from '@/types';

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

    // Verificar que el negocio esté abierto
    const supabase = createServiceClient();
    const { data: settings } = await supabase
      .from('settings')
      .select('business_open')
      .eq('id', 1)
      .single();

    if (!settings?.business_open) {
      return NextResponse.json({ error: 'El negocio está cerrado' }, { status: 403 });
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
        notes:                    payload.notes ?? null,
        status:                   'new',
      })
      .select()
      .single();

    if (error) {
      console.error('[orders/POST] Supabase error:', error);
      return NextResponse.json({ error: 'Error al crear la orden' }, { status: 500 });
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    console.error('[orders/POST]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
