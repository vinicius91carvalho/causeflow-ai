import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import { createHash } from 'node:crypto';
import type { TlsOptions } from 'node:tls';
import { createHeartbeat, createResourceUpdate, type RpcRequest, type ResourceUpdateMessage, type RpcResponse } from './protocol.js';
import { ReplayCache } from './replay-cache.js';
import type { ITransport } from './transport.port.js';

const logger = pino({ name: 'relay-ws' });

export interface WsClientTls {
  cert?: Buffer | string;
  key?: Buffer | string;
  ca?: Buffer | string;
  pinnedSha256?: string;
}

export interface WsClientOptions {
  url: string;
  token: string;
  tenantId: string;
  onMessage: (request: RpcRequest) => void | Promise<void>;
  onConnect?: () => void;
  onDisconnect?: () => void;
  tls?: WsClientTls;
  reconnect?: {
    initialDelayMs?: number;
    maxDelayMs?: number;
    jitterRatio?: number;
  };
  replay?: {
    enabled: boolean;
    ttlMs: number;
    maxEntries: number;
  };
  heartbeatIntervalMs?: number;
  maxRequestAgeMs?: number;
}

export class WsClient implements ITransport {
  readonly kind = 'wss';
  private ws: WebSocket | null = null;
  private readonly relayId = uuidv4();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay: number;
  private readonly maxReconnectDelay: number;
  private readonly jitterRatio: number;
  private readonly heartbeatIntervalMs: number;
  private readonly maxRequestAgeMs: number;
  private intentionalClose = false;
  private replayCache: ReplayCache | null;

  constructor(private readonly opts: WsClientOptions) {
    this.reconnectDelay = opts.reconnect?.initialDelayMs ?? 1_000;
    this.maxReconnectDelay = opts.reconnect?.maxDelayMs ?? 30_000;
    this.jitterRatio = opts.reconnect?.jitterRatio ?? 0.2;
    this.heartbeatIntervalMs = opts.heartbeatIntervalMs ?? 30_000;
    this.maxRequestAgeMs = opts.maxRequestAgeMs ?? 5 * 60_000;
    this.replayCache = opts.replay?.enabled
      ? new ReplayCache({
        ttlMs: opts.replay.ttlMs,
        maxEntries: opts.replay.maxEntries,
      })
      : null;
  }

  get id(): string {
    return this.relayId;
  }

  connect(): void {
    this.intentionalClose = false;
    const url = new URL(this.opts.url);

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.opts.token}`,
      'X-Tenant-Id': this.opts.tenantId,
      'X-Relay-Id': this.relayId,
      'User-Agent': 'causeflow-relay/2.0',
    };

    const tlsOptions: TlsOptions = {};
    if (this.opts.tls?.cert) tlsOptions.cert = this.opts.tls.cert;
    if (this.opts.tls?.key) tlsOptions.key = this.opts.tls.key;
    if (this.opts.tls?.ca) tlsOptions.ca = this.opts.tls.ca;

    this.ws = new WebSocket(url.toString(), {
      headers,
      ...tlsOptions,
    });

    if (this.opts.tls?.pinnedSha256) {
      this.ws.on('upgrade', (res) => {
        const socket = (res as { socket?: { getPeerCertificate?: (detailed: boolean) => { raw?: Buffer } } }).socket;
        const cert = socket?.getPeerCertificate?.(false);
        if (!cert?.raw) {
          logger.error('Cannot read peer certificate for pinning');
          this.ws?.close();
          return;
        }
        const actual = createHash('sha256').update(cert.raw).digest('hex');
        const expected = this.opts.tls!.pinnedSha256!.toLowerCase().replace(/[^0-9a-f]/g, '');
        if (actual !== expected) {
          logger.error({ actual, expected }, 'Certificate pin mismatch — aborting');
          this.ws?.close();
        }
      });
    }

    this.ws.on('open', () => {
      logger.info({ relayId: this.relayId, url: this.opts.url }, 'Connected to control plane');
      this.reconnectDelay = this.opts.reconnect?.initialDelayMs ?? 1_000;
      this.startHeartbeat();
      this.opts.onConnect?.();
    });

    this.ws.on('message', (data) => {
      void this.handleMessage(data);
    });

    this.ws.on('close', () => {
      logger.info('Disconnected from control plane');
      this.stopHeartbeat();
      this.opts.onDisconnect?.();
      if (!this.intentionalClose) this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      logger.error({ err }, 'WS error');
    });
  }

  private async handleMessage(data: WebSocket.RawData): Promise<void> {
    try {
      const raw = typeof data === 'string' ? data : data.toString();
      const parsed: unknown = JSON.parse(raw);
      if (!isRpcRequest(parsed)) {
        logger.warn('Dropping non-RPC message');
        return;
      }

      if (parsed.issuedAt && Date.now() - parsed.issuedAt > this.maxRequestAgeMs) {
        logger.warn({ id: parsed.id, ageMs: Date.now() - parsed.issuedAt }, 'Request expired');
        return;
      }

      if (this.replayCache) {
        const nonceKey = parsed.nonce ?? parsed.id;
        if (this.replayCache.check(nonceKey).seen) {
          logger.warn({ id: parsed.id, nonce: parsed.nonce }, 'Replay detected — dropping');
          return;
        }
      }

      await this.opts.onMessage(parsed);
    } catch (err) {
      logger.warn({ err }, 'Invalid message from control plane');
    }
  }

  send(response: RpcResponse): void {
    this.sendRaw(response);
  }

  sendRaw(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  sendResourceUpdate(resources: ResourceUpdateMessage['resources']): void {
    this.sendRaw(createResourceUpdate(this.relayId, this.opts.tenantId, resources));
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  close(): void {
    this.intentionalClose = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.sendRaw(createHeartbeat(this.relayId, this.opts.tenantId));
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    const jitter = this.reconnectDelay * this.jitterRatio * Math.random();
    const delay = Math.floor(this.reconnectDelay + jitter);
    logger.info({ delayMs: delay }, 'Scheduling reconnect');
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }
}

function isRpcRequest(value: unknown): value is RpcRequest {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return v['jsonrpc'] === '2.0' && typeof v['id'] === 'string' && typeof v['method'] === 'string';
}
