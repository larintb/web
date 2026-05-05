import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { sendText, toChatId } from '@/lib/whatsapp';
import type { CreatePOSOrderPayload } from '@/types';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const payload: CreatePOSOrderPayload = await req.json();

    if (!payload.customer_name?.trim()) {
      return NextResponse.json({ error: 'El nombre del cliente es obligatorio' }, { status: 400 });
    }
    if (!payload.items || payload.items.length === 0) {
      return NextResponse.json({ error: 'La orden no tiene items' }, { status: 400 });
    }
    if (!['cash', 'card_manual'].includes(payload.payment_method)) {
      return NextResponse.json({ error: 'Método de pago inválido' }, { status: 400 });
    }

    const service = createServiceClient();
    const { data: order, error } = await service
      .from('orders')
      .insert({
        customer_name:  payload.customer_name.trim(),
        customer_phone: payload.customer_phone?.trim() ?? '',
        items:          payload.items,
        extras:         payload.extras ?? [],
        subtotal:       payload.subtotal,
        delivery_fee:   0,
        total:          payload.total,
        delivery_type:  'pickup',
        delivery_address: null,
        payment_method: payload.payment_method,
        payment_status: 'paid',
        status:         'new',
        source:         'pos',
        notes:          payload.notes ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('[pos/POST] Supabase error:', error);
      return NextResponse.json({ error: 'Error al crear la orden' }, { status: 500 });
    }

    // Send WhatsApp to customer only if phone provided
    const phone = payload.customer_phone?.trim();
    if (phone) {
      const code      = order.id.slice(0, 6).toUpperCase();
      const itemLines = payload.items.map(i => `• ${i.qty}× ${i.product_name} (${i.variant_name})`).join('\n');
      const msg =
        `¡Hola ${payload.customer_name.trim()}! 🍗\n\n` +
        `Tu orden *#${code}* en *Crispy Charles* está en preparación.\n\n` +
        `${itemLines}\n\n` +
        `💰 Total: *$${payload.total}*\n🏪 Recoger en tienda\n\n` +
        `Sigue el estado de tu pedido:\n🔗 ${APP_URL}/order/${order.id}\n\n¡Gracias! 🔥`;

      sendText({ to: toChatId(phone), body: msg })
        .catch(err => console.error('[pos/POST] WhatsApp error:', err));
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    console.error('[pos/POST]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
