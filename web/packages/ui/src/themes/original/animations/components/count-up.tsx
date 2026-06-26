'use client';

import { useEffect, useState } from 'react';
import { useAnimateOnScroll } from '../hooks/use-animate-on-scroll';

interface CountUpProps {
  end: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
  localeFormat?: boolean;
}

export function CountUp({
  end,
  prefix = '',
  suffix = '',
  duration = 2000,
  className,
  localeFormat = false,
}: CountUpProps) {
  const { ref, isVisible } = useAnimateOnScroll<HTMLSpanElement>();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isVisible) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setCount(Math.round(eased * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isVisible, end, duration]);

  const displayValue = localeFormat ? count.toLocaleString() : count;

  return (
    <span ref={ref} className={className}>
      {prefix}
      {displayValue}
      {suffix}
    </span>
  );
}
