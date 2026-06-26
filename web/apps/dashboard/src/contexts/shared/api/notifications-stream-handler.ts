import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/notifications/stream
 *
 * Proxies the backend SSE stream (GET /v1/notifications/stream) to the frontend.
 * Events include chat.response, notifications, investigation updates, etc.
 */
export const GET = withAuth(async (_request: NextRequest, ctx) => {
  const apiUrl = process.env.CORE_API_URL;
  if (!apiUrl) {
    return NextResponse.json({ error: 'API not configured' }, { status: 503 });
  }

  // Get backend token
  let token: string;
  try {
    const { getBackendToken } = await import('@/lib/api/get-backend-token');
    token = await getBackendToken();
  } catch {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendSSE = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      sendSSE('connected', { userId: ctx.userId });

      try {
        // Connect to backend SSE
        const res = await fetch(`${apiUrl}/v1/notifications/stream`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: _request.signal,
        });

        if (!res.ok || !res.body) {
          sendSSE('error', { message: 'Failed to connect to backend stream' });
          controller.close();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE frames from buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          let currentEvent = '';
          let currentData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              currentData = line.slice(6);
            } else if (line === '' && currentData) {
              // End of SSE frame — forward to client
              try {
                const parsed = JSON.parse(currentData);
                sendSSE(currentEvent || 'message', parsed);
              } catch {
                // Forward raw
                controller.enqueue(
                  encoder.encode(`event: ${currentEvent || 'message'}\ndata: ${currentData}\n\n`),
                );
              }
              currentEvent = '';
              currentData = '';
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          sendSSE('error', { message: 'Stream disconnected' });
        }
      }

      controller.close();
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
