import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendText } from '@/lib/whapi';
import type { OrderStatus } from '@/types';

const MESSAGES: Record<string, (name: string, code: string, deliveryType: string) => string> = {
  preparing: (name, code) =>
    `¡Hola ${name}! 👨‍🍳\n\nTu orden *#${code}* de *Crispy Charles* ya está siendo preparada.\n\nTe avisamos cuando esté lista. 🍗🔥`,

  ready: (name, code, deliveryType) =>
    deliveryType === 'pickup'
      ? `¡Hola ${name}! ✅\n\nTu orden *#${code}* de *Crispy Charles* ya está lista.\n\n🏪 *Pasa por ella en mostrador*, ¡te esperamos!`
      : `¡Hola ${name}! ✅\n\nTu orden *#${code}* de *Crispy Charles* ya está en camino.\n\n🛵 ¡Que la disfrutes!`,
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { status }: { status: OrderStatus } = await req.json();

  if (!MESSAGES[status]) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const service = createServiceClient();
  const { data: order, error } = await service
    .from('orders')
    .select('customer_phone, customer_name, delivery_type, id')
    .eq('id', id)
    .single();

  if (error || !order) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
  }

  const code    = order.id.slice(0, 6).toUpperCase();
  const message = MESSAGES[status](order.customer_name, code, order.delivery_type);

  try {
    await sendText({ to: order.customer_phone, body: message });
  } catch (err) {
    console.error(`[orders/notify] WhatsApp error (status=${status}):`, err);
    // No fallar la petición si WhatsApp falla
  }

  return NextResponse.json({ ok: true });
}
