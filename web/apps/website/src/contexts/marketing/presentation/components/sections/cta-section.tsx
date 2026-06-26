import { cn } from '@causeflow/ui/lib';
import { Button } from '@causeflow/ui/primitives';
import { CTAButtonClient } from '@/contexts/shell/presentation/components/cta-button-client';
import { Link } from '@/i18n/navigation';

interface CTASectionProps {
  title: string;
  subtitle?: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string; onClick?: () => void };
  className?: string;
}

export function CTASection({
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  className,
}: CTASectionProps) {
  return (
    <section
      className={cn(
        'relative overflow-hidden bg-slate-950 px-4 py-16 text-center text-white sm:px-6 sm:py-20 lg:px-8 lg:py-24',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-1/3 left-1/3 h-[400px] w-[400px] rounded-full bg-accent/5 blur-[100px]" />
        <div className="absolute -bottom-1/4 right-1/4 h-[300px] w-[300px] rounded-full bg-chart-4/5 blur-[100px]" />
      </div>
      <div className="relative mx-auto max-w-3xl">
        <h2 className="text-2xl font-bold sm:text-3xl lg:text-4xl">{title}</h2>
        {subtitle && <p className="mt-4 text-slate-300">{subtitle}</p>}
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
          <Link href={primaryCta.href}>
            <Button size="lg">{primaryCta.label}</Button>
          </Link>
          {secondaryCta &&
            (secondaryCta.onClick ? (
              <CTAButtonClient onClick={secondaryCta.onClick}>{secondaryCta.label}</CTAButtonClient>
            ) : (
              <Link href={secondaryCta.href}>
                <Button variant="outline" size="lg">
                  {secondaryCta.label}
                </Button>
              </Link>
            ))}
        </div>
      </div>
    </section>
  );
}
