import { describe, it, expect } from 'vitest';
import { ACTION_CATALOG, buildAvailableActionsPrompt } from '../../../../src/modules/investigation/domain/action-catalog.js';

describe('action-catalog', () => {
  describe('ACTION_CATALOG', () => {
    it('contains all expected core actions', () => {
      const expectedActions = [
        'restart_service',
        'increase_memory_limit',
        'scale_horizontal',
        'increase_pool_size',
        'enable_connection_timeout',
        'scale_database',
        'rollback_deployment',
        'enable_circuit_breaker',
        'create_fix_pr',
        'escalate_to_oncall',
        'invalidate_cache',
      ];
      for (const action of expectedActions) {
        expect(ACTION_CATALOG[action]).toBeDefined();
      }
    });

    it('every action has required metadata fields', () => {
      for (const [id, def] of Object.entries(ACTION_CATALOG)) {
        expect(def.label, `${id} missing label`).toBeTruthy();
        expect(def.description, `${id} missing description`).toBeTruthy();
        expect(['low', 'medium', 'high'], `${id} invalid riskLevel`).toContain(def.riskLevel);
        expect(def.estimatedDuration, `${id} missing estimatedDuration`).toBeTruthy();
        expect(Array.isArray(def.requiresParams), `${id} requiresParams not array`).toBe(true);
      }
    });

    it('create_fix_pr has no required params', () => {
      expect(ACTION_CATALOG['create_fix_pr']!.requiresParams).toEqual([]);
    });

    it('restart_service requires service param', () => {
      expect(ACTION_CATALOG['restart_service']!.requiresParams).toContain('service');
    });
  });

  describe('buildAvailableActionsPrompt', () => {
    it('returns a non-empty string listing all actions', () => {
      const prompt = buildAvailableActionsPrompt();
      expect(prompt).toContain('Actions the system can execute automatically');
      expect(prompt).toContain('restart_service');
      expect(prompt).toContain('create_fix_pr');
      expect(prompt).toContain('risk:');
    });

    it('includes every catalog action in the prompt', () => {
      const prompt = buildAvailableActionsPrompt();
      for (const id of Object.keys(ACTION_CATALOG)) {
        expect(prompt, `missing action ${id}`).toContain(id);
      }
    });
  });
});
