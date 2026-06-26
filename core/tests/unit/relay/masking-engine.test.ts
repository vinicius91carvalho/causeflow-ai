/* eslint-disable */
import { describe, it, expect } from 'vitest';
import { MaskingEngine } from '../../../relay/src/masking/masking-engine.js';
import { maskingConfigSchema } from '../../../relay/src/config/schema.js';

function makeEngine(overrides: Record<string, unknown> = {}): MaskingEngine {
  return new MaskingEngine(maskingConfigSchema.parse({ enabled: true, ...overrides }));
}

describe('MaskingEngine', () => {
  const engine = makeEngine();

  describe('CPF masking', () => {
    it('masks valid CPF in strings', () => {
      const { masked, maskedFieldCount } = engine.mask('CPF: 390.533.447-05');
      expect(masked).toBe('CPF: ***.***.***-**');
      expect(maskedFieldCount).toBe(1);
    });

    it('leaves invalid CPF unchanged', () => {
      const { masked, maskedFieldCount } = engine.mask('CPF: 111.111.111-11');
      expect(masked).toBe('CPF: 111.111.111-11');
      expect(maskedFieldCount).toBe(0);
    });
  });

  describe('email masking', () => {
    it('masks email addresses', () => {
      const { masked } = engine.mask('Contact: alice@example.com');
      expect(masked).toBe('Contact: ***@***.***');
    });
  });

  describe('credit card masking', () => {
    it('masks Luhn-valid credit card numbers', () => {
      const { masked } = engine.mask('Card: 4111 1111 1111 1111');
      expect(masked).toBe('Card: ****-****-****-****');
    });

    it('masks Luhn-valid credit card numbers with dashes', () => {
      const { masked } = engine.mask('Card: 4111-1111-1111-1111');
      expect(masked).toBe('Card: ****-****-****-****');
    });
  });

  describe('nested objects', () => {
    it('masks PII in nested objects', () => {
      const data = {
        customer: {
          name: 'Alice',
          email: 'alice@example.com',
          cpf: '390.533.447-05',
        },
        orders: [
          { id: 1, paymentCard: '4111 1111 1111 1111' },
        ],
      };

      const { masked, maskedFieldCount } = engine.mask(data);
      const result = masked as typeof data;
      expect(result.customer.email).toBe('***@***.***');
      expect(result.customer.cpf).toBe('***.***.***-**');
      expect(result.orders[0]!.paymentCard).toBe('****-****-****-****');
      expect(maskedFieldCount).toBe(3);
    });
  });

  describe('non-string values', () => {
    it('passes numbers through unchanged', () => {
      const { masked } = engine.mask(42);
      expect(masked).toBe(42);
    });

    it('passes null through unchanged', () => {
      const { masked } = engine.mask(null);
      expect(masked).toBeNull();
    });

    it('passes booleans through unchanged', () => {
      const { masked } = engine.mask(true);
      expect(masked).toBe(true);
    });
  });

  describe('disabled masking', () => {
    it('returns data unchanged when disabled', () => {
      const disabledEngine = new MaskingEngine(maskingConfigSchema.parse({ enabled: false }));
      const { masked, maskedFieldCount } = disabledEngine.mask('CPF: 390.533.447-05');
      expect(masked).toBe('CPF: 390.533.447-05');
      expect(maskedFieldCount).toBe(0);
    });
  });

  describe('custom patterns', () => {
    it('applies custom regex patterns', () => {
      const customEngine = new MaskingEngine(
        maskingConfigSchema.parse({
          enabled: true,
          patterns: [
            { name: 'ssn', regex: '\\d{3}-\\d{2}-\\d{4}', replacement: '***-**-****' },
          ],
        }),
      );
      const { masked } = customEngine.mask('SSN: 123-45-6789');
      expect(masked).toContain('***-**-****');
    });
  });

  describe('array masking', () => {
    it('masks PII in arrays', () => {
      const data = ['alice@example.com', 'bob@test.com', 'no-pii'];
      const { masked, maskedFieldCount } = engine.mask(data);
      const result = masked as string[];
      expect(result[0]).toBe('***@***.***');
      expect(result[1]).toBe('***@***.***');
      expect(result[2]).toBe('no-pii');
      expect(maskedFieldCount).toBe(2);
    });
  });
});
