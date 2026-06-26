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

export function TechLogoCarousel({ title, rows, className }: TechLogoCarouselProps) {
  return (
    <section className={cn('overflow-hidden py-12', className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {title && <p className="mb-8 text-center text-sm text-muted-foreground">{title}</p>}
        <div className="flex flex-col gap-6">
          {rows.map((row, rowIndex) => (
            <div
              key={`${row.logos[0]?.name ?? rowIndex}-${row.direction ?? 'ltr'}`}
              className="relative"
            >
              <div
                className={cn(
                  'flex gap-12',
                  row.direction === 'ltr' ? 'animate-scroll-reverse' : 'animate-scroll',
                )}
              >
                {[...row.logos, ...row.logos].map((logo, i) => (
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
          ))}
        </div>
      </div>
    </section>
  );
}
