import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendText, toChatId } from '@/lib/whapi';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const service = createServiceClient();

  // Obtener la orden
  const { data: order, error } = await service
    .from('orders')
    .select('customer_phone, customer_name, delivery_type, id')
    .eq('id', id)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  }

  // Enviar WhatsApp al cliente
  const orderCode = order.id.slice(0, 6).toUpperCase();
  const message = order.delivery_type === 'pickup'
    ? `¡Hola ${order.customer_name}! 🎉\n\nTu orden *#${orderCode}* de *Crispy Charles* ya está lista. ¡Pasa por ella en mostrador! 🍗🔥`
    : `¡Hola ${order.customer_name}! 🎉\n\nTu orden *#${orderCode}* de *Crispy Charles* ya está en camino. ¡Disfrútala! 🛵🍗`;

  try {
    await sendText({ to: order.customer_phone, body: message });
  } catch (err) {
    console.error('[admin/orders/ready] WhatsApp error:', err);
    // No fallar si WhatsApp no funciona — la orden ya fue marcada como lista
  }

  return NextResponse.json({ ok: true });
}
