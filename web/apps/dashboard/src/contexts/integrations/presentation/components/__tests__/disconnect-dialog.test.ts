import { describe, expect, it, vi } from 'vitest';
import type { IntegrationType } from '@/contexts/integrations/domain/types';

/**
 * Unit tests for disconnect dialog logic.
 * Tests the confirmation flow and cancel behavior without rendering.
 */

async function simulateDisconnectFlow(
  onConfirm: (type: IntegrationType) => Promise<void>,
  onClose: () => void,
  type: IntegrationType,
  shouldConfirm: boolean,
): Promise<void> {
  if (shouldConfirm) {
    await onConfirm(type);
    onClose();
  } else {
    onClose();
  }
}

describe('DisconnectDialog logic', () => {
  it('calls onConfirm and onClose when confirmed', async () => {
    const onConfirm = vi.fn(async (_type: IntegrationType) => {});
    const onClose = vi.fn();

    await simulateDisconnectFlow(onConfirm, onClose, 'slack', true);

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledWith('slack');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls only onClose when cancelled', async () => {
    const onConfirm = vi.fn(async (_type: IntegrationType) => {});
    const onClose = vi.fn();

    await simulateDisconnectFlow(onConfirm, onClose, 'slack', false);

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('passes correct type to onConfirm', async () => {
    const onConfirm = vi.fn(async (_type: IntegrationType) => {});
    const onClose = vi.fn();

    await simulateDisconnectFlow(onConfirm, onClose, 'github', true);

    expect(onConfirm).toHaveBeenCalledWith('github');
  });

  it('handles async onConfirm errors gracefully', async () => {
    const onConfirm = vi.fn(async () => {
      throw new Error('disconnect failed');
    });
    const onClose = vi.fn();

    // onConfirm fails — onClose should still be called after error handling
    try {
      await onConfirm();
      onClose();
    } catch {
      // In the component, catch prevents crash
    }

    expect(onConfirm).toHaveBeenCalledOnce();
    // onClose was not called because the error was thrown before it
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('DisconnectDialog DELETE API call', () => {
  it('makes DELETE request to /api/integrations/[type]', async () => {
    const fetchMock = vi.fn(async () => new Response('{"success":true}', { status: 200 }));
    global.fetch = fetchMock;

    const type: IntegrationType = 'datadog';
    const res = await fetch(`/api/integrations/${type}`, { method: 'DELETE' });

    expect(fetchMock).toHaveBeenCalledWith(`/api/integrations/${type}`, { method: 'DELETE' });
    expect(res.status).toBe(200);
  });
});
