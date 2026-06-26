import pino from 'pino';
import type { AuditConfig } from '../config/schema.js';
import { AuditHashChain, type ChainedEntry } from './hash-chain.js';
import type { AuditForwarder } from './forwarder.js';

export interface AuditEntry {
  timestamp: string;
  relayId: string;
  tenantId: string;
  requestId: string;
  incidentId?: string;
  resource: string;
  operation: string;
  result: 'success' | 'denied' | 'error' | 'approval_required';
  policyChecks?: Record<string, unknown>;
  rowCount?: number;
  maskedFieldCount?: number;
  maskedDetectors?: { detector: string; count: number }[];
  executionTimeMs?: number;
  errorMessage?: string;
  principal?: string;
}

export class AuditLogger {
  private logger: pino.Logger;
  private enabled: boolean;
  private chain: AuditHashChain | null;
  private forwarder: AuditForwarder | null;

  constructor(
    config: AuditConfig,
    relayId: string,
    hmacKey: string | undefined,
    forwarder: AuditForwarder | null,
  ) {
    this.enabled = config.enabled;
    this.logger = pino({
      name: 'relay-audit',
      level: config.level,
      base: { relayId },
    });
    this.chain = config.hashChain.enabled
      ? new AuditHashChain(undefined, hmacKey)
      : null;
    this.forwarder = forwarder;
  }

  async log(entry: AuditEntry): Promise<ChainedEntry<AuditEntry> | null> {
    if (!this.enabled) return null;

    let chained: ChainedEntry<AuditEntry> | null = null;
    if (this.chain) {
      chained = this.chain.append(entry);
    }

    const record = chained ?? entry;
    if (entry.result === 'error') this.logger.error(record, 'audit.query_error');
    else if (entry.result === 'denied') this.logger.warn(record, 'audit.query_denied');
    else if (entry.result === 'approval_required') this.logger.warn(record, 'audit.approval_required');
    else this.logger.info(record, 'audit.query_executed');

    if (chained && this.forwarder) {
      await this.forwarder.enqueue(chained).catch(() => { /* logged upstream */ });
    }

    return chained;
  }

  async stop(): Promise<void> {
    await this.forwarder?.stop();
  }
}
