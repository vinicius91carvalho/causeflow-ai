import { logger } from '../../infra/logger.js';
import type { IEventBus, DomainEvent } from '../../domain/events.js';
import type { ChatPlatform } from '../ports/chat-platform.port.js';
export function registerFeedbackPromptSubscriber(deps: { eventBus: IEventBus; chatPlatform: ChatPlatform }): void {
    deps.eventBus.subscribe('investigation.completed', async (event: DomainEvent) => {
        const rootCause = (event.payload['rootCause'] as string) ?? '';
        if (rootCause.length < 20)
            return;
        const incidentId = (event.payload['incidentId'] as string) ?? '';
        try {
            await deps.chatPlatform.requestApproval({
                channelId: event.tenantId,
                title: 'RCA Feedback Required',
                description: `Investigation completed for incident ${incidentId}.\n\nRoot Cause: ${rootCause.slice(0, 200)}`,
                actions: [
                    { label: 'Confirm RCA', value: 'confirm_rca', style: 'primary' },
                    { label: 'Reject RCA', value: 'reject_rca', style: 'danger' },
                ],
                timeoutMinutes: 60,
                metadata: { incidentId, type: 'rca_feedback' },
            });
        }
        catch (err) {
            logger.error({ err, incidentId }, 'Failed to send RCA feedback prompt');
        }
    });
}
