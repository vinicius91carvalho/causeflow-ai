import { describe, it, expect } from 'vitest';
import { CHANGE_DETECTOR_CONFIG, AGENT_CONFIG_MAP } from '../../../../src/modules/investigation/application/agent-configs.js';
import { CHANGE_DETECTION_TOOLS } from '../../../../src/modules/investigation/infra/investigation-tools.js';

describe('Change Detector Sub-Agent', () => {
  describe('CHANGE_DETECTOR_CONFIG', () => {
    it('should have correct agent role', () => {
      expect(CHANGE_DETECTOR_CONFIG.agentRole).toBe('change_detector');
    });

    it('should have a static system prompt focused on change detection', () => {
      const prompt = CHANGE_DETECTOR_CONFIG.staticSystemPrompt ?? CHANGE_DETECTOR_CONFIG.systemPrompt;
      expect(prompt).toContain('change detection');
      expect(prompt).toContain('deployments');
      expect(prompt).toContain('configuration changes');
    });

    it('should include CHANGE_DETECTION_TOOLS', () => {
      const toolNames = CHANGE_DETECTOR_CONFIG.tools.map(t => t.name);
      // Must include all base change detection tools
      for (const tool of CHANGE_DETECTION_TOOLS) {
        expect(toolNames).toContain(tool.name);
      }
      expect(toolNames).toContain('aws_api_call');
    });

    it('should have maxTurns set to 8', () => {
      expect(CHANGE_DETECTOR_CONFIG.maxTurns).toBe(8);
    });
  });

  describe('CHANGE_DETECTION_TOOLS', () => {
    it('should include aws_api_call and memory tools (GitHub now via Composio)', () => {
      const toolNames = CHANGE_DETECTION_TOOLS.map((t) => t.name);
      expect(toolNames).toContain('aws_api_call');
      expect(toolNames).toContain('get_incident_details');
      expect(toolNames).toContain('recall_past_incidents');
      expect(toolNames).toContain('remember_finding');
      expect(toolNames).toContain('get_service_topology');
      expect(toolNames).toContain('get_recent_changes');
      expect(toolNames).toContain('check_remediation_history');
      // GitHub tools removed — now handled by Composio
      expect(toolNames).not.toContain('get_recent_commits');
    });

    it('should have 7 base tools defined (1 aws_api_call + 1 incident + 5 memory)', () => {
      expect(CHANGE_DETECTION_TOOLS).toHaveLength(7);
    });

    it('should have required fields in inputSchema for each tool', () => {
      for (const tool of CHANGE_DETECTION_TOOLS) {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect((tool.inputSchema as Record<string, unknown>)['type']).toBe('object');
      }
    });
  });

  describe('AGENT_CONFIG_MAP', () => {
    it('should include change_detector in the config map', () => {
      expect(AGENT_CONFIG_MAP['change_detector']).toBeDefined();
      expect(AGENT_CONFIG_MAP['change_detector']).toBe(CHANGE_DETECTOR_CONFIG);
    });

    it('should have 12 agent configs including code_analyzer and db_analyst for OSS local pipeline', () => {
      expect(Object.keys(AGENT_CONFIG_MAP)).toHaveLength(12);
      expect(Object.keys(AGENT_CONFIG_MAP)).toEqual(
        expect.arrayContaining([
          'orchestrator',
          'scout',
          'log_analyst',
          'metric_analyst',
          'infra_inspector',
          'change_detector',
          'code_analyzer',
          'db_analyst',
          'issue_correlator',
          'apm_analyst',
          'notification_sender',
          'diagnosis_verifier',
        ]),
      );
    });
  });
});
