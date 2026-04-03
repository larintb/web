import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendText, sendImage, buildStoreMapUrl } from '@/lib/whapi';
import type { OrderStatus } from '@/types';

const APP_URL   = process.env.NEXT_PUBLIC_APP_URL ?? '';
const STORE_LAT = process.env.STORE_LAT ?? '25.848049';
const STORE_LNG = process.env.STORE_LNG ?? '-97.503669';
const MAPS_URL  = `https://maps.google.com/?q=${STORE_LAT},${STORE_LNG}`;

const MESSAGES: Record<string, (name: string, code: string, deliveryType: string, orderId: string) => string> = {
  preparing: (name, code, _deliveryType, orderId) =>
    `¡Hola ${name}! 👨‍🍳\n\nTu orden *#${code}* de *Crispy Charles* ya está siendo preparada.\n\nSigue el estado de tu pedido en tiempo real:\n🔗 ${APP_URL}/order/${orderId}\n\nTe avisamos cuando esté lista. 🍗🔥`,

  ready: (name, code, deliveryType) =>
    deliveryType === 'pickup'
      ? `¡Hola ${name}! ✅\n\nTu orden *#${code}* de *Crispy Charles* ya está lista.\n\n🏪 *Pasa por ella en mostrador*, ¡te esperamos!\n\n📍 Cómo llegar:\n${MAPS_URL}`
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

  const code = order.id.slice(0, 6).toUpperCase();

  try {
    if (status === 'ready' && order.delivery_type === 'pickup') {
      const caption = MESSAGES[status](order.customer_name, code, order.delivery_type, order.id);
      await sendImage({ to: order.customer_phone, imageUrl: buildStoreMapUrl(), caption });
    } else {
      const message = MESSAGES[status](order.customer_name, code, order.delivery_type, order.id);
      await sendText({ to: order.customer_phone, body: message });
    }
  } catch (err) {
    console.error(`[orders/notify] WhatsApp error (status=${status}):`, err);
    // No fallar la petición si WhatsApp falla
  }

  return NextResponse.json({ ok: true });
}
