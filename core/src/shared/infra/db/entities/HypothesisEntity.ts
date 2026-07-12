import { Entity } from 'electrodb';
import { getDynamoClient } from '../client.js';
import { TABLE_NAME } from '../table.js';

/**
 * Single-table design entity for investigation hypotheses.
 *
 * Access patterns:
 *   - primary: get one hypothesis by (tenantId, incidentId, hypothesisId)
 *   - byIncident: list all hypotheses for a given incident
 *
 * Evidence references are stored inline (list of maps) rather than as
 * separate rows — hypotheses hold a curated, compact pointer set (≤30 entries
 * each in practice) and every consumer wants them in one round-trip.
 */
export const HypothesisEntity = new Entity(
  {
    model: { entity: 'hypothesis', version: '1', service: 'causeflow' },
    attributes: {
      tenantId: { type: 'string', required: true },
      incidentId: { type: 'string', required: true },
      hypothesisId: { type: 'string', required: true },
      statement: { type: 'string', required: true },
      rationale: { type: 'string' },
      informedBy: { type: 'list', items: { type: 'string' } },
      confidence: { type: 'number', required: true, default: 0 },
      evidenceFor: { type: 'any' },
      evidenceAgainst: { type: 'any' },
      status: { type: ['pending', 'confirmed', 'rejected'], required: true, default: 'pending' },
      finalScore: { type: 'number' },
      rejectedReason: { type: 'string' },
      parentId: { type: 'string' },
      createdAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        readOnly: true,
      },
      updatedAt: {
        type: 'string',
        required: true,
        default: () => new Date().toISOString(),
        watch: '*',
        set: () => new Date().toISOString(),
      },
    },
    indexes: {
      primary: {
        collection: 'incidentDetails',
        pk: { field: 'pk', composite: ['tenantId'] },
        sk: { field: 'sk', composite: ['incidentId', 'hypothesisId'] },
      },
    },
  },
  { client: getDynamoClient(), table: TABLE_NAME },
);
