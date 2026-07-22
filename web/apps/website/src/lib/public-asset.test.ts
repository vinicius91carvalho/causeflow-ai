import { afterEach, describe, expect, it, vi } from 'vitest';
import { publicAsset } from './public-asset';

describe('publicAsset', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns path unchanged without base path', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '');
    expect(publicAsset('/icons/integrations/datadog.svg')).toBe('/icons/integrations/datadog.svg');
  });

  it('prefixes with GitHub Pages base path', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/causeflow-ai');
    expect(publicAsset('/icons/integrations/datadog.svg')).toBe(
      '/causeflow-ai/icons/integrations/datadog.svg',
    );
  });
});
