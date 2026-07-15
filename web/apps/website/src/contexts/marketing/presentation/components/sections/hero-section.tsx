import { cn } from '@causeflow/ui/lib';
import { Button } from '@causeflow/ui/primitives';
import { CTAButtonClient } from '@/contexts/shell/presentation/components/cta-button-client';
import { Link } from '@/i18n/navigation';

interface HeroSectionProps {
  badge?: string;
  title: string;
  subtitle: string;
  primaryCta?: { label: string; href: string; external?: boolean };
  secondaryCta?: { label: string; href: string; onClick?: () => void; external?: boolean };
  trustText?: string;
  variant?: 'dark' | 'light';
  children?: React.ReactNode;
  className?: string;
}

export function HeroSection({
  badge,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  trustText,
  variant = 'dark',
  children,
  className,
}: HeroSectionProps) {
  const isDark = variant === 'dark';
  // Dark variant — gradient of ink + teal radial glow + violet radial accent.
  // User directive: soften flat dark-blue; match template cta-card glow language.
  const darkBgStyle: React.CSSProperties = isDark
    ? {
        background: [
          'radial-gradient(ellipse 60% 60% at 85% 10%, hsl(var(--accent) / 0.18), transparent 60%)',
          'radial-gradient(ellipse 50% 60% at 15% 90%, hsl(var(--violet) / 0.14), transparent 60%)',
          'linear-gradient(180deg, hsl(var(--foreground)) 0%, hsl(232 45% 8%) 100%)',
        ].join(','),
      }
    : {};
  return (
    <section
      style={darkBgStyle}
      className={cn(
        'relative overflow-hidden px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28',
        isDark ? 'text-white' : 'bg-background text-foreground',
        className,
      )}
    >
      <div className="relative mx-auto max-w-7xl">
        <div
          className={cn(
            'flex flex-col gap-8',
            children ? 'lg:flex-row lg:items-center lg:gap-16' : 'items-center text-center',
          )}
        >
          <div className={cn('flex-1', children ? '' : 'max-w-3xl mx-auto')}>
            {badge && (
              <span
                className={cn(
                  'mb-6 inline-block rounded-full border px-5 py-2 text-sm font-semibold',
                  isDark
                    ? 'border-accent/40 bg-accent/10 text-teal-400'
                    : 'border-accent/30 bg-accent/5 text-accent',
                )}
              >
                {badge}
              </span>
            )}
            <h1 className="whitespace-pre-line text-xl font-bold tracking-tight break-words sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl">
              {title}
            </h1>
            <p
              className={cn(
                'mt-6 text-base leading-relaxed sm:text-lg',
                isDark ? 'text-slate-300' : 'text-muted-foreground',
              )}
            >
              {subtitle}
            </p>
            {(primaryCta || secondaryCta) && (
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
                {primaryCta &&
                  (primaryCta.external ? (
                    <a href={primaryCta.href} target="_blank" rel="noopener noreferrer">
                      <Button size="lg" className="w-full sm:w-auto">
                        {primaryCta.label}
                      </Button>
                    </a>
                  ) : (
                    <Link href={primaryCta.href}>
                      <Button size="lg" className="w-full sm:w-auto">
                        {primaryCta.label}
                      </Button>
                    </Link>
                  ))}
                {secondaryCta &&
                  (secondaryCta.onClick ? (
                    <CTAButtonClient onClick={secondaryCta.onClick} className="w-full sm:w-auto">
                      {secondaryCta.label}
                    </CTAButtonClient>
                  ) : secondaryCta.external ? (
                    <a href={secondaryCta.href} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="lg" className="w-full sm:w-auto">
                        {secondaryCta.label}
                      </Button>
                    </a>
                  ) : (
                    <Link href={secondaryCta.href}>
                      <Button variant="outline" size="lg" className="w-full sm:w-auto">
                        {secondaryCta.label}
                      </Button>
                    </Link>
                  ))}
              </div>
            )}
            {trustText && (
              <p
                className={cn('mt-4 text-sm', isDark ? 'text-slate-400' : 'text-muted-foreground')}
              >
                {trustText}
              </p>
            )}
          </div>
          {children && <div className="flex-1">{children}</div>}
        </div>
      </div>
    </section>
  );
}
