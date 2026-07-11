import { type NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/billing/webhook
 * BFF stub for the enumerated billing webhook route (AC-024).
 *
 * AC-031 / AC-048: Stripe webhook signature verification and
 * `STRIPE_SECRET_KEY` are owned by the Core API. The dashboard never
 * imports the Stripe server SDK and never reads the secret key. Any
 * direct hit on this route fails closed.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  // Consume the body so the request is fully read, then reject.
  // Signature verification lives on Core - not here.
  await request.text();
  return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
}
