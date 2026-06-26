import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import { createHeartbeat, createResourceUpdate, type RpcRequest, type ResourceUpdateMessage } from './protocol.js';

const logger = pino({ name: 'relay-ws' });

export interface WsClientOptions {
  url: string;
  token: string;
  tenantId: string;
  onMessage: (data: RpcRequest) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export class WsClient {
  private ws: WebSocket | null = null;
  private readonly relayId = uuidv4();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;
  private intentionalClose = false;

  constructor(private readonly opts: WsClientOptions) {}

  get id(): string {
    return this.relayId;
  }

  connect(): void {
    this.intentionalClose = false;
    const url = new URL(this.opts.url);
    url.searchParams.set('token', this.opts.token);
    url.searchParams.set('tenantId', this.opts.tenantId);

    this.ws = new WebSocket(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.opts.token}`,
        'X-Tenant-Id': this.opts.tenantId,
      },
    });

    this.ws.on('open', () => {
      logger.info({ relayId: this.relayId, url: this.opts.url }, 'Connected to control plane');
      this.reconnectDelay = 1000;
      this.startHeartbeat();
      this.opts.onConnect?.();
    });

    this.ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(typeof data === 'string' ? data : data.toString());
        if (parsed.jsonrpc === '2.0' && parsed.method) {
          this.opts.onMessage(parsed as RpcRequest);
        }
      } catch (err) {
        logger.warn({ err }, 'Invalid message from control plane');
      }
    });

    this.ws.on('close', () => {
      logger.info('Disconnected from control plane');
      this.stopHeartbeat();
      this.opts.onDisconnect?.();
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err) => {
      logger.error({ err }, 'WS error');
    });
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  sendResourceUpdate(resources: ResourceUpdateMessage['resources']): void {
    this.send(createResourceUpdate(this.relayId, this.opts.tenantId, resources));
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
      this.send(createHeartbeat(this.relayId, this.opts.tenantId));
    }, 30_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    logger.info({ delayMs: this.reconnectDelay }, 'Scheduling reconnect');
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
  }
}
