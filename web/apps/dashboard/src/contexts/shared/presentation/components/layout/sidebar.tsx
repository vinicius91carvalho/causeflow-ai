'use client';

import { cn } from '@causeflow/ui/lib';
import {
  Brain,
  ChevronLeft,
  LayoutDashboard,
  Plug,
  Radio,
  ScrollText,
  Settings,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onCollapse: (collapsed: boolean) => void;
  onMobileClose: () => void;
}

interface NavItem {
  key: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** OSS commercial removal (AC-073): Billing nav entry intentionally omitted. */
const navItems: NavItem[] = [
  { key: 'overview', href: '/dashboard', icon: LayoutDashboard },
  { key: 'incidents', href: '/dashboard/incidents', icon: ShieldAlert },
  { key: 'intelligence', href: '/dashboard/intelligence', icon: Brain },
  { key: 'integrations', href: '/dashboard/integrations', icon: Plug },
  { key: 'relay', href: '/dashboard/relay', icon: Radio },
  { key: 'audit', href: '/dashboard/audit', icon: ScrollText },
  { key: 'team', href: '/dashboard/team', icon: Users },
  { key: 'settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar({ collapsed, mobileOpen, onCollapse, onMobileClose }: SidebarProps) {
  const t = useTranslations('dashboard');
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 flex h-full flex-col border-r border-border bg-muted/60 transition-all duration-300 ease-in-out',
          // Mobile: slide in/out
          'lg:relative lg:translate-x-0 lg:z-auto',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          // Desktop: collapsed/expanded
          collapsed ? 'w-16' : 'w-64',
        )}
        aria-label="Main navigation"
      >
        {/* Sidebar header */}
        <div className="flex h-16 items-center justify-between px-3 border-b border-border shrink-0">
          {!collapsed && (
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 font-semibold text-foreground hover:opacity-80 transition-opacity"
              aria-label={t('topbar.logo')}
            >
              <Image
                src="/logo.png"
                alt="CauseFlow AI"
                width={32}
                height={32}
                className="h-7 w-7 object-contain shrink-0"
                priority
              />
              <span className="text-sm font-bold tracking-tight truncate">CauseFlow AI</span>
            </Link>
          )}
          {collapsed && (
            <Link
              href="/dashboard"
              className="flex w-full items-center justify-center"
              aria-label={t('topbar.logo')}
              onClick={() => onCollapse(false)}
            >
              <Image
                src="/logo.png"
                alt="CauseFlow AI"
                width={40}
                height={40}
                className="h-9 w-9 object-contain"
                priority
              />
            </Link>
          )}
          {/* Mobile close button */}
          <button
            type="button"
            className="flex lg:hidden items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors"
            onClick={onMobileClose}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
          {/* Desktop collapse toggle — only visible when expanded */}
          {!collapsed && (
            <button
              type="button"
              className="hidden lg:flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors shrink-0"
              onClick={() => onCollapse(true)}
              aria-label={t('sidebar.collapse')}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={onMobileClose}
                data-tour={`nav-${item.key}`}
                className={cn(
                  'group flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-all duration-200 min-h-[44px] lg:min-h-0',
                  active
                    ? 'bg-accent/15 text-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground hover:translate-x-1 hover:shadow-sm',
                  collapsed && 'justify-center px-2 hover:translate-x-0 hover:scale-110',
                )}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? t(`sidebar.${item.key}`) : undefined}
              >
                <Icon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
                {!collapsed && <span className="truncate">{t(`sidebar.${item.key}`)}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
