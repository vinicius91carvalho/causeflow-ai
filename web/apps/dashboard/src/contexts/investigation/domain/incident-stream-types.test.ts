import { describe, expect, it } from 'vitest';
import { AGENT_ROLES, type AgentRole } from './incident-stream-types';

describe('incident-stream-types', () => {
  describe('AGENT_ROLES', () => {
    it('contains all 6 agent roles from the upstream Evidence schema', () => {
      expect(AGENT_ROLES).toHaveLength(6);
      expect(AGENT_ROLES).toContain('log_analyst');
      expect(AGENT_ROLES).toContain('metric_analyst');
      expect(AGENT_ROLES).toContain('infra_inspector');
      expect(AGENT_ROLES).toContain('orchestrator');
      expect(AGENT_ROLES).toContain('scout');
      expect(AGENT_ROLES).toContain('diagnosis_verifier');
    });

    it('exports a readonly tuple type compatible with AgentRole', () => {
      // Type-level check via assignment
      const role: AgentRole = 'log_analyst';
      expect(AGENT_ROLES.includes(role)).toBe(true);
    });
  });
});
