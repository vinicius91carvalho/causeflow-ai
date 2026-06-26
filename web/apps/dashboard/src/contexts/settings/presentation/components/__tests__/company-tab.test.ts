import { describe, expect, it } from 'vitest';

// Unit tests for company tab validation logic

function validateCompanyForm(name: string, website: string): { name?: string; website?: string } {
  const errors: { name?: string; website?: string } = {};
  if (!name.trim()) {
    errors.name = 'Company name is required';
  }
  if (website.trim() && !/^https?:\/\/.+/.test(website.trim())) {
    errors.website = 'Please enter a valid URL';
  }
  return errors;
}

describe('Company Tab - validation', () => {
  it('returns name error for empty company name', () => {
    const errors = validateCompanyForm('', '');
    expect(errors.name).toBeDefined();
    expect(errors.website).toBeUndefined();
  });

  it('returns website error for invalid URL', () => {
    const errors = validateCompanyForm('Acme Corp', 'not-a-url');
    expect(errors.name).toBeUndefined();
    expect(errors.website).toBeDefined();
  });

  it('returns no errors for valid inputs', () => {
    const errors = validateCompanyForm('Acme Corp', 'https://acme.com');
    expect(errors.name).toBeUndefined();
    expect(errors.website).toBeUndefined();
  });

  it('allows empty website (optional field)', () => {
    const errors = validateCompanyForm('Acme Corp', '');
    expect(errors.name).toBeUndefined();
    expect(errors.website).toBeUndefined();
  });

  it('accepts http:// URLs', () => {
    const errors = validateCompanyForm('Acme Corp', 'http://acme.com');
    expect(errors.website).toBeUndefined();
  });

  it('rejects https-less URL like ftp://', () => {
    const errors = validateCompanyForm('Acme Corp', 'ftp://acme.com');
    expect(errors.website).toBeDefined();
  });

  it('returns both errors when both fields are invalid', () => {
    const errors = validateCompanyForm('', 'bad-url');
    expect(errors.name).toBeDefined();
    expect(errors.website).toBeDefined();
  });
});
