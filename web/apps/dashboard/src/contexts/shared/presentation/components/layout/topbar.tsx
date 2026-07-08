'use client';

import { cn } from '@causeflow/ui/lib';
import { useTheme } from '@causeflow/ui/themes/provider';
import { GraduationCap, LogOut, Menu, Monitor, Moon, Sun } from 'lucide-react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback } from 'react';
import type { Locale } from '@/contexts/settings/domain/types';
import { getNextTheme } from '@/contexts/shared/lib/theme-cycle';
import { useUser } from '@/contexts/shared/presentation/components/auth-context';
import { LanguageSwitcher } from '@/contexts/shared/presentation/components/layout/language-switcher';
import { Link } from '@/i18n/navigation';

interface TopbarProps {
  onMobileMenuOpen: () => void;
  breadcrumb?: string;
}

/** Shared hover classes for icon buttons in the topbar */
const iconBtnClass = cn(
  'flex items-center justify-center h-11 w-11 lg:h-8 lg:w-8 rounded-md',
  'bg-primary text-primary-foreground',
  'transition-all duration-200',
  'hover:bg-primary/90 hover:scale-110',
  'active:scale-95',
);

function UserAvatar({ name, email }: { name: string | null; email: string | null }) {
  const initials =
    (name ?? email ?? 'U')
      .split(' ')
      .map((s) => s.charAt(0))
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';

  return (
    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/20 text-xs font-semibold text-primary">
      {initials}
    </div>
  );
}

export function Topbar({ onMobileMenuOpen, breadcrumb }: TopbarProps) {
  const t = useTranslations('dashboard');
  const { colorMode, setColorMode } = useTheme();
  const locale = useLocale() as Locale;
  const { user } = useUser();
  const name = user?.fullName ?? null;
  const email = user?.emailAddress ?? null;

  const cycleColorMode = () => setColorMode(getNextTheme(colorMode));

  const ThemeIcon = colorMode === 'light' ? Sun : colorMode === 'dark' ? Moon : Monitor;

  const handleSignOut = useCallback(() => {
    void (async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/auth/sign-in';
    })();
  }, []);

  const handleTutorial = useCallback(() => {
    window.dispatchEvent(new CustomEvent('causeflow:restart-tutorial'));
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-muted/40 px-4">
      {/* Mobile hamburger */}
      <button
        type="button"
        className="flex lg:hidden items-center justify-center h-11 w-11 rounded-md hover:bg-accent transition-all duration-200 hover:scale-110 active:scale-95"
        onClick={onMobileMenuOpen}
        aria-label={t('sidebar.openMenu')}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile logo — visible only on small screens where sidebar is hidden */}
      <Link
        href="/dashboard"
        className="flex lg:hidden items-center hover:opacity-80 transition-opacity"
        aria-label={t('topbar.logo')}
      >
        <Image
          src="/logo.png"
          alt="CauseFlow AI"
          width={120}
          height={32}
          className="h-7 w-auto object-contain"
          priority
        />
      </Link>

      {/* Breadcrumb / page title area */}
      <div className="flex-1 min-w-0">
        {breadcrumb && (
          <h1 className="hidden lg:block truncate text-sm font-medium text-foreground">
            {breadcrumb}
          </h1>
        )}
      </div>

      {/* Right-side actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Theme toggle */}
        <button
          type="button"
          className={iconBtnClass}
          onClick={cycleColorMode}
          aria-label={t('topbar.themeToggle')}
          title={`Theme: ${colorMode}`}
        >
          <ThemeIcon className="h-4 w-4" />
        </button>

        {/* Language selector — writes NEXT_LOCALE cookie and persists via PATCH /api/settings */}
        <LanguageSwitcher currentLocale={locale} />

        {/* Tutorial button */}
        <button
          type="button"
          className={iconBtnClass}
          onClick={handleTutorial}
          aria-label={t('topbar.tutorial')}
          title={t('topbar.tutorial')}
        >
          <GraduationCap className="h-4 w-4" />
        </button>

        {/* User avatar + logout */}
        <div className="flex items-center gap-1">
          <UserAvatar name={name} email={email} />
          <button
            type="button"
            onClick={handleSignOut}
            className={iconBtnClass}
            aria-label={t('topbar.signOut')}
            title={t('topbar.signOut') ?? 'Sign out'}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
