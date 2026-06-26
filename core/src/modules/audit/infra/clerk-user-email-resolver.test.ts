import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the Clerk client module so no real HTTP calls are made
// ---------------------------------------------------------------------------

const mockGetUserList = vi.fn();
vi.mock('../../../modules/auth/infra/clerk-client.js', () => ({
    getClerkClient: () => ({
        users: { getUserList: mockGetUserList },
    }),
}));

async function getResolver() {
    const { ClerkUserEmailResolver } = await import('./clerk-user-email-resolver.js');
    return new ClerkUserEmailResolver();
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('ClerkUserEmailResolver', () => {
    it('resolves primary email for a known user', async () => {
        mockGetUserList.mockResolvedValue({
            data: [
                {
                    id: 'user-abc',
                    primaryEmailAddressId: 'ea-1',
                    emailAddresses: [{ id: 'ea-1', emailAddress: 'alice@example.com' }],
                },
            ],
        });

        const resolver = await getResolver();
        const result = await resolver.resolveEmails(['user-abc']);

        expect(result.get('user-abc')).toBe('alice@example.com');
    });

    it('returns empty string for unknown / deleted users', async () => {
        mockGetUserList.mockResolvedValue({ data: [] });

        const resolver = await getResolver();
        const result = await resolver.resolveEmails(['deleted-user']);

        expect(result.get('deleted-user')).toBe('');
    });

    it('deduplicates input user ids before fetching', async () => {
        mockGetUserList.mockResolvedValue({
            data: [
                {
                    id: 'user-abc',
                    primaryEmailAddressId: 'ea-1',
                    emailAddresses: [{ id: 'ea-1', emailAddress: 'alice@example.com' }],
                },
            ],
        });

        const resolver = await getResolver();
        await resolver.resolveEmails(['user-abc', 'user-abc', 'user-abc']);

        // Should only call Clerk once despite duplicates
        expect(mockGetUserList).toHaveBeenCalledTimes(1);
        expect(mockGetUserList).toHaveBeenCalledWith(
            expect.objectContaining({ userId: ['user-abc'] }),
        );
    });

    it('falls back to first emailAddress when primaryEmailAddressId does not match', async () => {
        mockGetUserList.mockResolvedValue({
            data: [
                {
                    id: 'user-abc',
                    primaryEmailAddressId: 'no-match',
                    emailAddresses: [{ id: 'ea-1', emailAddress: 'fallback@example.com' }],
                },
            ],
        });

        const resolver = await getResolver();
        const result = await resolver.resolveEmails(['user-abc']);

        expect(result.get('user-abc')).toBe('fallback@example.com');
    });

    it('swallows errors and returns empty string for all ids on Clerk failure', async () => {
        mockGetUserList.mockRejectedValue(new Error('Clerk API down'));

        const resolver = await getResolver();
        const result = await resolver.resolveEmails(['user-abc']);

        expect(result.get('user-abc')).toBe('');
    });

    it('returns empty map when given an empty array', async () => {
        const resolver = await getResolver();
        const result = await resolver.resolveEmails([]);

        expect(result.size).toBe(0);
        expect(mockGetUserList).not.toHaveBeenCalled();
    });
});
