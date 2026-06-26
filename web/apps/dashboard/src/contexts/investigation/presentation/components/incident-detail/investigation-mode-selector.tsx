'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@causeflow/ui/primitives';
import { FlaskConical, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export type InvestigationModeName = 'orchestrator' | 'hypothesis' | 'debate';

interface InvestigationModeSelectorProps {
  /**
   * "Active" variant — renders a Run button and fires the callback on
   * click. Used inside the incident detail action bar where clicking
   * triggers the investigation immediately.
   *
   * Omit to use the "passive" variant below (dropdown only, parent
   * form owns the submit action).
   */
  onRun?: (mode: InvestigationModeName) => void;
  /** When `onRun` is set, disables the dropdown + Run while running. */
  isRunning?: boolean;
  /**
   * Passive variant — controlled dropdown. When `value` / `onChange`
   * are set, the component renders without a Run button and lets the
   * parent form own the submit + trigger. Useful on the "new incident"
   * form where the mode is stamped at creation time.
   */
  value?: InvestigationModeName;
  onChange?: (mode: InvestigationModeName) => void;
}

/**
 * Staff-only dropdown that lets internal users pick which reasoning
 * mode to drive the investigation with. Intentionally styled as a
 * subtle "lab" panel — tenant operators never see this component
 * (parent gates via `useIsStaff()` before rendering).
 *
 * Two variants controlled by which props are passed:
 *   - Active: `onRun` + (optional) `isRunning` → renders Run button.
 *   - Passive: `value` + `onChange` → dropdown only, parent owns action.
 */
export function InvestigationModeSelector({
  onRun,
  isRunning,
  value,
  onChange,
}: InvestigationModeSelectorProps) {
  const t = useTranslations('dashboard.incidents.detail.modeSelector');
  const [internalMode, setInternalMode] = useState<InvestigationModeName>('orchestrator');
  const mode: InvestigationModeName = value ?? internalMode;
  const setMode = (next: InvestigationModeName) => {
    if (onChange) onChange(next);
    else setInternalMode(next);
  };

  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 /20">
      <div className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
        {t('staffLabel')}
      </div>
      <Select
        value={mode}
        onValueChange={(value) => setMode(value as InvestigationModeName)}
        disabled={isRunning}
      >
        <SelectTrigger className="h-8 w-[200px] border-border bg-white text-xs dark:bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="orchestrator">
            <div className="flex flex-col items-start">
              <span className="text-xs font-medium">{t('orchestrator')}</span>
              <span className="text-[10px] text-muted-foreground">
                {t('orchestratorDescription')}
              </span>
            </div>
          </SelectItem>
          <SelectItem value="hypothesis">
            <div className="flex flex-col items-start">
              <span className="text-xs font-medium">{t('hypothesis')}</span>
              <span className="text-[10px] text-muted-foreground">
                {t('hypothesisDescription')}
              </span>
            </div>
          </SelectItem>
          <SelectItem value="debate">
            <div className="flex flex-col items-start">
              <span className="text-xs font-medium">{t('debate')}</span>
              <span className="text-[10px] text-muted-foreground">{t('debateDescription')}</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      {onRun ? (
        <button
          type="button"
          onClick={() => onRun(mode)}
          disabled={isRunning}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              {t('running')}
            </>
          ) : (
            t('run')
          )}
        </button>
      ) : null}
    </div>
  );
}
