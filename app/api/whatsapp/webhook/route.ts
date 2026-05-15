import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendText, buildWelcomeMessage } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  try {
    const payload: GatewayWebhookPayload = await req.json();

    if (payload.event !== 'message.received') {
      return NextResponse.json({ ok: true });
    }

    if (payload.data?.key?.fromMe) {
      return NextResponse.json({ ok: true });
    }

    const rawJid = payload.data?.from ?? payload.data?.key?.remoteJid;
    if (!rawJid) return NextResponse.json({ ok: true });

    // Strip @s.whatsapp.net / @c.us suffix
    const digits = rawJid.split('@')[0];
    // Normalize Mexican legacy format: 521XXXXXXXXXX (13) → 52XXXXXXXXXX (12)
    const phone = digits.startsWith('521') && digits.length === 13
      ? '52' + digits.slice(3)
      : digits;

    const supabase = createServiceClient();

    // Atomic insert — if phone already exists, returns empty array (no rows inserted)
    const { data: inserted } = await supabase
      .from('whatsapp_contacts')
      .upsert({ phone }, { onConflict: 'phone', ignoreDuplicates: true })
      .select('phone');

    if (!inserted || inserted.length === 0) {
      return NextResponse.json({ ok: true });
    }

    // Use original JID for sending (gateway accepts full JID directly)
    const from = rawJid;

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
  data?: {
    key?: {
      id?: string;
      fromMe?: boolean;
      remoteJid?: string;
    };
    message?: {
      type?: string;
      body?: string;
      timestamp?: number;
      hasMedia?: boolean;
    };
    pushName?: string;
    from?: string;
    fromName?: string;
  };
}
