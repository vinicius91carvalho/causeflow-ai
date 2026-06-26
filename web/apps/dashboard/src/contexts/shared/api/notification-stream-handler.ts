import { NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withAuth(async (_request, _ctx) => {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const sendEvent = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Send initial notifications
      try {
        const notifications = await getApiClient().listNotifications({ limit: 10 });
        sendEvent({ type: 'initial', notifications: notifications.items ?? notifications });
      } catch {
        sendEvent({ type: 'error', message: 'Failed to load notifications' });
      }

      // Keep alive with heartbeat
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Close after 5 minutes (client should reconnect)
      setTimeout(() => {
        clearInterval(heartbeat);
        controller.close();
      }, 300000);
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
});
