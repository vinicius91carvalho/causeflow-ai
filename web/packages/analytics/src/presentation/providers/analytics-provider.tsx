'use client';

import Script from 'next/script';
import { createContext, type ReactNode, useCallback, useMemo } from 'react';
import type { AnalyticsConfig, AnalyticsEvent } from '../../domain/types/events';
import { trackGA4Event } from '../../infrastructure/ga4';

export interface AnalyticsContextValue {
  track: (event: AnalyticsEvent) => void;
}

export const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

interface AnalyticsProviderProps {
  config: AnalyticsConfig;
  children: ReactNode;
}

/**
 * Inline gtag bootstrap — runs after the gtag.js script loads.
 * Keeps dataLayer initialisation out of the critical path.
 * Input is sourced exclusively from server-controlled env vars, not user data.
 */
function ga4InlineScript(measurementId: string): string {
  return [
    'window.dataLayer = window.dataLayer || [];',
    'function gtag(){dataLayer.push(arguments);}',
    "gtag('js', new Date());",
    `gtag('config', '${measurementId}', { send_page_view: false });`,
  ].join('\n');
}

/**
 * Inline Clarity bootstrap — queues calls until clarity.ms/tag script loads.
 * Input is sourced exclusively from server-controlled env vars, not user data.
 */
function clarityInlineScript(clarityId: string): string {
  return [
    '(function(c,l,a,r,i,t,y){',
    '  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};',
    '  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;',
    '  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);',
    `})(window,document,"clarity","script","${clarityId}");`,
  ].join('\n');
}

interface GA4ScriptsProps {
  measurementId: string;
}

/** Renders GA4 scripts with lazyOnload strategy — keeps them off the critical path. */
function GA4Scripts({ measurementId }: GA4ScriptsProps) {
  const html = ga4InlineScript(measurementId);
  return (
    <>
      {/* lazyOnload: deferred until page is idle — eliminates GA4 long task from TBT */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="lazyOnload"
      />
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static string from server env vars, not user input */}
      <Script id="ga4-init" strategy="lazyOnload" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}

interface ClarityScriptProps {
  clarityId: string;
}

/** Renders Clarity script with lazyOnload strategy — keeps it off the critical path. */
function ClarityScript({ clarityId }: ClarityScriptProps) {
  const html = clarityInlineScript(clarityId);
  return (
    /* biome-ignore lint/security/noDangerouslySetInnerHtml: static string from server env vars, not user input */
    <Script id="clarity-init" strategy="lazyOnload" dangerouslySetInnerHTML={{ __html: html }} />
  );
}

/**
 * AnalyticsProvider wraps the application and injects GA4 + Clarity scripts
 * with strategy="lazyOnload" so they load after the page is fully interactive,
 * removing them from the TBT measurement window.
 * Provides a typed `track` function to all descendants via React context.
 */
export function AnalyticsProvider({ config, children }: AnalyticsProviderProps) {
  const track = useCallback(
    (event: AnalyticsEvent) => {
      if (!config.enabled) return;

      if (config.ga4MeasurementId) {
        trackGA4Event(event);
      }
    },
    [config.enabled, config.ga4MeasurementId],
  );

  const value = useMemo<AnalyticsContextValue>(() => ({ track }), [track]);

  return (
    <AnalyticsContext.Provider value={value}>
      {config.enabled && config.ga4MeasurementId && (
        <GA4Scripts measurementId={config.ga4MeasurementId} />
      )}
      {config.enabled && config.clarityId && <ClarityScript clarityId={config.clarityId} />}
      {children}
    </AnalyticsContext.Provider>
  );
}
