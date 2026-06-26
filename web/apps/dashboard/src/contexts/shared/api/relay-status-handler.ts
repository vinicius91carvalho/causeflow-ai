import { NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

const DISCONNECTED = { connected: false, resources: [] };

export const GET = withAuth(async (_request, _ctx) => {
  try {
    const status = await getApiClient().getRelayStatus();
    return NextResponse.json(status);
  } catch (err) {
    // Core API may not have the relay endpoint deployed in every environment
    // (staging currently returns 404). Degrade gracefully so the dashboard
    // section renders its "relay not connected" empty state instead of crashing.
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (/not found/i.test(message)) {
      return NextResponse.json(DISCONNECTED);
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
});
