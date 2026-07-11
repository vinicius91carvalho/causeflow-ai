import { type NextRequest, NextResponse } from 'next/server';
import { BILLING_DISABLED_MESSAGE } from '@/contexts/billing/application/billing-disabled';

/**
 * POST /api/billing/webhook
 *
 * Stripe webhooks are owned by the Core API. The dashboard no longer ships the
 * `stripe` SDK (AC-048 / AC-049), so this route fails closed: require the
 * legacy stripe-signature header for callers that still hit it, then return
 * 410 Gone with the OSS billing-disabled message.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  // Consume the body so the request is fully read (Stripe-style clients expect it).
  await request.text();

  return NextResponse.json({ error: BILLING_DISABLED_MESSAGE }, { status: 410 });
}
