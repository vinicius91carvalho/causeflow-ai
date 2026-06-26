/**
 * Test prompt caching via Mastra Agent + wrapLanguageModel middleware.
 * Same pattern as the production MastraAgentRunner.
 *
 * Usage: source .env.staging && npx tsx scripts/test-prompt-cache.ts
 */
import { Agent } from '@mastra/core/agent';
import { TokenLimiterProcessor } from '@mastra/core/processors';
import { Mastra } from '@mastra/core';
import { createAnthropic } from '@ai-sdk/anthropic';
import { wrapLanguageModel, type LanguageModelMiddleware } from 'ai';

const ANTHROPIC_API_KEY = process.env['ANTHROPIC_API_KEY'];
if (!ANTHROPIC_API_KEY) {
    console.error('Set ANTHROPIC_API_KEY first: source .env.staging');
    process.exit(1);
}

// Middleware: add cache_control to system messages (same as mastra-agent-runner.ts)
const promptCacheMiddleware: LanguageModelMiddleware = {
    specificationVersion: 'v3',
    transformParams: async ({ params }) => {
        const prompt = [...params.prompt] as any[];
        const cacheControl = { type: 'ephemeral' as const };
        console.log(`[MW] ${prompt.length} msgs, roles: ${prompt.map((p: any) => p.role).join(',')}`);
        // Log the system message structure before modification
        const sys = prompt.find((p: any) => p.role === 'system');
        if (sys) {
            console.log(`[MW] system.content type: ${typeof sys.content}, isArray: ${Array.isArray(sys.content)}`);
            if (Array.isArray(sys.content)) {
                console.log(`[MW] system.content[0] keys: ${Object.keys(sys.content[0]).join(',')}`);
            }
        }

        const addCacheToMessage = (msg: any) => {
            // The @ai-sdk/anthropic provider reads providerOptions at the MESSAGE level for system messages.
            // For user/assistant messages with array content, it reads from each part.
            if (typeof msg.content === 'string') {
                return { ...msg, providerOptions: { ...msg.providerOptions, anthropic: { ...msg.providerOptions?.anthropic, cacheControl } } };
            }
            if (Array.isArray(msg.content) && msg.content.length > 0) {
                const content = [...msg.content];
                const lastPart = content[content.length - 1];
                content[content.length - 1] = { ...lastPart, providerOptions: { ...lastPart.providerOptions, anthropic: { ...lastPart.providerOptions?.anthropic, cacheControl } } };
                return { ...msg, content };
            }
            return msg;
        };

        let lastSystemIdx = -1;
        for (let i = prompt.length - 1; i >= 0; i--) {
            if (prompt[i].role === 'system') { lastSystemIdx = i; break; }
        }
        if (lastSystemIdx >= 0) prompt[lastSystemIdx] = addCacheToMessage(prompt[lastSystemIdx]);
        const lastIdx = prompt.length - 1;
        if (lastIdx >= 0 && lastIdx !== lastSystemIdx) prompt[lastIdx] = addCacheToMessage(prompt[lastIdx]);
        // Log what we're about to send
        const sysAfter = prompt.find((p: any) => p.role === 'system');
        if (sysAfter) {
            if (Array.isArray(sysAfter.content)) {
                const last = sysAfter.content[sysAfter.content.length - 1];
                console.log(`[MW] After: system part providerOptions: ${JSON.stringify(last.providerOptions)}`);
            } else {
                console.log(`[MW] After: system providerOptions: ${JSON.stringify(sysAfter.providerOptions)}`);
            }
        }
        return { ...params, prompt };
    },
};

// Large system prompt (~4000+ tokens to exceed 2048 minimum)
const SYSTEM_PROMPT = `You are a senior SRE investigating production incidents. You have deep expertise in:
- AWS infrastructure (ECS, Lambda, SQS, DynamoDB, CloudWatch, ALB)
- Distributed systems debugging and root cause analysis
- Incident response, communication, and post-mortems
- Performance analysis, optimization, and capacity planning

## Investigation Protocol
1. Start by gathering context about the incident from the operator
2. Check monitoring dashboards, CloudWatch metrics, and application logs
3. Identify the blast radius — which services, users, and regions are affected
4. Form hypotheses about root cause based on available evidence
5. Verify each hypothesis with concrete data from AWS tools
6. Document findings with severity ratings and timestamps
7. Propose remediation steps with estimated time to resolution

## Rules
- Always check CloudWatch metrics before making conclusions about service health
- Never assume — verify every hypothesis with data from at least two sources
- Report findings as you discover them using the report_finding tool
- Prioritize high-severity issues that affect user experience
- Consider blast radius for every finding — a single Lambda failure might affect downstream services
- Check deployment history for recent changes that correlate with incident start time
- Look at DLQ depths for queue-based systems — DLQ accumulation indicates processing failures
- Verify Lambda concurrency limits and check for throttling events
- Check ECS task health, container logs, and recent task replacements
- Monitor ALB target group health checks and response time distributions
- Examine SQS message age and approximate number of messages for queue backlogs
- Review IAM permission changes that might have broken cross-account access
- Check certificate expiration dates for services using TLS
- Look for DynamoDB throttling on hot partitions using ConsumedReadCapacityUnits
- Verify Redis connection pool utilization and eviction rates

## Response Format
- Be concise and direct — the operator is under pressure during incidents
- Use bullet points for findings with severity labels
- Include timestamps, metric values, and service names in every finding
- Rate severity: info (awareness), warning (degraded), critical (outage/data loss)
- Always explain WHY something is a problem, not just WHAT you observed
- Suggest next investigation steps when you find something interesting

## Platform Architecture
This is a multi-tenant SaaS platform (CauseFlow) running on AWS with the following architecture:
- API layer: Hono framework on ECS Fargate (single task, auto-scaling planned)
- Queue processing: SQS with Lambda consumers for async work
- Database: DynamoDB single-table design with ElectroDB entities
- Caching: Redis ElastiCache for session and hot-path caching
- Monitoring: CloudWatch metrics/logs + Langfuse for LLM tracing
- Auth: Clerk for dashboard users, JWT for API-to-API calls
- AI: Claude (Anthropic) for investigation agents with Mastra orchestration
- Webhooks: Payment provider callbacks (Monato SPEI, Stripe) via SQS

Each tenant has isolated data partitioned by tenantId in DynamoDB.
The platform supports real-time investigation updates via WebSocket relay connections.

Common incident patterns include webhook callback failures (DLQ accumulation),
Lambda concurrency exhaustion, ECS task OOM kills, DynamoDB throttling on hot partitions,
Redis connection pool exhaustion, SQS message visibility timeout issues,
ALB target group health check failures, certificate expiration,
and IAM permission changes breaking cross-account STS assume-role calls.
`.repeat(5); // ~4000+ tokens, well above 2048 minimum for Haiku caching

async function main() {
    console.log('Prompt Cache Test — Mastra Agent + wrapLanguageModel middleware\n');

    const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY });
    const cachedModel = wrapLanguageModel({
        model: anthropic('claude-sonnet-4-6'),
        middleware: promptCacheMiddleware,
    });

    const agent = new Agent({
        id: 'cache-test',
        name: 'Cache Test',
        instructions: SYSTEM_PROMPT,
        model: cachedModel as any,
        inputProcessors: [new TokenLimiterProcessor({ limit: 50_000 })],
    });

    const mastra = new Mastra({ agents: { 'cache-test': agent } });
    const registeredAgent = mastra.getAgent('cache-test');

    const questions = [
        'What are the most common causes of webhook callback failures in SQS?',
        'How would you diagnose a DLQ accumulation issue?',
        'What metrics would you check for an ECS task that keeps restarting?',
    ];

    for (let i = 0; i < questions.length; i++) {
        console.log(`--- Turn ${i + 1} ---`);
        console.log(`Q: ${questions[i]}`);

        const start = Date.now();
        const result = await registeredAgent.generate(questions[i]!, { maxSteps: 1 });
        const elapsed = Date.now() - start;

        const usage = result.usage;
        const providerMeta = (result as any).providerMetadata;
        const cacheCreation = providerMeta?.anthropic?.cacheCreationInputTokens ?? 0;
        const cached = usage?.cachedInputTokens ?? 0;
        const total = usage?.inputTokens ?? 1;
        const cacheRate = total > 0 ? Math.round((cached / total) * 100) : 0;

        console.log(`A: ${(result.text ?? '').slice(0, 80)}...`);
        console.log(`  Input:          ${total}`);
        console.log(`  Output:         ${usage?.outputTokens ?? '?'}`);
        console.log(`  Cache created:  ${cacheCreation}`);
        console.log(`  Cache read:     ${cached}`);
        console.log(`  Cache rate:     ${cacheRate}%`);
        console.log(`  Latency:        ${elapsed}ms\n`);
    }

    console.log('Done — check Anthropic console for cache rate');
}

main().catch((err) => { console.error('Failed:', err); process.exit(1); });
