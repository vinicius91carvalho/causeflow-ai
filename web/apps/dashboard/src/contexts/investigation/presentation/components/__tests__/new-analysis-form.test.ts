import { describe, expect, it } from 'vitest';

/**
 * Unit tests for new analysis form validation logic.
 */

interface FormErrors {
  prompt?: string;
}

function validatePrompt(prompt: string): string | undefined {
  if (!prompt.trim()) {
    return 'Prompt is required';
  }
  if (prompt.trim().length < 10) {
    return 'Prompt must be at least 10 characters';
  }
  if (prompt.length > 4000) {
    return 'Prompt must be 4000 characters or less';
  }
  return undefined;
}

function validate(prompt: string): FormErrors {
  const errors: FormErrors = {};
  const promptError = validatePrompt(prompt);
  if (promptError) errors.prompt = promptError;
  return errors;
}

function isValid(prompt: string): boolean {
  return Object.keys(validate(prompt)).length === 0;
}

describe('New Analysis Form Validation', () => {
  describe('Prompt validation', () => {
    it('rejects empty prompt', () => {
      const errors = validate('');
      expect(errors.prompt).toBeTruthy();
    });

    it('rejects whitespace-only prompt', () => {
      const errors = validate('   ');
      expect(errors.prompt).toBeTruthy();
    });

    it('rejects prompt shorter than 10 chars', () => {
      const errors = validate('Short');
      expect(errors.prompt).toContain('10 characters');
    });

    it('accepts prompt with exactly 10 chars', () => {
      expect(isValid('1234567890')).toBe(true);
    });

    it('accepts prompt longer than 10 chars', () => {
      expect(isValid('Why did the service go down at midnight?')).toBe(true);
    });

    it('rejects prompt longer than 4000 chars', () => {
      const longPrompt = 'a'.repeat(4001);
      const errors = validate(longPrompt);
      expect(errors.prompt).toContain('4000 characters');
    });

    it('accepts prompt exactly 4000 chars', () => {
      const exactly4000 = 'a'.repeat(4000);
      expect(isValid(exactly4000)).toBe(true);
    });
  });

  describe('Form valid state', () => {
    it('form is valid with proper prompt', () => {
      expect(isValid('Investigate why the DB crashed on Friday night.')).toBe(true);
    });

    it('form is invalid with empty prompt', () => {
      expect(isValid('')).toBe(false);
    });

    it('form is invalid with too-short prompt', () => {
      expect(isValid('too short')).toBe(false);
    });
  });
});

describe('Integration selection', () => {
  type IntegrationType = 'slack' | 'pagerduty' | 'datadog' | 'github' | 'jira' | 'cloudwatch';

  function toggleIntegration(current: IntegrationType[], type: IntegrationType): IntegrationType[] {
    if (current.includes(type)) {
      return current.filter((t) => t !== type);
    }
    return [...current, type];
  }

  it('adds integration when not already selected', () => {
    const result = toggleIntegration([], 'slack');
    expect(result).toContain('slack');
  });

  it('removes integration when already selected', () => {
    const result = toggleIntegration(['slack', 'github'], 'slack');
    expect(result).not.toContain('slack');
    expect(result).toContain('github');
  });

  it('can select multiple integrations', () => {
    let selected: IntegrationType[] = [];
    selected = toggleIntegration(selected, 'slack');
    selected = toggleIntegration(selected, 'github');
    selected = toggleIntegration(selected, 'jira');
    expect(selected).toHaveLength(3);
    expect(selected).toContain('slack');
    expect(selected).toContain('github');
    expect(selected).toContain('jira');
  });

  it('deselecting returns to previous state', () => {
    let selected: IntegrationType[] = ['slack', 'github'];
    selected = toggleIntegration(selected, 'github');
    expect(selected).toEqual(['slack']);
  });
});
