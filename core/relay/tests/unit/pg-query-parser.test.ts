import { describe, it, expect } from 'vitest';
import { validateQuery } from '../../src/drivers/postgres/pg-query-parser.js';

describe('validateQuery (AST-based)', () => {
  it('allows simple SELECT', () => {
    expect(validateQuery('SELECT id FROM users').valid).toBe(true);
  });

  it('allows WITH (CTE)', () => {
    expect(validateQuery("WITH t AS (SELECT 1) SELECT * FROM t").valid).toBe(true);
  });

  it('rejects INSERT', () => {
    const r = validateQuery('INSERT INTO users VALUES (1)');
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/INSERT|SELECT/i);
  });

  it('rejects UPDATE', () => {
    expect(validateQuery('UPDATE users SET x = 1').valid).toBe(false);
  });

  it('rejects DELETE', () => {
    expect(validateQuery('DELETE FROM users').valid).toBe(false);
  });

  it('rejects DROP', () => {
    expect(validateQuery('DROP TABLE users').valid).toBe(false);
  });

  it('rejects TRUNCATE', () => {
    expect(validateQuery('TRUNCATE users').valid).toBe(false);
  });

  it('rejects multi-statement queries', () => {
    const r = validateQuery('SELECT 1; DELETE FROM users');
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/multi-statement|SELECT/i);
  });

  it('allows ; inside string literal (AST handles it)', () => {
    const r = validateQuery("SELECT ';' FROM dual");
    expect(r.valid).toBe(true);
  });

  it('rejects pg_sleep as function call', () => {
    const r = validateQuery('SELECT pg_sleep(10)');
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/pg_sleep/);
  });

  it('does NOT reject pg_sleep-suffixed column name', () => {
    const r = validateQuery('SELECT pg_sleep_audit FROM events');
    expect(r.valid).toBe(true);
  });

  it('rejects dblink', () => {
    expect(validateQuery("SELECT * FROM dblink('x', 'y')").valid).toBe(false);
  });

  it('rejects pg_read_file function call', () => {
    expect(validateQuery("SELECT pg_read_file('/etc/passwd')").valid).toBe(false);
  });

  it('trims trailing semicolon', () => {
    expect(validateQuery('SELECT 1;').valid).toBe(true);
  });

  it('rejects empty query', () => {
    expect(validateQuery('').valid).toBe(false);
  });
});
