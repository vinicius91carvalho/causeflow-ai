import { type NextRequest, NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { NO_CACHE_HEADERS } from '@/lib/api/headers';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/topology/:serviceId
 *
 * Returns detail for a single service node:
 * - node: the service node
 * - edges: all edges connected to this service
 * - blastRadius: blast radius analysis
 *
 * Used by the service detail panel in TopologyView.
 */
export const GET = withAuth(async (_request: NextRequest, _ctx, params) => {
  const serviceId = params?.serviceId;

  if (!serviceId) {
    return NextResponse.json({ error: 'serviceId is required.' }, { status: 400 });
  }

  const client = getApiClient();

  // Fetch outbound and inbound edges in parallel using server-side filtering
  // instead of fetching all edges and filtering client-side.
  const [node, outboundEdges, inboundEdges, blastRadius] = await Promise.all([
    client.getServiceNode(serviceId),
    client.listServiceEdges({ sourceService: serviceId }),
    client.listServiceEdges({ targetService: serviceId }),
    client.getBlastRadius(serviceId),
  ]);

  // Deduplicate in case the API returns the same edge for both directions
  const edgeMap = new Map([...outboundEdges, ...inboundEdges].map((e) => [e.edgeId, e]));
  const edges = Array.from(edgeMap.values());

  return NextResponse.json({ node, edges, blastRadius }, { headers: NO_CACHE_HEADERS });
});
