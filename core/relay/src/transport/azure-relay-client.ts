import pino from 'pino';
import type { RpcRequest, RpcResponse } from './protocol.js';
import type { ITransport } from './transport.port.js';

const logger = pino({ name: 'azure-relay' });

export interface AzureRelayOptions {
  endpoint: string;
  sasToken: string;
  tenantId: string;
  onMessage: (request: RpcRequest) => void | Promise<void>;
}

/**
 * Adapter for Azure Relay Hybrid Connections.
 *
 * Not yet wired to the Microsoft SDK here — kept as a concrete class that
 * implements ITransport so it can be selected via `transport.kind: azure-relay`
 * in configuration. Install and implement when first customer requires it.
 */
export class AzureRelayClient implements ITransport {
  readonly kind = 'azure-relay';
  private connected = false;

  constructor(private readonly opts: AzureRelayOptions) {}

  connect(): void {
    logger.warn({ tenantId: this.opts.tenantId }, 'Azure Relay transport not yet implemented — use kind=wss');
    throw new Error('Azure Relay transport is not yet wired; use transport.kind=wss or implement @azure/service-bus-relay integration');
  }

  send(_response: RpcResponse): void {
    throw new Error('Azure Relay not connected');
  }

  sendRaw(_data: unknown): void {
    throw new Error('Azure Relay not connected');
  }

  close(): void {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
