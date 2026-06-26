/**
 * Investigation Application Services
 *
 * Orchestrates incident lifecycle and AI simulation workflows.
 * Re-exports the public API for use by API route handlers.
 */

export { simulateIncident } from './incident-simulator';
export type { IncidentTemplate, IncidentTimelineEvent } from './incident-templates';
export {
  DEFAULT_TEMPLATE,
  generateTimestamps,
  INCIDENT_TEMPLATES,
  selectTemplate,
} from './incident-templates';
