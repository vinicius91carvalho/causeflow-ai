'use client';

import { useContext } from 'react';
import type { AnalyticsEvent } from '../../domain/types/events';
import { AnalyticsContext } from '../providers/analytics-provider';

/**
 * Returns a typed `track` function for sending analytics events.
 * Must be used within an AnalyticsProvider.
 *
 * @example
 * ```tsx
 * const track = useTrackEvent();
 * track({ name: 'cta_click', properties: { cta_id: 'hero', cta_text: 'Get Started', page: '/' } });
 * ```
 */
export function useTrackEvent(): (event: AnalyticsEvent) => void {
  const context = useContext(AnalyticsContext);

  if (!context) {
    throw new Error('useTrackEvent must be used within an AnalyticsProvider');
  }

  return context.track;
}
