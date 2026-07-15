import { describe, expect, it } from 'vitest';
import { InvestigationLlmProfilesCard } from './investigation-llm-profiles-card';

describe('InvestigationLlmProfilesCard (AC-087 presets)', () => {
  it('exports the settings card component', () => {
    expect(InvestigationLlmProfilesCard).toBeDefined();
    expect(typeof InvestigationLlmProfilesCard).toBe('function');
  });

  async function readSource(): Promise<string> {
    const fs = await import('node:fs');
    return fs.readFileSync(
      new URL('./investigation-llm-profiles-card.tsx', import.meta.url),
      'utf-8',
    );
  }

  it('ships Ornith local and API example preset buttons in the create form', async () => {
    const source = await readSource();
    expect(source).toContain('data-testid={`investigation-llm-preset-${preset.id}`}');
    expect(source).toContain('data-preset-base-url');
    expect(source).toContain('data-preset-model');
    expect(source).toContain('INVESTIGATION_LLM_PROFILE_PRESETS');
  });

  it('applyPreset opens create form and copies preset defaults into editable fields', async () => {
    const source = await readSource();
    expect(source).toContain('function applyPreset');
    expect(source).toContain('setShowForm(true)');
    expect(source).toContain('label: preset.label');
    expect(source).toContain('baseUrl: preset.baseUrl');
    expect(source).toContain('model: preset.model');
    expect(source).not.toContain('readOnly');
    expect(source).not.toContain('disabled={true}');
  });

  it('does not render a fixed three-provider enum catalog', async () => {
    const source = await readSource();
    expect(source).not.toMatch(/deepseek-opencode|deepseek-nim/);
    expect(source).not.toContain('LlmConnectorId');
  });
});

describe('InvestigationLlmProfilesCard RBAC (AC-088)', () => {
  async function readSource(): Promise<string> {
    const fs = await import('node:fs');
    return fs.readFileSync(
      new URL('./investigation-llm-profiles-card.tsx', import.meta.url),
      'utf-8',
    );
  }

  it('gates create/edit/delete/activate controls behind MANAGE_SETTINGS permission', async () => {
    const source = await readSource();
    expect(source).toContain('usePermission(PERMISSION.MANAGE_SETTINGS)');
    expect(source).toContain('if (!canManage) return');
    expect(source).toContain('{canManage && (');
    expect(source).toContain('data-testid="investigation-llm-profile-toggle-form"');
    expect(source).toContain('data-testid={`investigation-llm-profile-activate-${profile.id}`}');
    expect(source).toContain('data-testid={`investigation-llm-profile-edit-${profile.id}`}');
    expect(source).toContain('data-testid={`investigation-llm-profile-delete-${profile.id}`}');
  });

  it('shows admin-only helper copy for non-admin viewers', async () => {
    const source = await readSource();
    expect(source).toContain("{!canManage && <p");
    expect(source).toContain("{t('adminOnly')}");
  });
});

describe('InvestigationLlmProfilesCard validation (AC-091)', () => {
  async function readSource(): Promise<string> {
    const fs = await import('node:fs');
    return fs.readFileSync(
      new URL('./investigation-llm-profiles-card.tsx', import.meta.url),
      'utf-8',
    );
  }

  it('surfaces observable inline validation errors for required fields', async () => {
    const source = await readSource();
    expect(source).toContain('data-testid="investigation-llm-profile-validation-error"');
    expect(source).toContain("t('validationRequired')");
    expect(source).toContain('setFormError(message)');
    expect(source).toContain('if (!label || !baseUrl || !model)');
  });

  it('allows optional apiKey to be omitted in create payload', async () => {
    const source = await readSource();
    expect(source).toContain('if (apiKey) payload.apiKey = apiKey');
    expect(source).not.toMatch(/apiKey.*required/i);
  });
});

describe('InvestigationLlmProfilesCard active delete guard (AC-089)', () => {
  async function readSource(): Promise<string> {
    const fs = await import('node:fs');
    return fs.readFileSync(
      new URL('./investigation-llm-profiles-card.tsx', import.meta.url),
      'utf-8',
    );
  }

  it('blocks deleting the active profile in the UI with a clear error', async () => {
    const source = await readSource();
    expect(source).toContain('function isProfileActive');
    expect(source).toContain("t('errorDeleteActive')");
    expect(source).toContain('if (isProfileActive(profile))');
    expect(source).toContain('disabled={deletingId === profile.id || isActive}');
    expect(source).toContain("data-delete-blocked={isActive ? 'active-profile' : undefined}");
    expect(source).toContain("t('deleteActiveHint')");
  });
});
