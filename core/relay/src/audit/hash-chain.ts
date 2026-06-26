import { createHash, createHmac } from 'node:crypto';

export interface AuditChainState {
  prevHash: string;
  sequence: number;
}

export interface ChainedEntry<T> {
  sequence: number;
  prevHash: string;
  entryHash: string;
  signature?: string;
  payload: T;
}

export class AuditHashChain {
  private state: AuditChainState;

  constructor(
    initial: AuditChainState = { prevHash: '0'.repeat(64), sequence: 0 },
    private readonly hmacKey?: string,
  ) {
    this.state = { ...initial };
  }

  append<T>(payload: T): ChainedEntry<T> {
    const sequence = this.state.sequence + 1;
    const canonical = JSON.stringify({
      sequence,
      prevHash: this.state.prevHash,
      payload,
    });
    const entryHash = createHash('sha256').update(canonical).digest('hex');
    const signature = this.hmacKey
      ? createHmac('sha256', this.hmacKey).update(entryHash).digest('hex')
      : undefined;

    const entry: ChainedEntry<T> = {
      sequence,
      prevHash: this.state.prevHash,
      entryHash,
      signature,
      payload,
    };
    this.state = { prevHash: entryHash, sequence };
    return entry;
  }

  snapshot(): AuditChainState {
    return { ...this.state };
  }

  static verify<T>(entries: ChainedEntry<T>[], hmacKey?: string): { valid: boolean; firstBadIndex?: number } {
    let expectedPrev = '0'.repeat(64);
    let expectedSeq = 1;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]!;
      if (e.prevHash !== expectedPrev) return { valid: false, firstBadIndex: i };
      if (e.sequence !== expectedSeq) return { valid: false, firstBadIndex: i };
      const canonical = JSON.stringify({ sequence: e.sequence, prevHash: e.prevHash, payload: e.payload });
      const computed = createHash('sha256').update(canonical).digest('hex');
      if (computed !== e.entryHash) return { valid: false, firstBadIndex: i };
      if (hmacKey) {
        const expectedSig = createHmac('sha256', hmacKey).update(e.entryHash).digest('hex');
        if (expectedSig !== e.signature) return { valid: false, firstBadIndex: i };
      }
      expectedPrev = e.entryHash;
      expectedSeq++;
    }
    return { valid: true };
  }
}
