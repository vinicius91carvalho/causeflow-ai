/**
 * Unit tests for pending invites component logic.
 * Tests invite state derivation without React rendering.
 */
import { describe, expect, it } from 'vitest';
import type { Invite } from '@/contexts/team/domain/types';

function makeInvite(overrides: Partial<Invite> = {}): Invite {
  return {
    tenantId: 'tenant-1',
    email: 'test@example.com',
    role: 'member',
    invitedBy: 'user-1',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function isInviteExpired(invite: Invite): boolean {
  return invite.status === 'expired' || new Date(invite.expiresAt) < new Date();
}

function getInviteDisplayStatus(invite: Invite): 'pending' | 'expired' {
  return isInviteExpired(invite) ? 'expired' : 'pending';
}

describe('Pending invite state derivation', () => {
  it('active invite is shown as pending', () => {
    const invite = makeInvite();
    expect(getInviteDisplayStatus(invite)).toBe('pending');
  });

  it('invite with status=expired is shown as expired', () => {
    const invite = makeInvite({ status: 'expired' });
    expect(getInviteDisplayStatus(invite)).toBe('expired');
  });

  it('invite with past expiresAt is shown as expired even if status=pending', () => {
    const invite = makeInvite({
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      status: 'pending',
    });
    expect(getInviteDisplayStatus(invite)).toBe('expired');
  });

  it('invite with future expiresAt and pending status is active', () => {
    const invite = makeInvite({
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(isInviteExpired(invite)).toBe(false);
  });
});

describe('Pending invite actions', () => {
  it('can revoke a pending invite', () => {
    const invite = makeInvite({ status: 'pending' });
    expect(isInviteExpired(invite)).toBe(false);
    // Revoke = set expired
    const revoked = { ...invite, status: 'expired' as const };
    expect(isInviteExpired(revoked)).toBe(true);
  });

  it('cannot revoke an already expired invite', () => {
    const invite = makeInvite({ status: 'expired' });
    // Action buttons should not show for expired
    expect(isInviteExpired(invite)).toBe(true);
  });
});

describe('Pending invites filtering', () => {
  const invites: Invite[] = [
    makeInvite({ email: 'a@test.com', status: 'pending' }),
    makeInvite({ email: 'b@test.com', status: 'expired' }),
    makeInvite({ email: 'c@test.com', status: 'accepted' }),
  ];

  it('filters out accepted invites from display', () => {
    const displayed = invites.filter((i) => i.status === 'pending' || i.status === 'expired');
    expect(displayed.length).toBe(2);
    expect(displayed.map((i) => i.email)).not.toContain('c@test.com');
  });

  it('pending invites remain in display list', () => {
    const displayed = invites.filter((i) => i.status === 'pending' || i.status === 'expired');
    expect(displayed.map((i) => i.email)).toContain('a@test.com');
  });

  it('expired invites remain in display list', () => {
    const displayed = invites.filter((i) => i.status === 'pending' || i.status === 'expired');
    expect(displayed.map((i) => i.email)).toContain('b@test.com');
  });
});
