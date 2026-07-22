import { describe, expect, it, vi, afterEach } from 'vitest';
import imageLoader from './image-loader';

describe('imageLoader', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns src unchanged without base path', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '');
    expect(imageLoader({ src: '/icons/integrations/datadog.svg' })).toBe(
      '/icons/integrations/datadog.svg',
    );
  });

  it('prefixes root-absolute public assets with GitHub Pages base path', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/causeflow-ai');
    expect(imageLoader({ src: '/icons/integrations/datadog.svg' })).toBe(
      '/causeflow-ai/icons/integrations/datadog.svg',
    );
  });

  it('does not double-prefix', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/causeflow-ai');
    expect(imageLoader({ src: '/causeflow-ai/icons/integrations/datadog.svg' })).toBe(
      '/causeflow-ai/icons/integrations/datadog.svg',
    );
  });

  it('leaves absolute URLs alone', () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/causeflow-ai');
    expect(imageLoader({ src: 'https://example.com/a.svg' })).toBe('https://example.com/a.svg');
  });
});
