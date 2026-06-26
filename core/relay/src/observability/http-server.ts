import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import pino from 'pino';
import type { MetricsRegistry } from './metrics.js';

const logger = pino({ name: 'relay-http' });

export interface HttpServerOptions {
  port: number;
  metrics: MetricsRegistry | null;
  isReady: () => boolean;
  breakGlass?: {
    path: string;
    sharedSecret: string;
    onTrip: (reason: string) => void;
  };
}

export function startHttpServer(opts: HttpServerOptions): Server {
  const server = createServer((req, res) => {
    void handle(req, res, opts).catch((err) => {
      logger.error({ err }, 'HTTP handler error');
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.end('internal error');
      }
    });
  });
  server.listen(opts.port, () => {
    logger.info({ port: opts.port }, 'Relay HTTP endpoint listening');
  });
  return server;
}

async function handle(req: IncomingMessage, res: ServerResponse, opts: HttpServerOptions): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (url.pathname === '/healthz') {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (url.pathname === '/readyz') {
    const ready = opts.isReady();
    res.statusCode = ready ? 200 : 503;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ready }));
    return;
  }

  if (url.pathname === '/metrics' && opts.metrics) {
    res.statusCode = 200;
    res.setHeader('content-type', await opts.metrics.contentType());
    res.end(await opts.metrics.metrics());
    return;
  }

  if (opts.breakGlass && url.pathname === opts.breakGlass.path && req.method === 'POST') {
    const provided = req.headers['x-break-glass-secret'];
    if (typeof provided !== 'string' || provided !== opts.breakGlass.sharedSecret) {
      res.statusCode = 401;
      res.end('unauthorized');
      return;
    }
    const body = await readBody(req);
    let reason = 'unspecified';
    try {
      reason = (JSON.parse(body) as { reason?: string }).reason ?? reason;
    } catch { /* ignore */ }
    opts.breakGlass.onTrip(reason);
    res.statusCode = 202;
    res.end(JSON.stringify({ status: 'tripped', reason }));
    return;
  }

  res.statusCode = 404;
  res.end('not found');
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}
