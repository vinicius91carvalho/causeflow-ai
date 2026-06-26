import type { MaskingConfig } from '../config/schema.js';

interface MaskingPattern {
  name: string;
  regex: RegExp;
  replacement: string;
}

const DEFAULT_PATTERNS: MaskingPattern[] = [
  { name: 'cpf', regex: /\d{3}\.\d{3}\.\d{3}-\d{2}/g, replacement: '***.***.***-**' },
  { name: 'email', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '***@***.***' },
  { name: 'credit_card', regex: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g, replacement: '****-****-****-****' },
  { name: 'bearer_token', regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, replacement: 'Bearer ***' },
  { name: 'phone_br', regex: /(?:\+55\s?)?(?:\(\d{2}\)\s?)?\d{4,5}-?\d{4}/g, replacement: '(**) *****-****' },
];

export interface MaskResult {
  masked: unknown;
  maskedFieldCount: number;
}

export class MaskingEngine {
  private patterns: MaskingPattern[];
  private enabled: boolean;

  constructor(config: MaskingConfig) {
    this.enabled = config.enabled;
    this.patterns = [
      ...DEFAULT_PATTERNS,
      ...config.patterns.map((p) => ({
        name: p.name,
        regex: new RegExp(p.regex, 'g'),
        replacement: p.replacement,
      })),
    ];
  }

  mask(data: unknown): MaskResult {
    if (!this.enabled) {
      return { masked: data, maskedFieldCount: 0 };
    }

    let maskedFieldCount = 0;

    const maskValue = (value: unknown): unknown => {
      if (typeof value === 'string') {
        let masked = value;
        let wasMasked = false;
        for (const pattern of this.patterns) {
          const newValue = masked.replace(pattern.regex, pattern.replacement);
          if (newValue !== masked) {
            wasMasked = true;
          }
          masked = newValue;
          // Reset regex lastIndex for global patterns
          pattern.regex.lastIndex = 0;
        }
        if (wasMasked) maskedFieldCount++;
        return masked;
      }

      if (Array.isArray(value)) {
        return value.map(maskValue);
      }

      if (value !== null && typeof value === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
          result[key] = maskValue(val);
        }
        return result;
      }

      return value;
    };

    return { masked: maskValue(data), maskedFieldCount };
  }
}
