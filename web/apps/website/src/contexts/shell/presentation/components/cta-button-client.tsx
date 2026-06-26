'use client';

import { Button } from '@causeflow/ui/primitives';

interface CTAButtonClientProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'outline' | 'default' | 'ghost' | 'link' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function CTAButtonClient({
  onClick,
  children,
  variant = 'outline',
  size = 'lg',
  className,
}: CTAButtonClientProps) {
  return (
    <Button variant={variant} size={size} className={className} onClick={onClick} type="button">
      {children}
    </Button>
  );
}
