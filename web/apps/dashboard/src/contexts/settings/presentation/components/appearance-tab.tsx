'use client';

import { useTheme } from '@causeflow/ui/themes/provider';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';

// Cookie contract — must match apps/dashboard/src/middleware.ts exactly.
const LANGUAGE_COOKIE_NAME = 'NEXT_LOCALE';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

type SupportedLocale = 'en' | 'pt-br';

function writeLanguageCookie(value: SupportedLocale) {
  const secure =
    typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  // biome-ignore lint/suspicious/noDocumentCookie: next-intl reads NEXT_LOCALE from document.cookie — must be set synchronously before router.refresh()
  document.cookie = `${LANGUAGE_COOKIE_NAME}=${value}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ColorMode = 'light' | 'dark' | 'system';

interface ThemeOption {
  value: ColorMode;
  labelKey: 'themeLight' | 'themeDark' | 'themeSystem';
  icon: React.ReactNode;
}

interface LanguageOption {
  value: SupportedLocale;
  label: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppearanceTab() {
  const t = useTranslations('dashboard.settings.appearance');
  const { colorMode, setColorMode } = useTheme();
  const router = useRouter();
  const currentLocale = useLocale() as SupportedLocale;
  const { addToast } = useToast();
  const [localeChangePending, setLocaleChangePending] = useState(false);

  const themeOptions: ThemeOption[] = [
    {
      value: 'light',
      labelKey: 'themeLight',
      icon: <Sun className="h-5 w-5" />,
    },
    {
      value: 'dark',
      labelKey: 'themeDark',
      icon: <Moon className="h-5 w-5" />,
    },
    {
      value: 'system',
      labelKey: 'themeSystem',
      icon: <Monitor className="h-5 w-5" />,
    },
  ];

  const languageOptions: LanguageOption[] = [
    { value: 'en', label: 'English' },
    { value: 'pt-br', label: 'Português (BR)' },
  ];

  /**
   * Pessimistic locale change:
   *  1. PATCH /api/settings with { locale } first.
   *  2. On success → write NEXT_LOCALE cookie + refresh so middleware re-routes
   *     through next-intl and translations reload.
   *  3. On failure → show toast, do NOT switch.
   */
  async function handleLocaleChange(nextLocale: SupportedLocale) {
    if (nextLocale === currentLocale || localeChangePending) return;

    setLocaleChangePending(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: nextLocale }),
      });
      if (!res.ok) {
        addToast(t('languageSaveError'), 'error');
        return;
      }
      writeLanguageCookie(nextLocale);
      router.refresh();
    } catch {
      addToast(t('languageSaveError'), 'error');
    } finally {
      setLocaleChangePending(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Theme selector */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t('theme')}</h3>
          <p className="text-xs text-muted-foreground">{t('themeDescription')}</p>
        </div>
        <div role="radiogroup" aria-label={t('theme')} className="grid grid-cols-3 gap-3">
          {themeOptions.map((option) => {
            const isSelected = colorMode === option.value;
            return (
              // biome-ignore lint/a11y/useSemanticElements: button with role="radio" is valid in a radiogroup for visual radio cards
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setColorMode(option.value)}
                className={[
                  'flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-sm font-medium transition-all',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background',
                  isSelected
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-accent',
                ].join(' ')}
              >
                <span className={isSelected ? 'text-primary' : ''} aria-hidden="true">
                  {option.icon}
                </span>
                {t(option.labelKey)}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">{t('appliedImmediately')}</p>
      </div>

      {/* Language selector */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t('language')}</h3>
          <p className="text-xs text-muted-foreground">{t('languageDescription')}</p>
        </div>
        <div
          role="radiogroup"
          aria-label={t('language')}
          className="flex flex-col gap-2 sm:flex-row"
        >
          {languageOptions.map((option) => {
            const isSelected = currentLocale === option.value;
            return (
              // biome-ignore lint/a11y/useSemanticElements: button with role="radio" is valid in a radiogroup for visual radio cards
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={localeChangePending}
                onClick={() => {
                  void handleLocaleChange(option.value);
                }}
                className={[
                  'flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  isSelected
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:bg-accent',
                ].join(' ')}
              >
                {option.label}
                {isSelected && (
                  <span className="ml-auto text-primary text-base" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
