'use client';

import { cn } from '../../../../lib/utils';
import { useAnimateOnScroll } from '../hooks/use-animate-on-scroll';

type AnimationVariant =
  | 'fade-up'
  | 'fade-in'
  | 'fade-left'
  | 'fade-right'
  | 'scale-up'
  | 'bounce-in'
  | 'depth-shift';

const variants: Record<AnimationVariant, { hidden: string; visible: string }> = {
  'fade-up': {
    hidden: 'opacity-0 translate-y-8',
    visible: 'opacity-100 translate-y-0',
  },
  'fade-in': {
    hidden: 'opacity-0',
    visible: 'opacity-100',
  },
  'fade-left': {
    hidden: 'opacity-0 -translate-x-8',
    visible: 'opacity-100 translate-x-0',
  },
  'fade-right': {
    hidden: 'opacity-0 translate-x-8',
    visible: 'opacity-100 translate-x-0',
  },
  'scale-up': {
    hidden: 'opacity-0 scale-95',
    visible: 'opacity-100 scale-100',
  },
  'bounce-in': {
    hidden: 'opacity-0 scale-[0.3]',
    visible: 'opacity-100 scale-100 animate-bounce-in',
  },
  'depth-shift': {
    hidden: 'opacity-0 translate-y-5 scale-[0.98]',
    visible: 'opacity-100 translate-y-0 scale-100',
  },
};

interface AnimateOnScrollProps {
  children: React.ReactNode;
  variant?: AnimationVariant;
  delay?: number;
  duration?: number;
  className?: string;
}

export function AnimateOnScroll({
  children,
  variant = 'fade-up',
  delay = 0,
  duration = 600,
  className,
}: AnimateOnScrollProps) {
  const { ref, isMounted, isVisible, alreadyVisible, prefersReducedMotion } =
    useAnimateOnScroll<HTMLDivElement>();
  const v = variants[variant];

  // Determine whether to skip animation (reduced motion or already in viewport)
  const skipAnimation = prefersReducedMotion || alreadyVisible;

  // SSR + first paint: render visible. Animation is a strictly post-hydration
  // progressive enhancement — never a gate on content being readable. This
  // fixes blank-below-the-fold pages for bots, slow JS, and disabled JS, and
  // guarantees Playwright full-page screenshots match real user output.
  const showAsVisible = !isMounted || skipAnimation || isVisible;

  return (
    <div
      ref={ref}
      className={cn(
        isMounted && !skipAnimation ? 'transition-all' : '',
        showAsVisible ? v.visible : v.hidden,
        className,
      )}
      style={
        isMounted && !skipAnimation
          ? {
              transitionDuration: `${duration}ms`,
              transitionDelay: `${delay}ms`,
              transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
