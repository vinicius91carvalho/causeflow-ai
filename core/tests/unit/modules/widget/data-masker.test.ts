import { describe, it, expect } from 'vitest';
import { DataMasker } from '../../../../src/modules/widget/application/data-masker.js';
import type { DataMaskingConfig } from '../../../../src/modules/widget/domain/data-masking.types.js';

describe('DataMasker', () => {
  const masker = new DataMasker();

  it('should return text unchanged when masking is disabled', () => {
    const config: DataMaskingConfig = { enabled: false, rules: [] };
    const text = 'IP: 192.168.1.1, email: user@example.com';
    expect(masker.mask(text, config)).toBe(text);
  });

  it('should return text unchanged when there are no rules', () => {
    const config: DataMaskingConfig = { enabled: true, rules: [] };
    const text = 'IP: 192.168.1.1';
    expect(masker.mask(text, config)).toBe(text);
  });

  it('should mask IP addresses', () => {
    const config: DataMaskingConfig = {
      enabled: true,
      rules: [{ type: 'ip_address', enabled: true }],
    };
    const text = 'Server at 192.168.1.1 returned error, fallback to 10.0.0.5';
    const result = masker.mask(text, config);
    expect(result).toBe('Server at ***REDACTED*** returned error, fallback to ***REDACTED***');
    expect(result).not.toContain('192.168.1.1');
    expect(result).not.toContain('10.0.0.5');
  });

  it('should mask email addresses', () => {
    const config: DataMaskingConfig = {
      enabled: true,
      rules: [{ type: 'email', enabled: true }],
    };
    const text = 'User john@example.com reported an issue';
    const result = masker.mask(text, config);
    expect(result).toBe('User ***REDACTED*** reported an issue');
  });

  it('should mask AWS ARNs', () => {
    const config: DataMaskingConfig = {
      enabled: true,
      rules: [{ type: 'aws_arn', enabled: true }],
    };
    const text = 'Role arn:aws:iam::123456789012:role/MyRole was used';
    const result = masker.mask(text, config);
    expect(result).toBe('Role ***REDACTED*** was used');
  });

  it('should mask database connection strings', () => {
    const config: DataMaskingConfig = {
      enabled: true,
      rules: [{ type: 'database_connection_string', enabled: true }],
    };
    const text = 'Connected to postgres://admin:secret@db.host:5432/mydb';
    const result = masker.mask(text, config);
    expect(result).toContain('***REDACTED***');
    expect(result).not.toContain('postgres://');
  });

  it('should mask API keys', () => {
    const config: DataMaskingConfig = {
      enabled: true,
      rules: [{ type: 'api_key', enabled: true }],
    };
    const text = 'Using key sk-1234567890abcdefghij for authentication';
    const result = masker.mask(text, config);
    expect(result).toContain('***REDACTED***');
    expect(result).not.toContain('sk-1234567890abcdefghij');
  });

  it('should use custom replacement text', () => {
    const config: DataMaskingConfig = {
      enabled: true,
      rules: [{ type: 'email', enabled: true, replacement: '[HIDDEN]' }],
    };
    const text = 'Contact admin@company.com for details';
    const result = masker.mask(text, config);
    expect(result).toBe('Contact [HIDDEN] for details');
  });

  it('should skip disabled rules', () => {
    const config: DataMaskingConfig = {
      enabled: true,
      rules: [
        { type: 'email', enabled: false },
        { type: 'ip_address', enabled: true },
      ],
    };
    const text = 'user@test.com at 10.0.0.1';
    const result = masker.mask(text, config);
    expect(result).toContain('user@test.com');
    expect(result).not.toContain('10.0.0.1');
  });

  it('should apply custom regex rules', () => {
    const config: DataMaskingConfig = {
      enabled: true,
      rules: [{ type: 'custom_regex', enabled: true, customPattern: 'CPF:\\s*\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}' }],
    };
    const text = 'Cliente com CPF: 123.456.789-00 relatou o problema';
    const result = masker.mask(text, config);
    expect(result).toBe('Cliente com ***REDACTED*** relatou o problema');
  });

  it('should handle invalid custom regex gracefully', () => {
    const config: DataMaskingConfig = {
      enabled: true,
      rules: [{ type: 'custom_regex', enabled: true, customPattern: '[invalid' }],
    };
    const text = 'This should not crash';
    expect(masker.mask(text, config)).toBe(text);
  });

  it('should apply multiple rules in sequence', () => {
    const config: DataMaskingConfig = {
      enabled: true,
      rules: [
        { type: 'ip_address', enabled: true },
        { type: 'email', enabled: true },
      ],
    };
    const text = 'Server 10.0.0.1, contact admin@corp.com';
    const result = masker.mask(text, config);
    expect(result).toBe('Server ***REDACTED***, contact ***REDACTED***');
  });
});
