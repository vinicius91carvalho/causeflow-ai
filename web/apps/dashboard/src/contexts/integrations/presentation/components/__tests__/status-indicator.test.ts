import { describe, expect, it } from 'vitest';
import type { IntegrationStatus } from '@/contexts/integrations/domain/types';

/**
 * Unit tests for status indicator logic.
 * Tests status label mapping and CSS class assignment
 * without rendering the component.
 */

type StatusConfig = {
  dotClass: string;
  isAnimated: boolean;
};

// Mirrors semantic token mapping from status-indicator.tsx (Sprint 04 DS enforcement)
function getStatusConfig(status: IntegrationStatus): StatusConfig {
  switch (status) {
    case 'connected':
      return { dotClass: 'bg-success/50', isAnimated: false };
    case 'error':
      return { dotClass: 'bg-destructive/50', isAnimated: true };
    case 'disconnected':
      return { dotClass: 'bg-muted', isAnimated: false };
  }
}

describe('StatusIndicator logic', () => {
  describe('connected status', () => {
    it('uses green dot class', () => {
      expect(getStatusConfig('connected').dotClass).toBe('bg-success/50');
    });

    it('is not animated', () => {
      expect(getStatusConfig('connected').isAnimated).toBe(false);
    });
  });

  describe('error status', () => {
    it('uses red dot class', () => {
      expect(getStatusConfig('error').dotClass).toBe('bg-destructive/50');
    });

    it('is animated (pulsing)', () => {
      expect(getStatusConfig('error').isAnimated).toBe(true);
    });
  });

  describe('disconnected status', () => {
    it('uses muted token dot class', () => {
      expect(getStatusConfig('disconnected').dotClass).toBe('bg-muted');
    });

    it('is not animated', () => {
      expect(getStatusConfig('disconnected').isAnimated).toBe(false);
    });
  });

  describe('all statuses', () => {
    const allStatuses: IntegrationStatus[] = ['connected', 'error', 'disconnected'];

    it('each status has a non-empty dot class', () => {
      for (const status of allStatuses) {
        expect(getStatusConfig(status).dotClass).toBeTruthy();
      }
    });

    it('only error status is animated', () => {
      for (const status of allStatuses) {
        const { isAnimated } = getStatusConfig(status);
        if (status === 'error') {
          expect(isAnimated).toBe(true);
        } else {
          expect(isAnimated).toBe(false);
        }
      }
    });
  });
});
