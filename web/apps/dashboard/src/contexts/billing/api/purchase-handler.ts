import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

export const POST = withAuth(
  async (request: NextRequest) => {
    let body: { packType: string; quantity: number };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { packType, quantity } = body;

    if (packType !== 'investigations' && packType !== 'events') {
      return NextResponse.json(
        { error: 'Invalid packType. Must be "investigations" or "events".' },
        { status: 400 },
      );
    }

    if (typeof quantity !== 'number' || quantity <= 0) {
      return NextResponse.json(
        { error: 'Invalid quantity. Must be a positive number.' },
        { status: 400 },
      );
    }

    try {
      const result = await getApiClient().purchaseQuotaPack({ packType, quantity });
      return NextResponse.json(result);
    } catch (err) {
      console.error('Failed to purchase quota pack:', err);
      return NextResponse.json({ error: 'Failed to purchase quota pack' }, { status: 500 });
    }
  },
  { adminOnly: true },
);
