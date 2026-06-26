/**
 * CaseStudyBreadcrumb — "Use Cases › Current Slug" breadcrumb nav.
 *
 * Rendered inside a subtle pill container so the breadcrumb reads as a
 * proper UI element rather than loose text at the top of the page.
 */

import { Link } from '@/i18n/navigation';

export interface CaseStudyBreadcrumbProps {
  rootLabel: string;
  currentLabel: string;
}

export function CaseStudyBreadcrumb({ rootLabel, currentLabel }: CaseStudyBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex">
      <ol className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/80 py-1.5 pr-4 pl-2 text-[12.5px] font-medium shadow-[0_1px_2px_hsl(var(--foreground)/0.03)] backdrop-blur-sm">
        <li>
          <Link
            href="/use-cases"
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          >
            <HomeIcon />
            <span>{rootLabel}</span>
          </Link>
        </li>
        <li aria-hidden="true" className="flex items-center">
          <ChevronIcon />
        </li>
        <li>
          <span className="truncate text-foreground" aria-current="page">
            {currentLabel}
          </span>
        </li>
      </ol>
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M2.5 7.5 8 3l5.5 4.5v5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-5z" />
      <path d="M6.5 13v-3.5h3V13" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 text-border"
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}
