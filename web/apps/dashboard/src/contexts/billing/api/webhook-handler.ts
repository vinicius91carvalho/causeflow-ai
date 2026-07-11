import { type NextRequest, NextResponse } from 'next/server';
import { BILLING_DISABLED_MESSAGE } from '@/contexts/billing/application/billing-disabled';

/**
 * POST /api/billing/webhook
 *
 * BFF stub for the enumerated billing webhook route (AC-024).
 * AC-031 / AC-048 / AC-049: Stripe webhook signature verification and
 * `STRIPE_SECRET_KEY` are owned by the Core API. The dashboard never
 * imports the Stripe server SDK and never reads the secret key. This
 * route fails closed: require the legacy stripe-signature header for
 * callers that still hit it, then return 410 Gone with the OSS
 * billing-disabled message.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  // Consume the body so the request is fully read (Stripe-style clients expect it).
  // Signature verification lives on Core - not here.
  await request.text();

  return NextResponse.json({ error: BILLING_DISABLED_MESSAGE }, { status: 410 });
}
