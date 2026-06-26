import type { DomainEvent } from '../../../src/shared/domain/events.js';

/**
 * Finds all events of a given type that match a specific incidentId.
 * Used to scope event lookups to a single scenario in a shared-harness test.
 */
export function findEventsByIncident(
  events: DomainEvent[],
  eventType: string,
  incidentId: string,
): DomainEvent[] {
  return events.filter(
    (e) => e.eventType === eventType && e.payload['incidentId'] === incidentId,
  );
}

/**
 * Polls the events array until an event matching both eventType and incidentId appears.
 * Essential for shared-tenant smoke tests where multiple scenarios emit the same event types.
 */
export async function waitForEventByIncident(
  events: DomainEvent[],
  eventType: string,
  incidentId: string,
  timeoutMs = 60_000,
): Promise<DomainEvent> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = findEventsByIncident(events, eventType, incidentId);
    if (found.length > 0) return found[0]!;
    await new Promise((r) => setTimeout(r, 500));
  }
  const seen = events
    .filter((e) => e.eventType === eventType)
    .map((e) => e.payload['incidentId'])
    .join(', ');
  throw new Error(
    `Event ${eventType} for incident ${incidentId} not received within ${timeoutMs}ms. ` +
    `Seen incidentIds for this type: [${seen}]`,
  );
}
