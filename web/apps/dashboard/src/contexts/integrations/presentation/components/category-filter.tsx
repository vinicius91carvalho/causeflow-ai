'use client';

import { useTranslations } from 'next-intl';

export type IntegrationCategory =
  | 'all'
  | 'communication'
  | 'monitoring'
  | 'code'
  | 'management'
  | 'crm'
  | 'database'
  | 'knowledge'
  | 'api';

interface CategoryFilterProps {
  selected: IntegrationCategory;
  onSelect: (category: IntegrationCategory) => void;
}

const CATEGORIES: IntegrationCategory[] = [
  'all',
  'communication',
  'monitoring',
  'code',
  'management',
  'crm',
  'database',
  'knowledge',
  'api',
];

/**
 * Horizontal filter chips for filtering integrations by category.
 * "All" is selected by default.
 */
export function CategoryFilter({ selected, onSelect }: CategoryFilterProps) {
  const t = useTranslations('dashboard.integrations.filter');

  return (
    <fieldset
      className="flex flex-wrap gap-2 border-0 p-0 m-0"
      aria-label="Filter integrations by category"
    >
      {CATEGORIES.map((category) => {
        const isSelected = selected === category;
        return (
          <button
            key={category}
            type="button"
            onClick={() => onSelect(category)}
            aria-pressed={isSelected}
            className={[
              'rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 border',
              isSelected
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground',
            ].join(' ')}
          >
            {t(category as Parameters<typeof t>[0])}
          </button>
        );
      })}
    </fieldset>
  );
}
