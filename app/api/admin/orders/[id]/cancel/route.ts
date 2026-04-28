import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe';
import { sendText } from '@/lib/whatsapp';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { reason } = await req.json().catch(() => ({})) as { reason?: string };
  const service = createServiceClient();

  const { data: order, error: fetchErr } = await service
    .from('orders')
    .select('id, status, customer_name, customer_phone, delivery_type, payment_method, payment_status, stripe_payment_intent_id, total')
    .eq('id', id)
    .single();

  if (fetchErr || !order) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  }

  if (order.status !== 'new') {
    return NextResponse.json({ error: 'Solo se pueden rechazar órdenes nuevas' }, { status: 409 });
  }

  // Reembolso Stripe si aplica
  if (order.payment_method === 'stripe' && order.payment_status === 'paid' && order.stripe_payment_intent_id) {
    try {
      await stripe.refunds.create({ payment_intent: order.stripe_payment_intent_id });
      await service.from('orders').update({ payment_status: 'refunded' }).eq('id', id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[cancel] Stripe refund error:', msg);
      return NextResponse.json({ error: `Error al procesar reembolso: ${msg}` }, { status: 502 });
    }
  }

  await service.from('orders').update({ status: 'cancelled' }).eq('id', id);

  // Notificación WhatsApp
  const code = order.id.slice(0, 6).toUpperCase();
  const wasRefunded = order.payment_method === 'stripe' && order.payment_status === 'paid';

  const reasonText = reason?.trim() || 'Por favor no pases al negocio.';

  let message: string;
  if (order.delivery_type === 'pickup' && order.payment_method === 'cash') {
    message =
      `Hola ${order.customer_name}, tu orden *#${code}* de *Crispy Charles* fue cancelada.\n\n` +
      `🚫 *${reasonText}*\n\nDisculpa las molestias. 🙏`;
  } else if (wasRefunded) {
    message =
      `Hola ${order.customer_name}, tu orden *#${code}* de *Crispy Charles* fue cancelada.\n\n` +
      `💳 Tu pago de *$${order.total}* fue reembolsado a tu tarjeta. El cargo desaparecerá en 5-10 días hábiles.\n\nDisculpa las molestias. 🙏`;
  } else {
    message =
      `Hola ${order.customer_name}, tu orden *#${code}* de *Crispy Charles* fue cancelada.\n\nDisculpa las molestias. 🙏`;
  }

  let whatsapp_error: string | undefined;
  try {
    await sendText({ to: order.customer_phone, body: message });
  } catch (err) {
    whatsapp_error = err instanceof Error ? err.message : String(err);
    console.error('[cancel] WhatsApp error:', whatsapp_error);
  }

  return NextResponse.json({ ok: true, ...(whatsapp_error && { whatsapp_error }) });
}
