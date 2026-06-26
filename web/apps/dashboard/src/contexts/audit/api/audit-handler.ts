import { type NextRequest, NextResponse } from 'next/server';
import { VALID_ACTIONS, type ValidAction } from '@/contexts/audit/domain/types';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

const VALID_ACTOR_TYPES = ['user', 'system'] as const;
type ValidActorType = (typeof VALID_ACTOR_TYPES)[number];

export const GET = withAuth(async (request: NextRequest) => {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') ?? undefined;
  const actorType = url.searchParams.get('actorType') ?? undefined;
  const cursor = url.searchParams.get('cursor') ?? undefined;
  const limitParam = url.searchParams.get('limit');
  const limit = Math.min(Number(limitParam) || 20, 100);

  if (action && !VALID_ACTIONS.includes(action as ValidAction)) {
    return NextResponse.json(
      { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` },
      { status: 400 },
    );
  }

  if (actorType && !VALID_ACTOR_TYPES.includes(actorType as ValidActorType)) {
    return NextResponse.json({ error: 'Invalid actorType' }, { status: 400 });
  }

  try {
    const result = await getApiClient().listAuditEntries({
      action,
      actorType: actorType as ValidActorType | undefined,
      limit,
      cursor,
    });
    const response: { items: typeof result.items; cursor?: string } = { items: result.items };
    if (result.cursor) response.cursor = result.cursor;
    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to list audit entries:', error);
    return NextResponse.json({ error: 'Failed to load audit entries' }, { status: 500 });
  }
});
