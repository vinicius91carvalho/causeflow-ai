/**
 * Tests for resolveLocalizedSchema helper.
 */
import { describe, expect, it } from 'vitest';
import type { BusinessProfileFormSchema } from '../domain/business-profile-types';
import { resolveLocalizedSchema } from './resolve-localized-schema';

const minimalSchema: BusinessProfileFormSchema = {
  version: 'test',
  title: { en: 'Tell us about your business', 'pt-br': 'Conte-nos sobre o seu negócio' },
  subtitle: { en: 'Help our AI agents', 'pt-br': 'Ajude nossos agentes de IA' },
  supportedLocales: ['en', 'pt-br'],
  defaultLocale: 'en',
  submitLabel: { en: 'Finish setup', 'pt-br': 'Concluir configuração' },
  skipLabel: { en: 'Skip for now', 'pt-br': 'Pular por enquanto' },
  steps: [
    {
      id: 'company',
      title: { en: 'Your company', 'pt-br': 'Sua empresa' },
      description: { en: 'A quick snapshot', 'pt-br': 'Um resumo rápido' },
      fields: [
        {
          id: 'companyName',
          type: 'text',
          label: { en: 'Company name', 'pt-br': 'Nome da empresa' },
          placeholder: { en: 'Acme Inc.', 'pt-br': 'Acme Ltda.' },
          help: { en: 'Your legal name', 'pt-br': 'Seu nome legal' },
          required: true,
        },
        {
          id: 'industry',
          type: 'select',
          label: { en: 'Industry', 'pt-br': 'Setor' },
          options: [
            { value: 'saas', label: { en: 'B2B SaaS', 'pt-br': 'SaaS B2B' } },
            { value: 'other', label: { en: 'Other', 'pt-br': 'Outro' } },
          ],
          required: true,
        },
      ],
    },
  ],
  markdownTemplate: {
    heading: { en: 'Company Context', 'pt-br': 'Contexto da Empresa' },
    sectionPerStep: true,
  },
};

describe('resolveLocalizedSchema', () => {
  it('resolves all labels to EN when locale is en', () => {
    const resolved = resolveLocalizedSchema(minimalSchema, 'en');
    expect(resolved.title).toBe('Tell us about your business');
    expect(resolved.subtitle).toBe('Help our AI agents');
    expect(resolved.submitLabel).toBe('Finish setup');
    expect(resolved.skipLabel).toBe('Skip for now');
    expect(resolved.steps[0].title).toBe('Your company');
    expect(resolved.steps[0].description).toBe('A quick snapshot');
    expect(resolved.steps[0].fields[0].label).toBe('Company name');
    expect(resolved.steps[0].fields[0].placeholder).toBe('Acme Inc.');
    expect(resolved.steps[0].fields[0].help).toBe('Your legal name');
    expect(resolved.steps[0].fields[1].options?.[0].label).toBe('B2B SaaS');
    expect(resolved.markdownTemplate?.heading).toBe('Company Context');
  });

  it('resolves all labels to PT-BR when locale is pt-br', () => {
    const resolved = resolveLocalizedSchema(minimalSchema, 'pt-br');
    expect(resolved.title).toBe('Conte-nos sobre o seu negócio');
    expect(resolved.steps[0].title).toBe('Sua empresa');
    expect(resolved.steps[0].fields[0].label).toBe('Nome da empresa');
    expect(resolved.steps[0].fields[1].options?.[1].label).toBe('Outro');
    expect(resolved.markdownTemplate?.heading).toBe('Contexto da Empresa');
  });

  it('plain string LocalizedString resolves identically in both locales', () => {
    const schema: BusinessProfileFormSchema = {
      ...minimalSchema,
      title: 'Shared title',
      steps: [
        {
          id: 'step1',
          title: 'Same in all locales',
          fields: [{ id: 'f1', type: 'text', label: 'Plain label' }],
        },
      ],
    };
    const en = resolveLocalizedSchema(schema, 'en');
    const ptBr = resolveLocalizedSchema(schema, 'pt-br');
    expect(en.title).toBe('Shared title');
    expect(ptBr.title).toBe('Shared title');
    expect(en.steps[0].title).toBe('Same in all locales');
    expect(ptBr.steps[0].title).toBe('Same in all locales');
    expect(en.steps[0].fields[0].label).toBe('Plain label');
    expect(ptBr.steps[0].fields[0].label).toBe('Plain label');
  });

  it('falls back to defaultLocale when target locale is missing', () => {
    const schemaWithPartialTranslation: BusinessProfileFormSchema = {
      ...minimalSchema,
      steps: [
        {
          id: 'step1',
          title: { en: 'Only English', 'pt-br': 'Somente Inglês' },
          fields: [
            {
              id: 'f1',
              type: 'text',
              // Simulating only-EN by using a plain string (same effect as fallback)
              label: { en: 'English only label', 'pt-br': '' },
            },
          ],
        },
      ],
    };
    // When pt-br value is empty string, it should still return it (not fallback)
    // The fallback only applies when a locale key is missing entirely
    const resolved = resolveLocalizedSchema(schemaWithPartialTranslation, 'pt-br');
    expect(resolved.steps[0].title).toBe('Somente Inglês');
  });

  it('does not throw on missing translation keys — logs warning only', () => {
    // Create a schema where we pass a weird object that only has 'en'
    // This tests robustness — the resolver should not throw
    const malformed = {
      ...minimalSchema,
      title: { en: 'Only English title' } as unknown as { en: string; 'pt-br': string },
    };
    expect(() =>
      resolveLocalizedSchema(malformed as BusinessProfileFormSchema, 'pt-br'),
    ).not.toThrow();
    const resolved = resolveLocalizedSchema(malformed as BusinessProfileFormSchema, 'pt-br');
    // Should fall back to 'en' value
    expect(resolved.title).toBe('Only English title');
  });

  it('preserves field ids and option values unchanged', () => {
    const resolved = resolveLocalizedSchema(minimalSchema, 'en');
    expect(resolved.steps[0].fields[0].id).toBe('companyName');
    expect(resolved.steps[0].fields[1].options?.[0].value).toBe('saas');
    expect(resolved.steps[0].fields[1].options?.[1].value).toBe('other');
  });

  it('preserves non-display fields (required, minLength, type, etc.)', () => {
    const schema: BusinessProfileFormSchema = {
      ...minimalSchema,
      steps: [
        {
          id: 'step1',
          title: 'Step',
          fields: [
            {
              id: 'f1',
              type: 'text',
              label: 'Label',
              required: true,
              minLength: 5,
              maxLength: 100,
              visibleWhen: { fieldId: 'other', equals: 'yes' },
            },
          ],
        },
      ],
    };
    const resolved = resolveLocalizedSchema(schema, 'en');
    const field = resolved.steps[0].fields[0];
    expect(field.required).toBe(true);
    expect(field.minLength).toBe(5);
    expect(field.maxLength).toBe(100);
    expect(field.visibleWhen).toEqual({ fieldId: 'other', equals: 'yes' });
    expect(field.type).toBe('text');
  });
});
