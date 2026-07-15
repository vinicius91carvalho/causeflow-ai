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
