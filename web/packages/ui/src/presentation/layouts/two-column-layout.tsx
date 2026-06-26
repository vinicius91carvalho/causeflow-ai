'use client';

import type * as React from 'react';
import { cn } from '../../lib/utils';

interface TwoColumnLayoutProps {
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
  reversed?: boolean;
}

export function TwoColumnLayout({
  left,
  right,
  className,
  reversed = false,
}: TwoColumnLayoutProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-16',
        reversed && 'lg:flex-row-reverse',
        className,
      )}
    >
      <div className="flex-1">{left}</div>
      <div className="flex-1">{right}</div>
    </div>
  );
}
