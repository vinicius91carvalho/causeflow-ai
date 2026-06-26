/**
 * AffectedRoutesStrip — Scenario 01 (Stale Pricing)
 *
 * Horizontal pill row showing every route blocked by the TypeError bug
 * in the RevalidationEventsSubscriber handler. Glows red to convey
 * systemic reach beyond just /pricing.
 *
 * Used both inside EvidenceBoardGrid (card 4) and as a standalone
 * Section 4 on the stale-pricing page.
 */

const AFFECTED_ROUTES = [
  '/',
  '/pricing',
  '/features',
  '/blog/simuser-ai-v2-launch',
  '/blog/…',
] as const;

export function AffectedRoutesStrip() {
  return (
    <ul className="flex list-none flex-wrap gap-2 p-0" aria-label="Affected routes">
      {AFFECTED_ROUTES.map((route) => (
        <li
          key={route}
          className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 font-mono text-[12px] font-medium text-red-600"
        >
          {route}
        </li>
      ))}
    </ul>
  );
}
