'use client';

import { ChevronRight } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Fragment } from 'react';
import { Link } from '@/i18n/navigation';

// ---------------------------------------------------------------------------
// Route segment → i18n key mapping
// ---------------------------------------------------------------------------

const SEGMENT_LABEL_MAP: Record<string, string> = {
  dashboard: 'dashboard',
  analyses: 'analyses',
  new: 'newAnalysis',
  integrations: 'integrations',
  team: 'team',
  settings: 'settings',
};

// Segments that are dynamic IDs (UUIDs, etc.) — skip labeling
const UUID_PATTERN = /^[0-9a-f-]{8,}$/i;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BreadcrumbItem {
  label: string;
  href?: string;
  isLast: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function useBreadcrumbs(): BreadcrumbItem[] {
  const pathname = usePathname();
  const t = useTranslations('dashboard.settings.breadcrumbs');

  // Strip locale prefix if present (/pt-br/dashboard/... → /dashboard/...)
  const normalizedPath = pathname.replace(/^\/[a-z]{2}(-[a-z]{2})?\//, '/');

  // Split into segments, filter empty
  const segments = normalizedPath.split('/').filter(Boolean);

  const items: BreadcrumbItem[] = [];
  let cumulativeHref = '';

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    cumulativeHref += `/${segment}`;

    // Skip dynamic ID segments
    if (UUID_PATTERN.test(segment)) {
      continue;
    }

    const labelKey = SEGMENT_LABEL_MAP[segment];
    if (!labelKey) continue;

    const isLast = i === segments.length - 1;

    let label: string;
    try {
      label = t(labelKey as Parameters<typeof t>[0]);
    } catch {
      label = segment.charAt(0).toUpperCase() + segment.slice(1);
    }

    items.push({
      label,
      href: isLast ? undefined : cumulativeHref,
      isLast,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Breadcrumbs() {
  const items = useBreadcrumbs();

  // Don't render if only 1 item (just "Dashboard")
  if (items.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {items.map((item, index) => (
        <Fragment key={item.label}>
          {index > 0 && (
            <ChevronRight
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[120px]"
            >
              {item.label}
            </Link>
          ) : (
            <span
              aria-current="page"
              className="text-foreground font-medium truncate max-w-[120px]"
            >
              {item.label}
            </span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
