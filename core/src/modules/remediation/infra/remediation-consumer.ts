import { createSQSConsumer } from '../../../shared/infra/queue/sqs-consumer.js';
import { incidentId, tenantId } from '../../../shared/domain/value-objects.js';
import { logger } from '../../../shared/infra/logger.js';
import { runJob } from '../../../shared/infra/observability/worker-runner.js';
import type { ProposeRemediationUseCase } from '../application/propose-remediation.usecase.js';
import type { StructuredAction } from '../../investigation/domain/investigation.types.js';
export function startRemediationConsumer(queueUrl: string, proposeRemediation: ProposeRemediationUseCase) {
    const consumer = createSQSConsumer({
        queueUrl,
        handler: async (message) => {
            await runJob(
                message,
                async (body) => {
                    const b = body as { incidentId: string; tenantId: string; rootCause?: string; recommendedActions?: StructuredAction[] };
                    await proposeRemediation.execute({
                        tenantId: tenantId(b.tenantId),
                        incidentId: incidentId(b.incidentId),
                        rootCause: b.rootCause ?? '',
                        recommendedActions: b.recommendedActions ?? [],
                    });
                },
                {
                    jobType: 'remediation',
                    queueName: queueUrl.split('/').pop() ?? 'remediation-queue',
                    tenantIdFromBody: (b) => (b as { tenantId?: string })?.tenantId,
                },
            );
        },
    });
    consumer.start().catch((err) => {
        logger.fatal({ err }, 'Remediation consumer fatal error');
    });
    return consumer;
}
