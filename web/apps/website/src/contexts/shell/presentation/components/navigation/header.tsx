'use client';

import { ROUTES, SITE } from '@causeflow/shared/constants';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { getDashboardUrl } from '@/lib/dashboard-url';
import { LanguageSelector } from './language-selector';
import { MobileMenu } from './mobile-menu';

const navItems = [
  { label: 'Product', href: ROUTES.PRODUCT },
  { label: 'Integrations', href: ROUTES.INTEGRATIONS },
  { label: 'Usecases', href: ROUTES.USE_CASES },
  { label: 'Security', href: ROUTES.SECURITY },
  { label: 'About', href: ROUTES.ABOUT },
  { label: 'Docs', href: SITE.docsUrl, external: true },
];

export function Header() {
  const t = useTranslations('common');
  const [mobileOpen, setMobileOpen] = useState(false);
  const dashboardUrl = getDashboardUrl();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
          <Image src="/favicon.svg" alt="" width={28} height={28} aria-hidden="true" />
          <span className="text-foreground">CauseFlow</span>
        </Link>

        {/* Desktop Nav */}
        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) =>
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t(`nav.${item.label.toLowerCase().replace(/ /g, '')}`)}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t(`nav.${item.label.toLowerCase().replace(/ /g, '')}`)}
              </Link>
            ),
          )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <LanguageSelector />
          <a
            href={dashboardUrl}
            rel="noopener noreferrer"
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            {t('nav.dashboard')}
          </a>
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:text-foreground lg:hidden"
            aria-label="Open menu"
          >
            <svg
              aria-hidden="true"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
        </div>
      </div>

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} navItems={navItems} />
    </header>
  );
}
