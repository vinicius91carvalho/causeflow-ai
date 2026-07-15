/**
 * driver.js highlight configurations per onboarding step.
 * Each config targets a sidebar nav item via data-tour attributes.
 */

export interface StepHighlightConfig {
  element: string;
  title: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

/**
 * Highlight configs for navigable onboarding steps.
 * Keys match StepKey values that have corresponding dashboard pages.
 */
export const STEP_HIGHLIGHT_CONFIGS: Record<string, StepHighlightConfig> = {
  integrations: {
    element: '[data-tour="nav-integrations"]',
    title: 'Connect Evidence Sources',
    description:
      'Link your monitoring tools — Slack, GitHub, AWS CloudWatch, and more. These feed data into your investigations.',
    side: 'right',
    align: 'center',
  },
  relay: {
    element: '[data-tour="nav-relay"]',
    title: 'Deploy Field Agent',
    description: 'Set up the CauseFlow Relay to stream real-time events from your infrastructure.',
    side: 'right',
    align: 'center',
  },
  firstIncident: {
    element: '[data-tour="nav-incidents"]',
    title: 'Open First Case',
    description:
      'Create your first incident investigation. CauseFlow AI will analyze connected data sources to find root causes.',
    side: 'right',
    align: 'center',
  },
  receiveEvents: {
    element: '[data-tour="nav-integrations"]',
    title: 'Incoming Intel',
    description:
      'Once integrations are connected, events flow in automatically. Check the integrations page to see live data.',
    side: 'right',
    align: 'center',
  },
};
