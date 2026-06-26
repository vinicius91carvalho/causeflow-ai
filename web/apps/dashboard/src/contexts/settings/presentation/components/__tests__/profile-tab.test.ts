import { describe, expect, it } from 'vitest';

// Unit tests for profile tab validation logic

function validateName(name: string): string | undefined {
  if (!name.trim()) return 'Name is required';
  if (name.trim().length < 2) return 'Name must be at least 2 characters';
  return undefined;
}

describe('Profile Tab - name validation', () => {
  it('returns error for empty name', () => {
    expect(validateName('')).toBe('Name is required');
    expect(validateName('   ')).toBe('Name is required');
  });

  it('returns error for name shorter than 2 chars', () => {
    expect(validateName('A')).toBe('Name must be at least 2 characters');
    expect(validateName(' A ')).toBe('Name must be at least 2 characters');
  });

  it('returns undefined for valid name', () => {
    expect(validateName('Alice')).toBeUndefined();
    expect(validateName('Jo')).toBeUndefined();
    expect(validateName('John Doe')).toBeUndefined();
  });

  it('trims before length check', () => {
    expect(validateName(' A ')).toBeDefined(); // " A " trimmed is "A" (length 1)
    expect(validateName(' AB ')).toBeUndefined(); // " AB " trimmed is "AB" (length 2)
  });
});

describe('Profile Tab - form state', () => {
  it('tracks saving state correctly', () => {
    let isSaving = false;
    const startSave = () => {
      isSaving = true;
    };
    const endSave = () => {
      isSaving = false;
    };

    expect(isSaving).toBe(false);
    startSave();
    expect(isSaving).toBe(true);
    endSave();
    expect(isSaving).toBe(false);
  });

  it('only saves when validation passes', () => {
    const errors: Record<string, string | undefined> = {};
    let savedCount = 0;

    function validate(name: string): boolean {
      const err = validateName(name);
      errors.name = err;
      return !err;
    }

    function save(name: string) {
      if (!validate(name)) return;
      savedCount++;
    }

    save(''); // should not save
    expect(savedCount).toBe(0);
    expect(errors.name).toBeDefined();

    save('Alice'); // should save
    expect(savedCount).toBe(1);
    expect(errors.name).toBeUndefined();
  });
});
