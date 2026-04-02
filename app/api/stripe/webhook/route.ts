import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { createServiceClient } from '@/lib/supabase/server';
import Stripe from 'stripe';

// IMPORTANTE: Next.js no debe parsear el body aquí, Stripe necesita el raw body
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const sig     = req.headers.get('stripe-signature');
  const secret  = process.env.STRIPE_WEBHOOK_SECRET!;
  const rawBody = await req.arrayBuffer();
  const buf     = Buffer.from(rawBody);

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig!, secret);
  } catch (err) {
    console.error('[stripe/webhook] Signature error:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const supabase = createServiceClient();

    // Actualizar la orden como pagada (si ya fue creada)
    const { error } = await supabase
      .from('orders')
      .update({ payment_status: 'paid' })
      .eq('stripe_payment_intent_id', intent.id)
      .eq('payment_status', 'pending');

    if (error) {
      console.error('[stripe/webhook] Supabase update error:', error);
    }
  }

  return NextResponse.json({ received: true });
}
