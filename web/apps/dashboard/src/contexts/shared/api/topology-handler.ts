import { NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { NO_CACHE_HEADERS } from '@/lib/api/headers';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/topology
 *
 * Returns the full infrastructure topology:
 * - nodes: all service nodes for the tenant
 * - edges: all service dependency edges
 * - health: system-wide health summary
 *
 * Used by the TopologyView component on the dashboard.
 * Runs server-side so CORE_API_URL is not exposed to the client bundle.
 */
export const GET = withAuth(async (_request, _ctx) => {
  const client = getApiClient();

  const [nodes, edges, health] = await Promise.all([
    client.listServiceNodes(),
    client.listServiceEdges(),
    client.getSystemHealth(),
  ]);

  return NextResponse.json({ nodes, edges, health }, { headers: NO_CACHE_HEADERS });
});
