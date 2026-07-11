import { type NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/incidents/[id]/stream
 *
 * Proxies the Core API SSE stream (GET /v1/investigation/:id/stream) to the
 * browser as a streaming Next.js Response. Middleware skips /api/* so this
 * route is not buffered or redirected; withAuth still gates the session.
 *
 * Core mounts investigation progress SSE under `/v1/investigation/:id/stream`
 * (not `/v1/incidents/:id/stream`, which 404s). Keep the dashboard BFF path
 * stable for the browser EventSource while forwarding to the real Core route.
 */
export const GET = withAuth(async (request: NextRequest, ctx, params) => {
  const incidentId = params?.id;
  if (!incidentId) {
    return NextResponse.json({ error: 'Missing incident id' }, { status: 400 });
  }

  const apiUrl = process.env.CORE_API_URL;
  if (!apiUrl) {
    return NextResponse.json({ error: 'API not configured' }, { status: 503 });
  }

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

      sendSSE('connected', { userId: ctx.userId, incidentId });

      try {
        const res = await fetch(
          `${apiUrl}/v1/investigation/${encodeURIComponent(incidentId)}/stream`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: request.signal,
          },
        );

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
              try {
                const parsed = JSON.parse(currentData);
                sendSSE(currentEvent || 'message', parsed);
              } catch {
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
