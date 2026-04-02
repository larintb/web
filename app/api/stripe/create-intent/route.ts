import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const { amount } = await req.json();

    if (!amount || typeof amount !== 'number' || amount < 10) {
      return NextResponse.json({ error: 'Monto inválido' }, { status: 400 });
    }

    // Stripe trabaja en centavos
    const paymentIntent = await stripe.paymentIntents.create({
      amount:   Math.round(amount * 100),
      currency: 'mxn',
      automatic_payment_methods: { enabled: true },
      metadata: { source: 'crispy-charles-web' },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('[stripe/create-intent]', err);
    return NextResponse.json({ error: 'Error al crear el pago' }, { status: 500 });
  }
}
