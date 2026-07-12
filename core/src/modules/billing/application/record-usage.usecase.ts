import { v4 as uuid } from 'uuid';
import { usageRecordId } from '../../../shared/domain/value-objects.js';
import type { UsageType } from '../../../shared/domain/types.js';
import type { IBillingAccountRepository } from '../domain/billing-account.repository.js';
import type { IUsageRecordRepository } from '../domain/usage-record.repository.js';
import type { UsageRecord, AgentUsageBreakdown } from '../domain/usage-record.entity.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { IncidentId, TenantId } from '../../../shared/domain/value-objects.js';
import type { IMeterEventService } from './ports/meter-event.port.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';

export interface RecordUsageInput {
  tenantId: TenantId;
  type: UsageType;
  incidentId?: IncidentId;
  costUsd?: number;
  agentBreakdown?: AgentUsageBreakdown[];
}

export class RecordUsageUseCase {
  billingAccountRepo;
  usageRecordRepo;
  eventBus;
  meterEventService;
  tenantRepo;
  constructor(
    billingAccountRepo: IBillingAccountRepository,
    usageRecordRepo: IUsageRecordRepository,
    eventBus?: IEventBus,
    meterEventService?: IMeterEventService,
    tenantRepo?: ITenantRepository,
  ) {
    this.billingAccountRepo = billingAccountRepo;
    this.usageRecordRepo = usageRecordRepo;
    this.eventBus = eventBus;
    this.meterEventService = meterEventService;
    this.tenantRepo = tenantRepo;
  }
  async execute(input: RecordUsageInput): Promise<UsageRecord> {
    // Atomically increment the counter on the billing account
    const incremented = await this.billingAccountRepo.incrementUsageAtomic(
      input.tenantId,
      input.type,
    );
    // If increment failed (quota exceeded), we still record but flag it
    const record = {
      tenantId: input.tenantId,
      recordId: usageRecordId(uuid()),
      type: input.type,
      incidentId: input.incidentId,
      costUsd: input.costUsd,
      ...(input.agentBreakdown && { agentBreakdown: input.agentBreakdown }),
      createdAt: new Date().toISOString(),
    };
    const saved = await this.usageRecordRepo.create(record);
    if (this.eventBus) {
      await this.eventBus.publish({
        eventType: 'usage.recorded',
        occurredAt: new Date().toISOString(),
        tenantId: input.tenantId,
        payload: {
          type: input.type,
          recordId: saved.recordId,
          incremented,
        },
      });
    }
    // Send Stripe meter event (fire-and-forget)
    if (this.meterEventService && this.tenantRepo) {
      const tenant = await this.tenantRepo.findById(input.tenantId);
      if (tenant?.stripeCustomerId) {
        const eventName =
          input.type === 'investigation' ? 'causeflow_investigation' : 'causeflow_alert_ingested';
        this.meterEventService
          .reportUsage({
            eventName,
            stripeCustomerId: tenant.stripeCustomerId,
          })
          .catch(() => {}); // Already logged in service
      }
    }

    return saved;
  }
}
