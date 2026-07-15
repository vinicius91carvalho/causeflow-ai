import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('oss-investigation-llm-profiles.routes (AC-091)', () => {
  const src = fs.readFileSync(
    path.resolve(
      process.cwd(),
      'src/modules/oss/infra/oss-investigation-llm-profiles.routes.ts',
    ),
    'utf8',
  );

  it('validates required label, baseUrl, and model on create', () => {
    expect(src).toContain("label: z.string().trim().min(1, 'label is required')");
    expect(src).toContain("baseUrl: z.string().trim().url('baseUrl must be a valid URL')");
    expect(src).toContain("model: z.string().trim().min(1, 'model is required')");
  });

  it('treats apiKey as optional for local Ornith profiles', () => {
    expect(src).toContain('apiKey: z.string().trim().min(1).optional()');
    expect(src).toContain('const apiKeyEncrypted = input.apiKey');
  });

  it('does not block save or activate on connectivity probes', () => {
    expect(src).not.toMatch(/probe|connectivity|reachable|healthCheck/i);
    expect(src).toContain("routes.post('/', requireRole('admin'), zValidator('json', createProfileSchema)");
    expect(src).toContain("routes.post('/:id/activate', requireRole('admin'), async (c) =>");
  });
});

describe('oss-investigation-llm-profiles.routes (AC-089)', () => {
  const src = fs.readFileSync(
    path.resolve(
      process.cwd(),
      'src/modules/oss/infra/oss-investigation-llm-profiles.routes.ts',
    ),
    'utf8',
  );

  it('blocks deleting the active profile with a clear 409 error', () => {
    expect(src).toContain('getActiveInvestigationLlmProfileId(tenantId)');
    expect(src).toContain('if (activeProfileId === profileId)');
    expect(src).toContain('ACTIVE_INVESTIGATION_LLM_PROFILE_DELETE_ERROR');
    expect(src).toContain('Activate another profile first');
    expect(src).toMatch(/return c\.json\(\{ error: ACTIVE_INVESTIGATION_LLM_PROFILE_DELETE_ERROR \}, 409\)/);
  });
});
