import { createSQSConsumer } from '../../../shared/infra/queue/sqs-consumer.js';
import { dispatchInvestigation } from '../../../shared/infra/ecs/task-dispatcher.js';
import { logger } from '../../../shared/infra/logger.js';
import { runJob } from '../../../shared/infra/observability/worker-runner.js';
export function startInvestigationConsumer(queueUrl: string) {
    const consumer = createSQSConsumer({
        queueUrl,
        handler: async (message) => {
            await runJob(
                message,
                async (body) => {
                    const b = body as { incidentId: string; tenantId: string; suggestedAgents?: string[] };
                    await dispatchInvestigation({
                        tenantId: b.tenantId,
                        incidentId: b.incidentId,
                        suggestedAgents: b.suggestedAgents ?? ['log_analyst', 'metric_analyst', 'change_detector', 'code_analyzer', 'infra_inspector', 'db_analyst'],
                    });
                },
                {
                    jobType: 'investigation',
                    queueName: queueUrl.split('/').pop() ?? 'investigation-queue',
                    tenantIdFromBody: (b) => (b as { tenantId?: string })?.tenantId,
                },
            );
        },
    });
    consumer.start().catch((err) => {
        logger.fatal({ err }, 'Investigation consumer fatal error');
    });
    return consumer;
}
