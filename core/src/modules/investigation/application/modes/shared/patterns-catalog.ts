/**
 * Generic SRE failure-mode catalog injected into the seeker's prompt as
 * priors. Universal and tenant-independent — works on day 1 even when
 * Hindsight memory is empty and no integrations are connected.
 *
 * Curation rules:
 *   - Each pattern is **concrete enough to be testable** (not "a bug").
 *   - Cover multiple layers: infra, app, data, dependency.
 *   - Include the most common SRE postmortem causes — if a pattern
 *     doesn't appear in 5%+ of real postmortems across the industry, it
 *     probably doesn't belong here.
 *   - Keep descriptions terse. Total catalog must fit in ~2-3K tokens.
 *
 * Evolution:
 *   - Patterns learned from operators' own incidents should eventually
 *     be promoted into this catalog, but the seeder for that promotion
 *     path is not implemented here (future work).
 */

export type PatternLayer = 'infra' | 'app' | 'data' | 'dependency' | 'config' | 'security';

export interface SrePattern {
    /** Stable identifier used by seeker to cite sourcing. Kebab-case. */
    id: string;
    /** Short display name. */
    name: string;
    /** One-sentence mechanism. */
    description: string;
    /** Layer(s) where the pattern manifests. */
    layer: PatternLayer;
    /** Observable symptoms — what you'd see in logs/metrics/alerts. */
    symptoms: string[];
    /** Common triggers — when does this typically start happening? */
    typicalTriggers: string[];
    /** What to check first to confirm or rule out the pattern. */
    suggestedEvidence: string[];
}

export const SRE_PATTERNS_CATALOG: readonly SrePattern[] = [
    {
        id: 'connection-pool-exhaustion',
        name: 'Connection Pool Exhaustion',
        description: 'Upstream clients cannot acquire a DB/HTTP connection because the pool is saturated and pending requests queue until timeout.',
        layer: 'data',
        symptoms: ['p99 latency spikes on every request', 'connection timeout errors', 'thread pool waiting states'],
        typicalTriggers: ['slow query regression', 'traffic surge', 'downstream DB under load', 'pool size not scaled with replica count'],
        suggestedEvidence: ['DB active-connections metric', 'slow query log', 'application pool waiting count', 'recent deploy affecting DB access patterns'],
    },
    {
        id: 'deploy-regression',
        name: 'Deploy Regression',
        description: 'Error rate or latency degrades within minutes of a release — the new code path is faulty.',
        layer: 'app',
        symptoms: ['error spike beginning shortly after deploy', 'errors concentrated on recently-changed endpoints', 'healthy rollback history'],
        typicalTriggers: ['merged PR touching hot path', 'new config flag flipped', 'dependency version bump'],
        suggestedEvidence: ['deploy timestamp vs error onset', 'recent PRs in affected service repo', 'diff on affected endpoints', 'compare error rate pre/post release'],
    },
    {
        id: 'memory-leak-oom',
        name: 'Memory Leak / OOM Kill',
        description: 'Process memory grows unbounded until the runtime OOM-kills or the container is evicted.',
        layer: 'app',
        symptoms: ['monotonic memory increase over hours', 'OOMKilled pod events', 'GC pauses before crash', 'periodic restart cycle'],
        typicalTriggers: ['unbounded in-memory cache', 'retained closure references', 'leaked request contexts', 'recent lib upgrade'],
        suggestedEvidence: ['container memory graph over last 24h', 'restart / OOMKilled event history', 'heap dump if available', 'diff on caching logic since last week'],
    },
    {
        id: 'cache-stampede',
        name: 'Cache Stampede / Thundering Herd',
        description: 'Simultaneous cache misses hit the origin when a popular key expires, overwhelming the backend.',
        layer: 'app',
        symptoms: ['sudden load spike on origin with flat request volume upstream', 'p99 jumps exactly at cache TTL boundaries', 'DB CPU saturation on bursty minute'],
        typicalTriggers: ['popular key expired', 'cache flushed globally', 'deploy invalidated cache'],
        suggestedEvidence: ['cache hit ratio over time', 'origin DB CPU/connection metrics', 'request volume vs origin load ratio'],
    },
    {
        id: 'upstream-dependency-outage',
        name: 'Upstream Dependency Outage',
        description: 'A third-party or internal downstream service is failing, cascading 5xx through the system.',
        layer: 'dependency',
        symptoms: ['5xx rate spike on endpoints that call the dependency', 'timeouts with dependency name in stack', 'partial feature failure'],
        typicalTriggers: ['third-party incident (Stripe, GitHub, etc.)', 'downstream team incident', 'expired API key / auth failure'],
        suggestedEvidence: ['dependency status page', 'error stack traces for dependency name', 'dependency error rate metric'],
    },
    {
        id: 'rate-limit-exhaustion',
        name: 'Rate Limit / Quota Exhaustion',
        description: 'Outbound calls to a third party are being throttled because the tenant exceeded quota.',
        layer: 'dependency',
        symptoms: ['429 status codes from specific dependency', 'intermittent failures concentrated on one integration', 'pattern resets at hour/day boundaries'],
        typicalTriggers: ['traffic growth past plan tier', 'runaway retry loop', 'bulk job launched by operator'],
        suggestedEvidence: ['429 count per dependency over 24h', 'quota dashboard if available', 'retry settings on HTTP client'],
    },
    {
        id: 'certificate-expiry',
        name: 'TLS Certificate Expiry',
        description: 'A service certificate expired and TLS handshakes now fail.',
        layer: 'security',
        symptoms: ['all clients failing with TLS handshake errors', 'onset exactly aligned with a midnight UTC or cert renewal date', 'no recent code change'],
        typicalTriggers: ['forgotten manual cert renewal', 'cert-manager failing to rotate', 'domain renewal lapsed'],
        suggestedEvidence: ['openssl s_client against the affected endpoint', 'cert expiration metric', 'cert-manager logs', 'DNS record health'],
    },
    {
        id: 'dns-resolution-failure',
        name: 'DNS Resolution Failure',
        description: 'Hostname lookups are failing or returning stale IPs due to DNS TTL, resolver outage, or route-53 record issue.',
        layer: 'infra',
        symptoms: ['EAI_AGAIN or ENOTFOUND errors', 'intermittent hostname failures', 'pods fail after restart only'],
        typicalTriggers: ['DNS record TTL expiration with propagation delay', 'CoreDNS / resolver outage', 'NAT / VPC endpoint changes'],
        suggestedEvidence: ['dig on affected hostname', 'resolver logs', 'recent Route53/DNS changes', 'NAT gateway metrics'],
    },
    {
        id: 'n-plus-one-query',
        name: 'N+1 Query Regression',
        description: 'A loop-level query pattern blew up when data volume grew or a join was removed.',
        layer: 'data',
        symptoms: ['latency scales linearly with row count', 'DB request rate is suspiciously high relative to HTTP requests', 'specific endpoint affected'],
        typicalTriggers: ['ORM lazy-load change', 'schema refactor removing an include', 'customer dataset grew past a threshold'],
        suggestedEvidence: ['DB queries-per-request ratio', 'slow query log', 'recent ORM / repository layer diffs'],
    },
    {
        id: 'thread-starvation',
        name: 'Thread / Event Loop Starvation',
        description: 'CPU-bound work on the event loop (Node) or a blocked thread pool (Java) stalls all other requests.',
        layer: 'app',
        symptoms: ['requests queue up during a specific operation', 'low CPU usage but rising latency', 'health checks failing despite healthy process'],
        typicalTriggers: ['synchronous JSON.parse on large payload', 'blocking I/O in worker thread', 'regex catastrophic backtracking'],
        suggestedEvidence: ['flame graph / CPU profile', 'event loop lag metric', 'request queue depth'],
    },
    {
        id: 'queue-backlog',
        name: 'Async Queue Backlog',
        description: 'Consumer throughput fell below producer rate — SQS/Kafka/DLQ depth grows unbounded.',
        layer: 'infra',
        symptoms: ['message age / queue depth rising', 'consumer lag alerts', 'downstream pipeline delays'],
        typicalTriggers: ['consumer crash loop', 'downstream service slowdown', 'producer volume spike', 'consumer pod OOM'],
        suggestedEvidence: ['queue depth / oldest message age', 'consumer error logs', 'DLQ count', 'consumer CPU / error rate'],
    },
    {
        id: 'misconfigured-feature-flag',
        name: 'Misconfigured Feature Flag',
        description: 'A feature flag was flipped for a broader audience than intended, exposing a bug or expensive code path.',
        layer: 'config',
        symptoms: ['errors concentrated on users/tenants in a specific cohort', 'error onset aligned with flag change audit entry', 'no deploy at onset time'],
        typicalTriggers: ['flag rollout bumped from 10% to 100%', 'tenant added to wrong cohort', 'flag provider propagation'],
        suggestedEvidence: ['feature flag audit log', 'cohort comparison in errors', 'LaunchDarkly/Unleash change history'],
    },
    {
        id: 'disk-full',
        name: 'Disk / Inode Exhaustion',
        description: 'A host ran out of disk space or inodes, causing writes (logs, temp files, DB WAL) to fail.',
        layer: 'infra',
        symptoms: ['ENOSPC errors in logs', 'DB write errors', 'application restarting on specific hosts only'],
        typicalTriggers: ['unrotated log files', 'runaway temp files', 'DB WAL growth', 'cache directory not pruned'],
        suggestedEvidence: ['disk usage per host', 'df / du comparison', 'recent large-file writes', 'log rotation config'],
    },
    {
        id: 'clock-skew',
        name: 'Clock Skew / NTP Drift',
        description: 'A host\'s clock drifted past the tolerance of time-sensitive operations (JWT, TLS, distributed locks).',
        layer: 'infra',
        symptoms: ['JWT validation failures', 'TLS certificate not-yet-valid errors', 'distributed lock contention', 'logs with future timestamps'],
        typicalTriggers: ['NTP daemon stopped', 'VM migration between hosts', 'virtualization host clock issue'],
        suggestedEvidence: ['NTP status on affected host', 'clock offset metric', 'chronyc tracking / timedatectl'],
    },
    {
        id: 'migration-long-lock',
        name: 'Long-Running DB Migration Lock',
        description: 'A schema migration acquired a table/row lock and blocked production queries.',
        layer: 'data',
        symptoms: ['all queries on a specific table timing out', 'onset aligned with migration deploy', 'locks visible in DB process list'],
        typicalTriggers: ['ALTER TABLE on large table', 'adding NOT NULL without default', 'index creation without CONCURRENTLY'],
        suggestedEvidence: ['DB locks / blocking query view', 'migration logs', 'deploy timestamp vs onset', 'migration diff'],
    },
    {
        id: 'secret-rotation',
        name: 'Secret / Credential Rotation Failure',
        description: 'A rotated API key / DB password was not picked up by running services, causing auth failures.',
        layer: 'security',
        symptoms: ['401/403 errors on all calls to a specific dependency', 'errors started at the rotation window', 'new deployments are healthy'],
        typicalTriggers: ['Secrets Manager rotation', 'vault rotation', 'manual credential update'],
        suggestedEvidence: ['Secrets Manager rotation history', 'application logs around onset', 'cache / container restart status'],
    },
    {
        id: 'autoscale-lag',
        name: 'Autoscaling Lag',
        description: 'Load increased faster than the autoscaler could add capacity, saturating existing pods/instances.',
        layer: 'infra',
        symptoms: ['CPU saturated on all existing pods', 'latency rising while HPA/ASG catches up', 'onset aligned with traffic spike'],
        typicalTriggers: ['promo / campaign traffic surge', 'batch workload launch', 'autoscaler cool-down blocking'],
        suggestedEvidence: ['HPA / ASG activity history', 'pod count over time vs load', 'autoscaling cool-down config'],
    },
    {
        id: 'cors-misconfiguration',
        name: 'CORS / Routing Misconfiguration',
        description: 'CORS policy or API gateway routing change broke legitimate client requests.',
        layer: 'config',
        symptoms: ['browser console CORS errors', 'specific origin affected', 'requests arrive at edge but not origin', 'preflight OPTIONS failing'],
        typicalTriggers: ['API gateway config deploy', 'new origin added', 'CORS middleware change'],
        suggestedEvidence: ['CloudFront/ALB/API gateway config history', 'CORS middleware diff', 'preflight response headers'],
    },
    {
        id: 'cdn-cache-stale',
        name: 'CDN Cached Stale Response',
        description: 'A CDN is serving stale content because an invalidation failed or TTL is too high for the content type.',
        layer: 'config',
        symptoms: ['users see old content after a deploy', 'inconsistent behavior by geography', 'cache hit ratio looks normal'],
        typicalTriggers: ['CDN invalidation failed silently', 'TTL misconfigured for dynamic content', 'stale-while-revalidate window too long'],
        suggestedEvidence: ['CDN invalidation history', 'edge response headers (age, x-cache)', 'TTL configuration audit', 'direct origin fetch comparison'],
    },
    {
        id: 'retry-storm',
        name: 'Retry Storm / Positive Feedback Loop',
        description: 'Clients retrying aggressively on transient errors amplified load and prevented recovery.',
        layer: 'app',
        symptoms: ['request volume increases during the incident (vs normal)', 'recovery attempts immediately trigger re-failure', 'inbound rate is N× steady state'],
        typicalTriggers: ['missing retry backoff', 'cascading failure from a small blip', 'mobile clients with no circuit breaker'],
        suggestedEvidence: ['inbound request rate over time', 'retry count per client', 'circuit breaker config in clients'],
    },
] as const;

/**
 * Render the catalog as a compact Markdown section suitable for injection
 * into a seeker prompt. Keeps total length bounded (<3K tokens) by listing
 * each pattern as one line.
 */
export function renderPatternsCatalogForPrompt(catalog: readonly SrePattern[] = SRE_PATTERNS_CATALOG): string {
    const lines = catalog.map(
        (p) => `- \`${p.id}\` — **${p.name}** (${p.layer}): ${p.description}`,
    );
    return `## Common SRE failure patterns (universal priors)

These patterns are derived from the industry's most common postmortems. Use them as a baseline when tenant-specific memory or integrations are unavailable. Cite the pattern id in your hypothesis's \`informedBy\` field when a pattern influenced your reasoning.

${lines.join('\n')}`;
}
