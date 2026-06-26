import { describe, it, expect } from 'vitest';
import { MongoDriver } from '../../src/drivers/mongodb/mongo-driver.js';

function driver(): MongoDriver {
  return new MongoDriver({ uri: 'mongodb://localhost', database: 'test' });
}

describe('MongoDriver.validate', () => {
  it('rejects $where operator', () => {
    const r = driver().validate({
      operation: 'query',
      params: { collection: 'users', filter: { $where: 'this.a>1' } },
    });
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/\$where/);
  });

  it('rejects $function operator', () => {
    const r = driver().validate({
      operation: 'query',
      params: { collection: 'users', filter: { $function: {} } },
    });
    expect(r.valid).toBe(false);
  });

  it('rejects $accumulator', () => {
    const r = driver().validate({
      operation: 'query',
      params: { collection: 'users', pipeline: [{ $group: { $accumulator: {} } }] },
    });
    expect(r.valid).toBe(false);
  });

  it('allows safe pipeline', () => {
    const r = driver().validate({
      operation: 'query',
      params: {
        collection: 'orders',
        pipeline: [{ $match: { status: 'failed' } }, { $sort: { createdAt: -1 } }, { $limit: 10 }],
      },
    });
    expect(r.valid).toBe(true);
  });

  it('rejects $out stage', () => {
    const r = driver().validate({
      operation: 'query',
      params: { collection: 'orders', pipeline: [{ $out: 'backup' }] },
    });
    expect(r.valid).toBe(false);
  });

  it('rejects invalid collection names', () => {
    const r = driver().validate({
      operation: 'query',
      params: { collection: 'users; drop table' },
    });
    expect(r.valid).toBe(false);
  });
});
