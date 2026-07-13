'use client';
import { cn } from '@causeflow/ui/lib';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@causeflow/ui/primitives';
import { Link } from '@/i18n/navigation';

interface PricingCardProps {
  name: string;
  price: string;
  period?: string;
  description: string;
  rateLimit?: string;
  features: string[];
  cta: { label: string; href: string; external?: boolean };
  highlighted?: boolean;
  badge?: string;
  className?: string;
  selected?: boolean;
  onSelect?: () => void;
  onCtaClick?: () => void;
}

export function PricingCard({
  name,
  price,
  period = '/month',
  description,
  rateLimit,
  features,
  cta,
  highlighted,
  badge,
  className,
  selected,
  onSelect,
  onCtaClick,
}: PricingCardProps) {
  return (
    <Card
      onClick={onSelect}
      className={cn(
        'group flex h-full flex-col cursor-pointer transition-shadow hover:-translate-y-1 hover:bg-accent hover:border-accent hover:shadow-lg hover:shadow-accent/20',
        highlighted &&
          'border-emerald-500 bg-emerald-600 text-white shadow-lg ring-1 ring-emerald-500 hover:bg-emerald-700 hover:border-emerald-600 hover:ring-0 hover:shadow-emerald-500/20',
        selected && !highlighted && 'ring-2 ring-primary border-primary',
        className,
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle
            className={cn(
              'text-xl transition-colors duration-300 group-hover:text-accent-foreground',
              highlighted && 'text-white',
            )}
          >
            {name}
          </CardTitle>
          {badge && (
            <Badge variant="secondary" className={cn(highlighted && 'bg-white/20 text-white')}>
              {badge}
            </Badge>
          )}
        </div>
        <div className="mt-4 relative">
          <span
            className={cn(
              'text-4xl font-bold transition-colors duration-300 group-hover:text-accent-foreground',
              highlighted && 'text-white',
            )}
          >
            {price}
          </span>
          {price !== 'Custom' && (
            <span
              className={cn(
                'text-muted-foreground transition-colors duration-300 group-hover:text-accent-foreground/80',
                highlighted && 'text-white/80',
              )}
            >
              {period}
            </span>
          )}
        </div>
        <CardDescription
          className={cn(
            'mt-2 transition-colors duration-300 group-hover:text-accent-foreground/80',
            highlighted && 'text-white/80',
          )}
        >
          {description}
          {rateLimit && <span className="block mt-1 text-xs opacity-75">{rateLimit}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-2">
          {features.map((f) => (
            <li
              key={f}
              className={cn(
                'flex items-start gap-2 text-sm transition-colors duration-300 group-hover:text-accent-foreground/80',
                highlighted && 'text-white/80',
              )}
            >
              <svg
                aria-hidden="true"
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0 text-emerald-500 transition-colors duration-300 group-hover:text-accent-foreground',
                  highlighted && 'text-white',
                )}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              {f}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {onCtaClick ? (
          <Button
            variant={highlighted ? 'default' : 'outline'}
            className={cn(
              'w-full transition-colors duration-300 group-hover:bg-accent-foreground group-hover:text-accent group-hover:border-accent-foreground',
              highlighted &&
                'border-white bg-white text-emerald-700 hover:bg-white/90 hover:text-emerald-800',
            )}
            onClick={(e) => {
              e.stopPropagation();
              onCtaClick();
            }}
          >
            {cta.label}
          </Button>
        ) : cta.external ? (
          <Button
            asChild
            variant={highlighted ? 'default' : 'outline'}
            className={cn(
              'w-full transition-colors duration-300 group-hover:bg-accent-foreground group-hover:text-accent group-hover:border-accent-foreground',
              highlighted &&
                'border-white bg-white text-emerald-700 hover:bg-white/90 hover:text-emerald-800',
            )}
          >
            <a
              href={cta.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {cta.label}
            </a>
          </Button>
        ) : (
          <Link href={cta.href} className="w-full" onClick={(e) => e.stopPropagation()}>
            <Button
              variant={highlighted ? 'default' : 'outline'}
              className={cn(
                'w-full transition-colors duration-300 group-hover:bg-accent-foreground group-hover:text-accent group-hover:border-accent-foreground',
                highlighted &&
                  'border-white bg-white text-emerald-700 hover:bg-white/90 hover:text-emerald-800',
              )}
            >
              {cta.label}
            </Button>
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}
