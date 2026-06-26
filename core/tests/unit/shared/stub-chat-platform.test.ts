import { describe, it, expect } from 'vitest';
import { StubChatPlatform } from '../../../src/shared/infra/chat/stub-chat-platform.js';

describe('StubChatPlatform', () => {
  const platform = new StubChatPlatform();

  it('should have name "stub"', () => {
    expect(platform.name).toBe('stub');
  });

  it('should auto-approve requests', async () => {
    const result = await platform.requestApproval({
      channelId: 'test-channel',
      title: 'Test Approval',
      description: 'Some action',
      actions: [
        { label: 'Approve', value: 'approve', style: 'primary' },
        { label: 'Reject', value: 'reject', style: 'danger' },
      ],
    });

    expect(result.approved).toBe(true);
    expect(result.respondedBy).toBe('stub-auto-approve');
    expect(result.selectedAction).toBe('approve');
    expect(result.respondedAt).toBeDefined();
  });

  it('should send messages and return IDs', async () => {
    const result = await platform.sendMessage({
      channelId: 'test-channel',
      text: 'Hello',
    });

    expect(result.messageId).toBeDefined();
    expect(result.threadId).toBeDefined();
  });

  it('should preserve threadId when provided', async () => {
    const result = await platform.sendMessage({
      channelId: 'test-channel',
      text: 'Reply',
      threadId: 'existing-thread',
    });

    expect(result.threadId).toBe('existing-thread');
  });

  it('should update message without error', async () => {
    await expect(
      platform.updateMessage('channel', 'msg-1', 'Updated text'),
    ).resolves.toBeUndefined();
  });

  it('should test connection successfully', async () => {
    const connected = await platform.testConnection();
    expect(connected).toBe(true);
  });
});
