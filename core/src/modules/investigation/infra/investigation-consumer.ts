/**
 * SQS investigation consumer — AWS runtime only.
 *
 * In the AWS runtime, the triage worker enqueues a message to the investigation
 * SQS queue. This consumer picks it up and dispatches an ECS Fargate task via
 * the dynamically-imported `ecs-task-dispatcher` module.
 *
 * In the OSS local runtime this consumer is NEVER started — the BullMQ-based
 * flow routes through `causeflow-worker` directly (see startBullConsumer in
 * `investigation-worker.ts`).
 *
 * The `@aws-sdk/client-ecs` import is dynamically loaded so it is never
 * touched in OSS mode, satisfying AC-045.
 */
import { createSQSConsumer } from '../../../shared/infra/queue/sqs-consumer.js';
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
          // Dynamically import the ECS dispatcher so @aws-sdk/client-ecs
          // is only loaded in the AWS runtime, never in OSS mode.
          const { dispatchInvestigation } =
            await import('../../../shared/infra/investigation/ecs-task-dispatcher.js');
          await dispatchInvestigation({
            tenantId: b.tenantId,
            incidentId: b.incidentId,
            suggestedAgents: b.suggestedAgents ?? [
              'log_analyst',
              'metric_analyst',
              'change_detector',
              'code_analyzer',
              'infra_inspector',
              'db_analyst',
            ],
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
