import { describe, it, expect } from 'vitest';
import { AuditHashChain } from '../../src/audit/hash-chain.js';

describe('AuditHashChain', () => {
  it('links entries into a chain', () => {
    const chain = new AuditHashChain();
    const a = chain.append({ event: 'a' });
    const b = chain.append({ event: 'b' });
    const c = chain.append({ event: 'c' });

    expect(a.sequence).toBe(1);
    expect(b.sequence).toBe(2);
    expect(c.sequence).toBe(3);
    expect(b.prevHash).toBe(a.entryHash);
    expect(c.prevHash).toBe(b.entryHash);
  });

  it('verifies a valid chain', () => {
    const chain = new AuditHashChain();
    const entries = [chain.append({ x: 1 }), chain.append({ x: 2 }), chain.append({ x: 3 })];
    const result = AuditHashChain.verify(entries);
    expect(result.valid).toBe(true);
  });

  it('detects tampering', () => {
    const chain = new AuditHashChain();
    const entries = [chain.append({ x: 1 }), chain.append({ x: 2 })];
    (entries[0]!.payload as { x: number }).x = 999;
    const result = AuditHashChain.verify(entries);
    expect(result.valid).toBe(false);
    expect(result.firstBadIndex).toBe(0);
  });

  it('signs entries with HMAC when key given', () => {
    const chain = new AuditHashChain(undefined, 'secret');
    const e = chain.append({ x: 1 });
    expect(e.signature).toMatch(/^[0-9a-f]{64}$/);
    const valid = AuditHashChain.verify([e], 'secret');
    expect(valid.valid).toBe(true);
  });

  it('rejects bad HMAC', () => {
    const chain = new AuditHashChain(undefined, 'secret');
    const e = chain.append({ x: 1 });
    const result = AuditHashChain.verify([e], 'different-secret');
    expect(result.valid).toBe(false);
  });
});
