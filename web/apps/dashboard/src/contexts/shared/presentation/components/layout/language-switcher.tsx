'use client';

import { cn } from '@causeflow/ui/lib';
import { Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState, useTransition } from 'react';
import type { Locale } from '@/contexts/settings/domain/types';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';
import { usePathname, useRouter } from '@/i18n/navigation';

// Cookie contract — must match apps/dashboard/src/middleware.ts exactly.
const LANGUAGE_COOKIE_NAME = 'NEXT_LOCALE';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const iconBtnClass = cn(
  'flex items-center justify-center h-11 w-11 lg:h-8 lg:w-8 rounded-md',
  'bg-primary text-primary-foreground',
  'transition-all duration-200',
  'hover:bg-primary/90 hover:scale-110',
  'active:scale-95',
  'disabled:opacity-50 disabled:cursor-not-allowed',
);

interface LanguageSwitcherProps {
  currentLocale: Locale;
}

/**
 * Writes the NEXT_LOCALE cookie with the contract defined in middleware.ts:
 * Path=/, Max-Age=365d, SameSite=Lax, Secure on HTTPS. Not HttpOnly because
 * next-intl needs to read the cookie client-side.
 */
function writeLanguageCookie(locale: Locale) {
  const secure =
    typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  // biome-ignore lint/suspicious/noDocumentCookie: next-intl reads NEXT_LOCALE from document.cookie — must use document.cookie writer so the cookie is available immediately for the next router.replace() SSR pass. The Cookie Store API is async + not universally supported; middleware.ts sets the same cookie via document.cookie semantics.
  document.cookie = `${LANGUAGE_COOKIE_NAME}=${locale}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}

export function LanguageSwitcher({ currentLocale }: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('dashboard.topbar.language');
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();

  const onSelect = (locale: Locale) => {
    if (locale === currentLocale || isPending) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch('/api/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale }),
        });
        if (!res.ok) {
          addToast(t('error'), 'error');
          return;
        }
        writeLanguageCookie(locale);
        setOpen(false);
        router.replace(pathname, { locale });
      } catch {
        addToast(t('error'), 'error');
      }
    });
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className={iconBtnClass}
        onClick={() => setOpen((v) => !v)}
        aria-label={t('label')}
        title={t('label')}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={isPending}
      >
        <Globe className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="menu"
            className={cn(
              'absolute right-0 top-full mt-2 z-50 w-48 rounded-xl border border-border bg-card shadow-lg shadow-black/10 dark:shadow-black/30 overflow-hidden',
              'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2',
            )}
          >
            <div className="py-1">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={currentLocale === 'en'}
                disabled={isPending}
                className={cn(
                  'flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-all duration-200',
                  currentLocale === 'en'
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground hover:bg-accent hover:translate-x-1',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
                onClick={() => onSelect('en')}
              >
                <span className="text-base leading-none" aria-hidden="true">
                  🇺🇸
                </span>
                {t('en')}
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={currentLocale === 'pt-br'}
                disabled={isPending}
                className={cn(
                  'flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition-all duration-200',
                  currentLocale === 'pt-br'
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground hover:bg-accent hover:translate-x-1',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
                onClick={() => onSelect('pt-br')}
              >
                <span className="text-base leading-none" aria-hidden="true">
                  🇧🇷
                </span>
                {t('ptBr')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
