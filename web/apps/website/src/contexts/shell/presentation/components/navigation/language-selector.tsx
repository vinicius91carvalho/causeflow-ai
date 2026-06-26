'use client';

import { Button } from '@causeflow/ui/primitives';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';

const LOCALE_COOKIE = 'NEXT_LOCALE';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year in seconds

/**
 * Persist the user's explicit locale choice in a cookie so that the
 * middleware geo/Accept-Language detection does not override it on the
 * next page load.  The cookie name matches the one used by the middleware
 * (`NEXT_LOCALE`) so both systems stay in sync.
 */
function setLocaleCookie(locale: string): void {
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API is async and not reliably available in all browsers; direct assignment is the correct synchronous approach here.
  document.cookie = `${LOCALE_COOKIE}=${locale}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
}

export function LanguageSelector() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggleLocale = () => {
    const nextLocale = locale === 'en' ? 'pt-br' : 'en';
    // Persist user preference before navigation so the middleware sees the
    // cookie immediately on the next request and skips geo-detection.
    setLocaleCookie(nextLocale);
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLocale}
      aria-label={locale === 'en' ? 'Switch to PT-BR' : 'Switch to EN'}
      className="text-xs font-medium uppercase"
    >
      {locale === 'en' ? 'PT-BR' : 'EN'}
    </Button>
  );
}
