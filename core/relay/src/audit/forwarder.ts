import { appendFile, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import pino from 'pino';
import type { ChainedEntry } from './hash-chain.js';

const logger = pino({ name: 'audit-forwarder' });

export interface ForwarderOptions {
  bufferPath: string;
  batchSize: number;
  flushIntervalMs: number;
  send: (batch: ChainedEntry<unknown>[]) => Promise<void>;
}

export class AuditForwarder {
  private buffer: ChainedEntry<unknown>[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  constructor(private readonly opts: ForwarderOptions) {}

  async start(): Promise<void> {
    await this.ensureBufferDir();
    await this.loadPersisted();
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.opts.flushIntervalMs);
  }

  async enqueue(entry: ChainedEntry<unknown>): Promise<void> {
    this.buffer.push(entry);
    await appendFile(this.opts.bufferPath, `${JSON.stringify(entry)}\n`).catch((err) => {
      logger.warn({ err }, 'Failed to persist audit entry');
    });
    if (this.buffer.length >= this.opts.batchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    this.flushing = true;
    const batch = this.buffer.splice(0, this.opts.batchSize);
    try {
      await this.opts.send(batch);
      await this.rewritePersisted();
    } catch (err) {
      logger.warn({ err, size: batch.length }, 'Audit forward failed — re-queueing');
      this.buffer = batch.concat(this.buffer);
    } finally {
      this.flushing = false;
    }
  }

  async stop(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = null;
    await this.flush();
  }

  private async ensureBufferDir(): Promise<void> {
    const dir = dirname(this.opts.bufferPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
  }

  private async loadPersisted(): Promise<void> {
    try {
      const raw = await readFile(this.opts.bufferPath, 'utf-8');
      const lines = raw.split('\n').filter((l) => l.trim().length > 0);
      for (const line of lines) {
        try {
          this.buffer.push(JSON.parse(line) as ChainedEntry<unknown>);
        } catch {
          /* skip malformed */
        }
      }
      logger.info({ loaded: this.buffer.length }, 'Loaded persisted audit buffer');
    } catch {
      /* buffer did not exist yet */
    }
  }

  private async rewritePersisted(): Promise<void> {
    const serialized = this.buffer.map((e) => JSON.stringify(e)).join('\n');
    await writeFile(this.opts.bufferPath, serialized ? `${serialized}\n` : '');
  }
}
