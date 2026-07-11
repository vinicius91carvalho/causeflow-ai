import { type NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/billing/webhook
 * Stripe webhook handler. Does NOT use withAuth() — verified via stripe-signature header.
 * When STRIPE_WEBHOOK_SECRET is unset (OSS local dev), signature verification fails closed.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const body = await request.text();

  if (!secret) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder');
    stripe.webhooks.constructEvent(body, signature, secret);
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
}
