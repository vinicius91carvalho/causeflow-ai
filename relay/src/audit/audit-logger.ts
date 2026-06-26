import pino from 'pino';
import type { AuditConfig } from '../config/schema.js';

export interface AuditEntry {
  timestamp: string;
  relayId: string;
  requestId: string;
  resource: string;
  operation: string;
  result: 'success' | 'denied' | 'error';
  policyChecks?: Record<string, unknown>;
  rowCount?: number;
  maskedFieldCount?: number;
  executionTimeMs?: number;
  errorMessage?: string;
}

export class AuditLogger {
  private logger: pino.Logger;
  private enabled: boolean;

  constructor(config: AuditConfig, relayId: string) {
    this.enabled = config.enabled;
    this.logger = pino({
      name: 'relay-audit',
      level: config.level,
      base: { relayId },
    });
  }

  log(entry: AuditEntry): void {
    if (!this.enabled) return;

    if (entry.result === 'error') {
      this.logger.error(entry, 'Audit: query error');
    } else if (entry.result === 'denied') {
      this.logger.warn(entry, 'Audit: query denied');
    } else {
      this.logger.info(entry, 'Audit: query executed');
    }
  }
}
