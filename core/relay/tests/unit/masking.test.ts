import { describe, it, expect } from 'vitest';
import { MaskingEngine } from '../../src/masking/masking-engine.js';
import { maskingConfigSchema } from '../../src/config/schema.js';

function engine(overrides: Record<string, unknown> = {}) {
  return new MaskingEngine(maskingConfigSchema.parse({ enabled: true, ...overrides }));
}

describe('MaskingEngine v2', () => {
  describe('CPF', () => {
    it('masks valid CPF', () => {
      const { masked } = engine().mask('CPF: 390.533.447-05');
      expect(masked).toBe('CPF: ***.***.***-**');
    });

    it('leaves invalid CPF unchanged (checksum)', () => {
      const { masked } = engine().mask('CPF: 111.111.111-11');
      expect(masked).toBe('CPF: 111.111.111-11');
    });
  });

  describe('CNPJ', () => {
    it('masks valid CNPJ', () => {
      const { masked } = engine().mask('CNPJ 11.222.333/0001-81');
      expect(masked).toBe('CNPJ **.***.***/****-**');
    });
  });

  describe('credit card', () => {
    it('masks Luhn-valid credit card', () => {
      const { masked } = engine().mask('Card 4111 1111 1111 1111');
      expect(masked).toBe('Card ****-****-****-****');
    });

    it('leaves invalid CC unchanged', () => {
      const { masked } = engine().mask('Card 1234 5678 1234 5678');
      expect(masked).toBe('Card 1234 5678 1234 5678');
    });
  });

  describe('email', () => {
    it('masks emails', () => {
      const { masked } = engine().mask('Contact alice@example.com today');
      expect(masked).toBe('Contact ***@***.*** today');
    });
  });

  describe('AWS keys', () => {
    it('masks AKIA access keys', () => {
      const { masked } = engine().mask('Access key: AKIAIOSFODNN7EXAMPLE');
      expect((masked as string).includes('AKIA****')).toBe(true);
    });
  });

  describe('JWT', () => {
    it('masks JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const { masked } = engine().mask(`token=${jwt}`);
      expect((masked as string).includes('eyJ***.***.***')).toBe(true);
    });
  });

  describe('nested objects', () => {
    it('masks recursively', () => {
      const { masked, maskedFieldCount } = engine().mask({
        user: { email: 'bob@example.com', cpf: '390.533.447-05' },
        notes: ['email me at carol@example.com'],
      });
      const asRecord = masked as { user: { email: string; cpf: string }; notes: string[] };
      expect(asRecord.user.email).toBe('***@***.***');
      expect(asRecord.user.cpf).toBe('***.***.***-**');
      expect(asRecord.notes[0]).toContain('***@***.***');
      expect(maskedFieldCount).toBeGreaterThan(0);
    });
  });

  describe('column rules', () => {
    it('drops configured columns', () => {
      const e = engine();
      const data = { users: { ssn: '123-45-6789', name: 'Bob' } };
      const { masked } = e.mask(data, {
        columnRules: [{ table: 'users', column: 'ssn', action: 'drop' }],
      });
      expect((masked as { users: { ssn: string } }).users.ssn).toBe('');
    });

    it('passes-through pass-marked columns', () => {
      const e = engine();
      const { masked } = e.mask({ table: { email: 'x@y.com' } }, {
        columnRules: [{ table: 'table', column: 'email', action: 'pass' }],
      });
      expect((masked as { table: { email: string } }).table.email).toBe('x@y.com');
    });
  });

  describe('disabled', () => {
    it('returns unchanged when disabled', () => {
      const e = new MaskingEngine(maskingConfigSchema.parse({ enabled: false }));
      const { masked } = e.mask('alice@example.com');
      expect(masked).toBe('alice@example.com');
    });
  });
});
