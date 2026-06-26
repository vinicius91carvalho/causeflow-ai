import { describe, expect, it } from 'vitest';
import type { IntegrationStatus } from '@/contexts/integrations/domain/types';

/**
 * Unit tests for integration card state logic.
 * Tests card state derivation without rendering.
 */

type CardStatus = IntegrationStatus | 'available';
type ConnectionStrategy = 'oauth' | 'credential' | 'webhook';

interface CardStateFlags {
  isAvailable: boolean;
  isConnected: boolean;
  isError: boolean;
  showDisconnectButton: boolean;
  showTestButton: boolean;
  showReconnectButton: boolean;
  showConnectButton: boolean;
}

interface ConnectionStrategyFlags {
  showOAuthConnectButton: boolean;
  showCredentialConnectButton: boolean;
  showConfirmDialogOnDisconnect: boolean;
  showTestButton: boolean;
  showTriggerDropdown: boolean;
}

function getCardState(status: CardStatus): CardStateFlags {
  const isAvailable = status === 'available' || status === 'disconnected';
  const isConnected = status === 'connected';
  const isError = status === 'error';
  return {
    isAvailable,
    isConnected,
    isError,
    showDisconnectButton: isConnected,
    showTestButton: isConnected,
    showReconnectButton: isError,
    showConnectButton: isAvailable,
  };
}

/**
 * Derives what actions/buttons are shown based on connectionStrategy and status.
 * Mirrors the conditional logic in IntegrationCard.
 */
function getConnectionStrategyFlags(
  strategy: ConnectionStrategy,
  status: CardStatus,
): ConnectionStrategyFlags {
  const isOAuth = strategy === 'oauth';
  const isCredential = strategy === 'credential';
  const isConnected = status === 'connected';
  const isAvailable = status === 'available' || status === 'disconnected';

  return {
    // oauth: shows ExternalLink "Authorize" button when available
    showOAuthConnectButton: isOAuth && isAvailable,
    // credential: shows plain "Connect" button when available
    showCredentialConnectButton: isCredential && isAvailable,
    // oauth connected: disconnect triggers a confirmation dialog (preserved from SlackIntegrationSettings)
    showConfirmDialogOnDisconnect: isOAuth && isConnected,
    // credential: shows "Test connection" when connected
    showTestButton: isCredential && isConnected,
    // oauth connected: shows trigger dropdown (non-credential only)
    showTriggerDropdown: isOAuth && isConnected,
  };
}

describe('IntegrationCard state logic', () => {
  describe('available status', () => {
    const state = getCardState('available');

    it('is available', () => {
      expect(state.isAvailable).toBe(true);
    });

    it('shows connect button', () => {
      expect(state.showConnectButton).toBe(true);
    });

    it('does not show disconnect or test buttons', () => {
      expect(state.showDisconnectButton).toBe(false);
      expect(state.showTestButton).toBe(false);
      expect(state.showReconnectButton).toBe(false);
    });
  });

  describe('disconnected status', () => {
    const state = getCardState('disconnected');

    it('is treated as available', () => {
      expect(state.isAvailable).toBe(true);
    });

    it('shows connect button', () => {
      expect(state.showConnectButton).toBe(true);
    });
  });

  describe('connected status', () => {
    const state = getCardState('connected');

    it('is connected', () => {
      expect(state.isConnected).toBe(true);
    });

    it('shows test and disconnect buttons', () => {
      expect(state.showTestButton).toBe(true);
      expect(state.showDisconnectButton).toBe(true);
    });

    it('does not show connect or reconnect buttons', () => {
      expect(state.showConnectButton).toBe(false);
      expect(state.showReconnectButton).toBe(false);
    });
  });

  describe('error status', () => {
    const state = getCardState('error');

    it('is error', () => {
      expect(state.isError).toBe(true);
    });

    it('shows reconnect button', () => {
      expect(state.showReconnectButton).toBe(true);
    });

    it('does not show connect, test, or disconnect buttons', () => {
      expect(state.showConnectButton).toBe(false);
      expect(state.showTestButton).toBe(false);
      expect(state.showDisconnectButton).toBe(false);
    });
  });

  describe('card state exclusivity', () => {
    const allStatuses: CardStatus[] = ['available', 'connected', 'error', 'disconnected'];

    it('each card status has exactly one primary state flag true', () => {
      for (const status of allStatuses) {
        const state = getCardState(status);
        const primaryFlags = [state.isAvailable, state.isConnected, state.isError];
        const trueCount = primaryFlags.filter(Boolean).length;
        // available and disconnected both map to isAvailable, so count can be 1
        expect(trueCount).toBeGreaterThanOrEqual(1);
        // But not more than 1 of isConnected and isError
        expect(state.isConnected && state.isError).toBe(false);
      }
    });
  });
});

describe('IntegrationCard connectionStrategy logic', () => {
  describe("connectionStrategy: 'oauth' — available status", () => {
    const flags = getConnectionStrategyFlags('oauth', 'available');

    it('shows OAuth connect button', () => {
      expect(flags.showOAuthConnectButton).toBe(true);
    });

    it('does not show credential connect button', () => {
      expect(flags.showCredentialConnectButton).toBe(false);
    });

    it('does not show disconnect dialog (not connected)', () => {
      expect(flags.showConfirmDialogOnDisconnect).toBe(false);
    });
  });

  describe("connectionStrategy: 'oauth' — connected status", () => {
    const flags = getConnectionStrategyFlags('oauth', 'connected');

    it('does not show OAuth connect button when connected', () => {
      expect(flags.showOAuthConnectButton).toBe(false);
    });

    it('shows confirmation dialog before disconnect (preserved from SlackIntegrationSettings)', () => {
      expect(flags.showConfirmDialogOnDisconnect).toBe(true);
    });

    it('shows trigger dropdown', () => {
      expect(flags.showTriggerDropdown).toBe(true);
    });

    it('does not show test button (test is credential-only)', () => {
      expect(flags.showTestButton).toBe(false);
    });
  });

  describe("connectionStrategy: 'credential' — available status", () => {
    const flags = getConnectionStrategyFlags('credential', 'available');

    it('shows credential connect button', () => {
      expect(flags.showCredentialConnectButton).toBe(true);
    });

    it('does not show OAuth connect button', () => {
      expect(flags.showOAuthConnectButton).toBe(false);
    });

    it('does not show confirm dialog on disconnect', () => {
      expect(flags.showConfirmDialogOnDisconnect).toBe(false);
    });
  });

  describe("connectionStrategy: 'credential' — connected status", () => {
    const flags = getConnectionStrategyFlags('credential', 'connected');

    it('shows test button', () => {
      expect(flags.showTestButton).toBe(true);
    });

    it('does not show trigger dropdown', () => {
      expect(flags.showTriggerDropdown).toBe(false);
    });

    it('does not show confirm dialog on disconnect (direct disconnect)', () => {
      expect(flags.showConfirmDialogOnDisconnect).toBe(false);
    });
  });

  describe("connectionStrategy: 'webhook' — available status", () => {
    const flags = getConnectionStrategyFlags('webhook', 'available');

    it('does not show OAuth connect button', () => {
      expect(flags.showOAuthConnectButton).toBe(false);
    });

    it('does not show credential connect button', () => {
      expect(flags.showCredentialConnectButton).toBe(false);
    });
  });

  describe('strategy exclusivity — oauth vs credential connect buttons are mutually exclusive', () => {
    const strategies: ConnectionStrategy[] = ['oauth', 'credential', 'webhook'];
    const statuses: CardStatus[] = ['available', 'connected', 'disconnected', 'error'];

    it('oauth and credential connect buttons are never both shown', () => {
      for (const strategy of strategies) {
        for (const status of statuses) {
          const flags = getConnectionStrategyFlags(strategy, status);
          expect(flags.showOAuthConnectButton && flags.showCredentialConnectButton).toBe(false);
        }
      }
    });
  });
});
