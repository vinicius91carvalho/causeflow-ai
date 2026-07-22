import { cn } from '@causeflow/ui/lib';

interface LogoItem {
  name: string;
  icon?: React.ReactNode;
}

interface LogoRow {
  logos: LogoItem[];
  direction?: 'rtl' | 'ltr';
}

interface TechLogoCarouselProps {
  title?: string;
  rows: LogoRow[];
  className?: string;
}

/**
 * How many copies of the logo set make up one seamless half of the track.
 * Animation uses translateX(±50%), so each half must be wider than typical
 * ultra-wide / 4K viewports (~3840–5120px) to avoid empty gaps.
 */
/** Exported for unit tests — keep in sync with ultra-wide coverage needs. */
export const SETS_PER_HALF = 4;

export function buildSeamlessTrack(logos: LogoItem[]): LogoItem[] {
  if (logos.length === 0) return [];
  const half = Array.from({ length: SETS_PER_HALF }, () => logos).flat();
  return [...half, ...half];
}

export function TechLogoCarousel({ title, rows, className }: TechLogoCarouselProps) {
  return (
    <section className={cn('relative overflow-hidden py-12', className)}>
      {title && (
        <p className="mx-auto mb-8 max-w-7xl px-4 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
          {title}
        </p>
      )}

      {/* Full-bleed track — not constrained to max-w-7xl so 4K/ultrawide fills edge-to-edge */}
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent sm:w-24 lg:w-32"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent sm:w-24 lg:w-32"
        />

        <div className="flex flex-col gap-6">
          {rows.map((row, rowIndex) => {
            const track = buildSeamlessTrack(row.logos);
            return (
              <div
                key={`${row.logos[0]?.name ?? rowIndex}-${row.direction ?? 'ltr'}`}
                className="relative overflow-hidden"
              >
                <div
                  className={cn(
                    'flex w-max gap-12 pr-12',
                    row.direction === 'ltr' ? 'animate-scroll-reverse' : 'animate-scroll',
                  )}
                >
                  {track.map((logo, i) => (
                    <div
                      key={`${logo.name}-${i}`}
                      className="flex shrink-0 items-center gap-2 text-muted-foreground"
                    >
                      {logo.icon}
                      <span className="text-sm font-medium whitespace-nowrap text-foreground/80">
                        {logo.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
