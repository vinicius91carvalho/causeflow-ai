'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@causeflow/ui/primitives';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { getDashboardUrl } from '@/lib/dashboard-url';
import { OSS_MARKETING_GITHUB_HREF } from '@/lib/oss-marketing-ctas';
import { publicAsset } from '@/lib/public-asset';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  navItems: Array<{ label: string; href: string; external?: boolean }>;
}

export function MobileMenu({ open, onClose, navItems }: MobileMenuProps) {
  const t = useTranslations('common');
  const dashboardUrl = getDashboardUrl();
  const primaryCtaIsGitHub = dashboardUrl.includes('github.com');

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-80">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-left">
            <Image
              src={publicAsset('/favicon.svg')}
              alt=""
              width={24}
              height={24}
              aria-hidden="true"
            />
            <span className="text-foreground">CauseFlow</span>
            <a
              href={OSS_MARKETING_GITHUB_HREF}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="rounded-full border border-[hsl(var(--brand-green)_/_0.35)] bg-[hsl(var(--brand-green)_/_0.08)] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--brand-green))]"
            >
              {t('nav.openSource')}
            </a>
          </SheetTitle>
          <SheetDescription className="sr-only">Navigation menu</SheetDescription>
        </SheetHeader>
        <nav className="mt-8 flex flex-col gap-1">
          {navItems.map((item) =>
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                onClick={onClose}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md px-3 py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {t(`nav.${item.label.toLowerCase().replace(/ /g, '')}`)}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="rounded-md px-3 py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {t(`nav.${item.label.toLowerCase().replace(/ /g, '')}`)}
              </Link>
            ),
          )}
        </nav>
        <div className="mt-4 border-t border-border/40 pt-4">
          <a
            href={dashboardUrl}
            onClick={onClose}
            target={primaryCtaIsGitHub ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-left text-base font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {primaryCtaIsGitHub ? 'GitHub' : t('nav.dashboard')}
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
