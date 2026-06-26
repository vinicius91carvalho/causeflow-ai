// Domain
export type { AnalyticsConfig, AnalyticsEvent } from './domain/types/events';
export { initClarity } from './infrastructure/clarity';
// Infrastructure
export { initGA4, trackGA4Event, trackGA4PageView } from './infrastructure/ga4';
export { useTrackEvent } from './presentation/hooks/use-track-event';
export type { AnalyticsContextValue } from './presentation/providers/analytics-provider';
// Presentation
export { AnalyticsContext, AnalyticsProvider } from './presentation/providers/analytics-provider';
