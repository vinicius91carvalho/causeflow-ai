'use client';

import { useEffect, useState } from 'react';
import { themes } from './index';
import { useTheme } from './provider';
import type { ColorMode, ThemeId } from './types';

const colorModes: { value: ColorMode; label: string; icon: React.ReactNode }[] = [
  {
    value: 'light',
    label: 'Light',
    icon: (
      <svg
        aria-hidden="true"
        className="h-3.5 w-3.5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
        />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: (
      <svg
        aria-hidden="true"
        className="h-3.5 w-3.5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
        />
      </svg>
    ),
  },
  {
    value: 'system',
    label: 'Auto',
    icon: (
      <svg
        aria-hidden="true"
        className="h-3.5 w-3.5"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"
        />
      </svg>
    ),
  },
];

export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const { themeId, colorMode, setThemeId, setColorMode } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const themeList = Object.values(themes);
  const currentTheme = themes[themeId];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label={`Theme: ${currentTheme?.name ?? themeId}. Click to change.`}
        title="Change theme"
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h1.5c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z"
          />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <button
            type="button"
            className="fixed inset-0 z-[99]"
            onClick={() => setOpen(false)}
            aria-label="Close theme switcher"
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full z-[100] mt-2 w-56 rounded-lg border border-border bg-popover p-2 shadow-lg">
            {/* Theme list */}
            <div className="mb-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Theme
            </div>
            <div className="mb-2 flex flex-col gap-0.5">
              {themeList.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    setThemeId(theme.id as ThemeId);
                  }}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    themeId === theme.id
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-foreground/80 hover:bg-accent/50'
                  }`}
                >
                  {/* Color swatch */}
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-border"
                    style={{ backgroundColor: theme.palette?.accent ?? 'var(--color-accent)' }}
                  />
                  <span className="truncate">{theme.name}</span>
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="my-1 border-t border-border" />

            {/* Color mode */}
            <div className="mb-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Mode
            </div>
            <div className="flex gap-0.5">
              {colorModes.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => setColorMode(mode.value)}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors ${
                    colorMode === mode.value
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-foreground/80 hover:bg-accent/50'
                  }`}
                  title={mode.label}
                >
                  {mode.icon}
                  <span>{mode.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
