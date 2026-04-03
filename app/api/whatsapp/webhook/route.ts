import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendText, buildWelcomeMessage } from '@/lib/whapi';

// whapi.cloud llama a esta ruta cuando llega un mensaje
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // whapi envía mensajes en body.messages[]
    // Responder a CUALQUIER mensaje entrante (texto, imagen, audio, sticker, etc.)
    const messages: WhapiMessage[] = body.messages ?? [];
    const incoming = messages.filter((m: WhapiMessage) => !m.from_me);

    if (incoming.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const supabase = createServiceClient();
    const { data: settings } = await supabase
      .from('settings')
      .select('business_open, closed_message, business_hours')
      .eq('id', 1)
      .single();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    for (const msg of incoming) {
      const from = msg.from ?? msg.chat_id;
      if (!from) continue;

      if (!settings?.business_open) {
        // Negocio cerrado → mensaje de cerrado
        await sendText({
          to:   from,
          body: settings?.closed_message
            ?? `¡Hola! Estamos cerrados en este momento.\nHorarios: ${settings?.business_hours ?? 'Lun-Dom 12:00-22:00'}\n¡Gracias!`,
        });
      } else {
        // Negocio abierto → enviar link del menú
        await sendText({
          to:   from,
          body: buildWelcomeMessage(appUrl),
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[whatsapp/webhook]', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// GET para verificación del webhook (algunos providers usan esto)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  if (token === process.env.WHAPI_TOKEN) {
    return new Response(req.nextUrl.searchParams.get('hub.challenge') ?? 'ok');
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// ── Types mínimos de whapi ────────────────────────────────────────────────
interface WhapiMessage {
  id:        string;
  from?:     string;
  from_me:   boolean;
  type:      string;
  text?:     { body: string };
  chat_id?:  string;
}
