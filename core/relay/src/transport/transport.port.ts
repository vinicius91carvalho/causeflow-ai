import type { RpcRequest, RpcResponse } from './protocol.js';

export interface TransportEvents {
  onMessage: (request: RpcRequest) => void | Promise<void>;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export interface ITransport {
  readonly kind: string;
  connect(): void;
  send(response: RpcResponse): void;
  sendRaw(data: unknown): void;
  close(): void;
  isConnected(): boolean;
}
