'use client';

import { useEffect, useState } from 'react';
import { cn } from '../../../../lib/utils';
import { useAnimateOnScroll } from '../hooks/use-animate-on-scroll';

interface TypingAnimationProps {
  lines: string[];
  lineDelay?: number;
  className?: string;
}

export function TypingAnimation({ lines, lineDelay = 300, className }: TypingAnimationProps) {
  const { ref, isVisible } = useAnimateOnScroll<HTMLDivElement>();
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    let current = 0;
    const interval = setInterval(() => {
      current++;
      setVisibleLines(current);
      if (current >= lines.length) clearInterval(interval);
    }, lineDelay);

    return () => clearInterval(interval);
  }, [isVisible, lines.length, lineDelay]);

  return (
    <div
      ref={ref}
      className={cn(
        'overflow-x-auto rounded-lg bg-slate-950 p-6 font-mono text-sm text-slate-300',
        className,
      )}
    >
      {lines.map((line, i) => (
        <div
          key={`${i}-${line}`}
          className={cn(
            'whitespace-pre transition-opacity duration-300',
            i < visibleLines ? 'opacity-100' : 'opacity-0',
          )}
        >
          {line}
        </div>
      ))}
    </div>
  );
}
