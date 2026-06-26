/**
 * BudgetBar — horizontal 5000 ms budget visualization.
 *
 * Segments:
 *   0–coldStartMs  = cold start (warm gray)
 *   coldStartMs–totalMs = remaining fetch window (amber/red)
 *
 * Three tick marks show where the .webp fetches hit the wall.
 * The fill animation is CSS keyframe; it is disabled when the user
 * prefers reduced motion via the `motion-safe:` Tailwind variant.
 *
 * All numeric labels come from props — no hardcoded numbers in JSX.
 */

export interface BudgetBarTick {
  label: string;
  /** Absolute ms from start — used to position the tick. */
  ms: number;
}

export interface BudgetBarProps {
  totalMs: number;
  coldStartMs: number;
  ticks: BudgetBarTick[];
  coldStartLabel: string;
  remainingLabel: string;
  budgetLabel: string;
  /** Fully-formatted legend label (e.g. "3× .webp fetch"). Already interpolated. */
  fetchLegendLabel: string;
}

export function BudgetBar({
  totalMs,
  coldStartMs,
  ticks,
  coldStartLabel,
  remainingLabel,
  budgetLabel,
  fetchLegendLabel,
}: BudgetBarProps) {
  const coldPct = (coldStartMs / totalMs) * 100;
  const remainPct = 100 - coldPct;

  return (
    <div className="w-full space-y-3">
      {/* Budget label */}
      <div className="flex items-center justify-between text-[12px] font-mono text-muted-foreground">
        <span>0 ms</span>
        <span className="font-semibold text-foreground">{budgetLabel}</span>
      </div>

      {/* Bar track */}
      <div
        aria-hidden="true"
        className="relative h-10 w-full overflow-hidden rounded-lg bg-muted/40"
      >
        {/* Cold-start segment */}
        <div
          className="absolute inset-y-0 left-0 flex items-center justify-center overflow-hidden rounded-l-lg bg-muted motion-safe:animate-[budget-fill_1.2s_ease-out_both]"
          style={{ width: `${coldPct}%` }}
        >
          <span className="truncate px-2 font-mono text-[11px] font-semibold text-muted-foreground">
            {coldStartLabel}
          </span>
        </div>

        {/* Remaining fetch window segment */}
        <div
          className="absolute inset-y-0 flex items-center justify-center overflow-hidden bg-amber-500/20 motion-safe:animate-[budget-fill_1.2s_ease-out_0.3s_both]"
          style={{ left: `${coldPct}%`, width: `${remainPct}%` }}
        >
          <span className="truncate px-2 font-mono text-[11px] font-semibold text-amber-700 dark:text-amber-400">
            {remainingLabel}
          </span>
        </div>

        {/* Tick marks for .webp fetches */}
        {ticks.map((tick) => {
          const tickPct = (tick.ms / totalMs) * 100;
          return (
            <div
              key={tick.label}
              className="absolute inset-y-0 w-px bg-red-500/70"
              style={{ left: `${Math.min(tickPct, 99.5)}%` }}
            />
          );
        })}
      </div>

      {/* Tick labels below bar */}
      <div className="relative h-6">
        {ticks.map((tick, i) => {
          const tickPct = (tick.ms / totalMs) * 100;
          return (
            <span
              key={tick.label}
              className="absolute -translate-x-1/2 font-mono text-[10px] text-red-500"
              style={{ left: `${Math.min(tickPct, 97)}%`, top: `${i * 0}px` }}
            >
              ↑ {tick.label}
            </span>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 pt-1 text-[12px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-muted" />
          {coldStartLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500/40" />
          {remainingLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-0.5 bg-red-500/70" />
          {ticks.length > 1 ? fetchLegendLabel : ticks[0]?.label}
        </span>
      </div>
    </div>
  );
}
