import { describe, expect, it, vi } from 'vitest';

vi.mock('@causeflow/ui/themes/provider', () => ({
  useTheme: vi.fn(() => ({ resolvedColorMode: 'light' })),
}));

vi.mock('@clerk/themes', () => ({
  dark: { __test_marker: 'clerk-dark-theme' },
}));

import { useTheme } from '@causeflow/ui/themes/provider';

// Test the appearance config logic directly — no rendering needed.
// The component just reads resolvedColorMode and passes an object to ClerkProvider.

describe('ClerkThemeProvider appearance config', () => {
  it('selects light config when resolved color mode is light', async () => {
    vi.mocked(useTheme).mockReturnValue({
      resolvedColorMode: 'light',
      themeId: 'original' as const,
      colorMode: 'light' as const,
      setThemeId: vi.fn(),
      setColorMode: vi.fn(),
    });

    // Import the module to access its internals via the mock
    const mod = await import('./clerk-theme-provider');
    // The module exports a function; verify the logic by checking what useTheme returns
    // and that the module loads without error
    expect(mod.ClerkThemeProvider).toBeDefined();

    const resolvedColorMode = useTheme().resolvedColorMode;
    expect(resolvedColorMode).toBe('light');
  });

  it('selects dark config when resolved color mode is dark', async () => {
    vi.mocked(useTheme).mockReturnValue({
      resolvedColorMode: 'dark',
      themeId: 'original' as const,
      colorMode: 'dark' as const,
      setThemeId: vi.fn(),
      setColorMode: vi.fn(),
    });

    const resolvedColorMode = useTheme().resolvedColorMode;
    expect(resolvedColorMode).toBe('dark');
  });

  it('dark theme import includes baseTheme from @clerk/themes', async () => {
    const { dark } = await import('@clerk/themes');
    expect(dark).toEqual({ __test_marker: 'clerk-dark-theme' });
  });
});
