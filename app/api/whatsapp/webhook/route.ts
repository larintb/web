import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendText, buildWelcomeMessage } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  try {
    const payload: GatewayWebhookPayload = await req.json();

    // Solo procesar mensajes entrantes
    if (payload.event !== 'message') {
      return NextResponse.json({ ok: true });
    }

    const from = payload.data?.fromNumber ?? payload.data?.from;
    if (!from) return NextResponse.json({ ok: true });

    const supabase = createServiceClient();
    const { data: settings } = await supabase
      .from('settings')
      .select('business_open, closed_message, business_hours')
      .eq('id', 1)
      .single();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    if (!settings?.business_open) {
      await sendText({
        to:   from,
        body: settings?.closed_message
          ?? `¡Hola! Estamos cerrados en este momento.\nHorarios: ${settings?.business_hours ?? 'Lun-Dom 12:00-22:00'}\n¡Gracias!`,
      });
    } else {
      await sendText({ to: from, body: buildWelcomeMessage(appUrl) });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[whatsapp/webhook]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

interface GatewayWebhookPayload {
  event: string;
  timestamp?: number;
  data?: {
    from?:       string;
    fromNumber?: string;
    fromName?:   string;
    body?:       string;
    type?:       string;
  };
}
