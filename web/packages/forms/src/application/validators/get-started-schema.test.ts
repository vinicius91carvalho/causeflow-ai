import { describe, expect, it } from 'vitest';
import { getStartedSchema } from './get-started-schema';

describe('getStartedSchema', () => {
  const validData = {
    fullName: 'John Doe',
    workEmail: 'john@company.com',
    companyName: 'Acme',
    teamSize: '6-20' as const,
  };

  it('accepts valid data', () => {
    const result = getStartedSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rejects empty fullName', () => {
    const result = getStartedSchema.safeParse({ ...validData, fullName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = getStartedSchema.safeParse({ ...validData, workEmail: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects empty companyName', () => {
    const result = getStartedSchema.safeParse({ ...validData, companyName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid teamSize', () => {
    const result = getStartedSchema.safeParse({ ...validData, teamSize: '100+' });
    expect(result.success).toBe(false);
  });
});
