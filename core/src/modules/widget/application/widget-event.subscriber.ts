import type { IEventBus } from '../../../shared/domain/events.js';
import type { SSEManager } from '../../../shared/infra/chat/sse-manager.js';
import type { IWidgetSessionRepository } from '../domain/widget-session.repository.js';
import type { DataMaskingConfig } from '../domain/data-masking.types.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import { DEFAULT_DATA_MASKING_CONFIG } from '../domain/data-masking.types.js';
import type { DataMasker } from './data-masker.js';
import type { ResponseFormatter } from './response-formatter.js';
import type { WebPushAdapter } from '../infra/web-push.adapter.js';
import type { CustomerExplanation } from './response-formatter.js';
import { tenantId as toTenantId } from '../../../shared/domain/value-objects.js';
import { logger } from '../../../shared/infra/logger.js';

export interface WidgetEventSubscriberDeps {
    eventBus: IEventBus;
    sessionRepo: IWidgetSessionRepository;
    sseManager: SSEManager;
    tenantRepo: ITenantRepository;
    dataMasker: DataMasker;
    responseFormatter: ResponseFormatter;
    pushAdapter?: WebPushAdapter;
}

export function registerWidgetEventSubscribers(deps: WidgetEventSubscriberDeps): void {
    const { eventBus, sseManager, tenantRepo, dataMasker, responseFormatter, pushAdapter } = deps;

    // Forward investigation progress to widget SSE clients with masking
    eventBus.subscribe('investigation.progress', async (event) => {
        const tid = event.tenantId;
        if (!tid) return;

        const tenant = await tenantRepo.findById(toTenantId(tid));
        const maskingConfig: DataMaskingConfig = tenant?.settings?.widgetConfig?.dataMasking ?? DEFAULT_DATA_MASKING_CONFIG;

        const progressPayload = event.payload as { stage?: string; message?: string; incidentId?: string };
        const stage = progressPayload.stage ?? 'unknown';
        const message = responseFormatter.formatProgressEvent(
            stage,
            progressPayload.message,
        );

        const maskedMessage = dataMasker.mask(message, maskingConfig);

        await sseManager.broadcast(tid, {
            event: 'widget.progress',
            data: {
                incidentId: progressPayload.incidentId,
                stage,
                message: maskedMessage,
            },
        });
    });

    // Forward investigation completion to widget with customer explanation
    eventBus.subscribe('investigation.completed', async (event) => {
        const tid = event.tenantId;
        if (!tid) return;

        const tenant = await tenantRepo.findById(toTenantId(tid));
        const maskingConfig: DataMaskingConfig = tenant?.settings?.widgetConfig?.dataMasking ?? DEFAULT_DATA_MASKING_CONFIG;
        const completionPayload = event.payload as { customerExplanation?: CustomerExplanation; incidentId?: string };

        const customerExplanation = completionPayload.customerExplanation;
        if (customerExplanation) {
            const formatted = responseFormatter.formatCompletionForWidget(customerExplanation);
            formatted.text = dataMasker.mask(formatted.text, maskingConfig);
            if (formatted.summary) formatted.summary = dataMasker.mask(formatted.summary, maskingConfig);
            if (formatted.impact) formatted.impact = dataMasker.mask(formatted.impact, maskingConfig);
            if (formatted.resolution) formatted.resolution = dataMasker.mask(formatted.resolution, maskingConfig);

            await sseManager.broadcast(tid, {
                event: 'widget.completed',
                data: {
                    incidentId: completionPayload.incidentId,
                    response: formatted,
                },
            });
        }

        // Send push notification if there are no connected SSE clients for this tenant
        if (pushAdapter && sseManager.getClientCount(tid) === 0) {
            logger.info({ tenantId: tid }, 'No SSE clients connected, attempting push notification');
            // Push notifications would be sent to sessions with registered subscriptions
            // This is handled at the session level in the widget routes
        }
    });
}
