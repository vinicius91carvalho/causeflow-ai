'use client';

import { useTheme } from '@causeflow/ui/themes/provider';
import {
  AlertTriangle,
  CheckSquare,
  ClipboardList,
  LayoutDashboard,
  Plug,
  Plus,
  ScrollText,
  Search,
  Settings,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getNextTheme } from '@/contexts/shared/lib/theme-cycle';
import { useRouter } from '@/i18n/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandItem {
  id: string;
  label: string;
  section: 'actions' | 'navigation';
  icon: React.ReactNode;
  onSelect: () => void;
}

// ---------------------------------------------------------------------------
// Simple fuzzy match — returns true if all query chars appear in order
// ---------------------------------------------------------------------------

function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

// ---------------------------------------------------------------------------
// Command palette context
// ---------------------------------------------------------------------------

interface CommandPaletteContextValue {
  open: () => void;
  close: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error('useCommandPalette must be inside CommandPaletteProvider');
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider + modal
// ---------------------------------------------------------------------------

interface CommandPaletteProviderProps {
  children: React.ReactNode;
}

export function CommandPaletteProvider({ children }: CommandPaletteProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const t = useTranslations('dashboard.settings.commandPalette');
  const { setColorMode, colorMode } = useTheme();

  const openPalette = useCallback(() => {
    setIsOpen(true);
    setQuery('');
    setActiveIndex(0);
  }, []);

  const closePalette = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, []);

  // Global keyboard listener for Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          closePalette();
        } else {
          openPalette();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        closePalette();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, openPalette, closePalette]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build command list
  const allCommands: CommandItem[] = useMemo(
    () => [
      {
        id: 'new-analysis',
        label: t('actions.newAnalysis'),
        section: 'actions',
        icon: <Plus className="h-4 w-4" />,
        onSelect: () => {
          router.push('/dashboard/analyses/new');
          closePalette();
        },
      },
      {
        id: 'view-integrations',
        label: t('actions.viewIntegrations'),
        section: 'actions',
        icon: <Plug className="h-4 w-4" />,
        onSelect: () => {
          router.push('/dashboard/integrations');
          closePalette();
        },
      },
      {
        id: 'manage-team',
        label: t('actions.manageTeam'),
        section: 'actions',
        icon: <Users className="h-4 w-4" />,
        onSelect: () => {
          router.push('/dashboard/team');
          closePalette();
        },
      },
      {
        id: 'open-settings',
        label: t('actions.openSettings'),
        section: 'actions',
        icon: <Settings className="h-4 w-4" />,
        onSelect: () => {
          router.push('/dashboard/settings');
          closePalette();
        },
      },
      {
        id: 'toggle-theme',
        label: t('actions.toggleTheme'),
        section: 'actions',
        icon: <Sun className="h-4 w-4" />,
        onSelect: () => {
          setColorMode(getNextTheme(colorMode));
          closePalette();
        },
      },
      {
        id: 'nav-dashboard',
        label: t('navigation.dashboard'),
        section: 'navigation',
        icon: <LayoutDashboard className="h-4 w-4" />,
        onSelect: () => {
          router.push('/dashboard');
          closePalette();
        },
      },
      {
        id: 'nav-analyses',
        label: t('navigation.analyses'),
        section: 'navigation',
        icon: <Search className="h-4 w-4" />,
        onSelect: () => {
          router.push('/dashboard/analyses');
          closePalette();
        },
      },
      {
        id: 'nav-integrations',
        label: t('navigation.integrations'),
        section: 'navigation',
        icon: <Plug className="h-4 w-4" />,
        onSelect: () => {
          router.push('/dashboard/integrations');
          closePalette();
        },
      },
      {
        id: 'nav-team',
        label: t('navigation.team'),
        section: 'navigation',
        icon: <Users className="h-4 w-4" />,
        onSelect: () => {
          router.push('/dashboard/team');
          closePalette();
        },
      },
      {
        id: 'nav-settings',
        label: t('navigation.settings'),
        section: 'navigation',
        icon: <Settings className="h-4 w-4" />,
        onSelect: () => {
          router.push('/dashboard/settings');
          closePalette();
        },
      },
      {
        id: 'nav-incidents',
        label: t('navigation.incidents'),
        section: 'navigation',
        icon: <AlertTriangle className="h-4 w-4" />,
        onSelect: () => {
          router.push('/dashboard/incidents');
          closePalette();
        },
      },
      {
        id: 'nav-remediations',
        label: t('navigation.remediations'),
        section: 'navigation',
        icon: <ClipboardList className="h-4 w-4" />,
        onSelect: () => {
          router.push('/dashboard/remediations');
          closePalette();
        },
      },
      {
        id: 'nav-approvals',
        label: t('navigation.approvals'),
        section: 'navigation',
        icon: <CheckSquare className="h-4 w-4" />,
        onSelect: () => {
          router.push('/dashboard/approvals');
          closePalette();
        },
      },
      {
        id: 'nav-audit',
        label: t('navigation.auditLog'),
        section: 'navigation',
        icon: <ScrollText className="h-4 w-4" />,
        onSelect: () => {
          router.push('/dashboard/audit');
          closePalette();
        },
      },
    ],
    [router, closePalette, t, setColorMode, colorMode],
  );

  const filtered = allCommands.filter((cmd) => fuzzyMatch(query, cmd.label));
  const actionItems = filtered.filter((c) => c.section === 'actions');
  const navItems = filtered.filter((c) => c.section === 'navigation');

  // Keyboard navigation within the list
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[activeIndex];
      item?.onSelect();
    }
  }

  // Reset active index when query changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset on query change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active item into view
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally scroll on activeIndex change
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const activeEl = list.querySelector('[data-active="true"]') as HTMLElement | null;
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <CommandPaletteContext.Provider value={{ open: openPalette, close: closePalette }}>
      {children}

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
            onClick={closePalette}
            aria-hidden="true"
          />

          {/* Modal */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="fixed left-1/2 top-[20%] z-[9999] w-full max-w-lg -translate-x-1/2 rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-200"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls="command-palette-list"
                aria-autocomplete="list"
                aria-activedescendant={
                  filtered[activeIndex] ? `cmd-${filtered[activeIndex].id}` : undefined
                }
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                placeholder={t('placeholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                type="button"
                onClick={closePalette}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close command palette"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Results */}
            <div
              id="command-palette-list"
              ref={listRef}
              role="listbox"
              className="max-h-[360px] overflow-y-auto py-2"
              aria-label="Commands"
            >
              {filtered.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {t('noResults')}
                </p>
              )}

              {actionItems.length > 0 && (
                <>
                  <p
                    className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                    aria-hidden="true"
                  >
                    {t('sections.actions')}
                  </p>
                  {actionItems.map((item) => {
                    const globalIdx = filtered.indexOf(item);
                    const isActive = globalIdx === activeIndex;
                    return (
                      <CommandListItem
                        key={item.id}
                        item={item}
                        isActive={isActive}
                        onMouseEnter={() => setActiveIndex(globalIdx)}
                      />
                    );
                  })}
                </>
              )}

              {navItems.length > 0 && (
                <>
                  <p
                    className="px-4 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1"
                    aria-hidden="true"
                  >
                    {t('sections.navigation')}
                  </p>
                  {navItems.map((item) => {
                    const globalIdx = filtered.indexOf(item);
                    const isActive = globalIdx === activeIndex;
                    return (
                      <CommandListItem
                        key={item.id}
                        item={item}
                        isActive={isActive}
                        onMouseEnter={() => setActiveIndex(globalIdx)}
                      />
                    );
                  })}
                </>
              )}
            </div>

            {/* Footer hint */}
            <div className="border-t border-border px-4 py-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-xs">↑↓</kbd>{' '}
                navigate
              </span>
              <span>
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-xs">↵</kbd>{' '}
                select
              </span>
              <span>
                <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-xs">Esc</kbd>{' '}
                close
              </span>
            </div>
          </div>
        </>
      )}
    </CommandPaletteContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// List item
// ---------------------------------------------------------------------------

interface CommandListItemProps {
  item: CommandItem;
  isActive: boolean;
  onMouseEnter: () => void;
}

function CommandListItem({ item, isActive, onMouseEnter }: CommandListItemProps) {
  return (
    <button
      id={`cmd-${item.id}`}
      type="button"
      role="option"
      aria-selected={isActive}
      data-active={isActive}
      className={[
        'flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left',
        isActive ? 'bg-accent text-foreground' : 'text-foreground hover:bg-accent/50',
      ].join(' ')}
      onClick={item.onSelect}
      onMouseEnter={onMouseEnter}
    >
      <span className="shrink-0 text-muted-foreground" aria-hidden="true">
        {item.icon}
      </span>
      <span>{item.label}</span>
    </button>
  );
}
