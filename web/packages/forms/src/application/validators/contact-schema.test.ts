import { describe, expect, it } from 'vitest';
import { contactSchema } from './contact-schema';

describe('contactSchema', () => {
  const validData = {
    name: 'Jane',
    email: 'jane@test.com',
    message: 'Hello, I need help with...',
  };

  it('accepts valid data', () => {
    const result = contactSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('rejects message shorter than 10 chars', () => {
    const result = contactSchema.safeParse({ ...validData, message: 'Hi' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = contactSchema.safeParse({ ...validData, email: 'bad' });
    expect(result.success).toBe(false);
  });

  it('rejects name shorter than 2 chars', () => {
    const result = contactSchema.safeParse({ ...validData, name: 'J' });
    expect(result.success).toBe(false);
  });
});
