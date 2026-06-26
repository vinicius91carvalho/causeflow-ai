'use client';

type UserRole = 'admin' | 'member';

import { useTranslations } from 'next-intl';

interface RoleBadgeProps {
  role: UserRole;
  className?: string;
}

/**
 * Visual badge for user roles.
 * Admin: purple/branded badge
 * Member: gray/neutral badge
 */
export function RoleBadge({ role, className = '' }: RoleBadgeProps) {
  const t = useTranslations('dashboard.team.roles');

  const base =
    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset';

  const styles: Record<UserRole, string> = {
    admin: 'bg-muted/10 text-muted-foreground ring-purple-500/20 dark:ring-purple-500/30',
    member: 'bg-secondary text-secondary-foreground ring-border',
  };

  return (
    <span className={[base, styles[role], className].join(' ')}>
      {role === 'admin' ? t('admin') : t('member')}
    </span>
  );
}
