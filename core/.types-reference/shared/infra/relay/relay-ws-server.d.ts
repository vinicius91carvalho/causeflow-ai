import { WebSocketServer } from 'ws';
import type { Server as HttpServer } from 'node:http';
import type { RelayRegistry } from './relay-registry.js';
export declare function createRelayWSServer(server: HttpServer, registry: RelayRegistry, authSecret: string, wsPath: string): WebSocketServer;
