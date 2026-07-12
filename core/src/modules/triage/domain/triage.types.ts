import type { Incident, InvestigationMode } from '../../ingestion/domain/incident.entity.js';
import type { Severity } from '../../../shared/domain/types.js';
export type IncidentCategory =
  | 'infrastructure'
  | 'application'
  | 'deployment'
  | 'third_party'
  | 'database'
  | 'unknown';
export interface TriageResult {
  priority: Severity;
  category: IncidentCategory;
  suggestedAgents: string[];
  summary: string;
  confidence: number;
  investigationMode: InvestigationMode;
}
export interface TriageInput {
  incident: Incident;
  historicalContext?: string;
}
export interface TriageEvidence {
  agentRole: 'coordinator';
  evidenceType: 'agent_reasoning';
  reasoning: string;
  confidence: number;
}
