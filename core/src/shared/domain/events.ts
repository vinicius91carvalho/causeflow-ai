export interface DomainEvent {
  readonly eventType: string;
  readonly occurredAt: string;
  readonly tenantId: string;
  readonly payload: Record<string, unknown>;
}

export type EventHandler<T extends DomainEvent = DomainEvent> = (event: T) => void | Promise<void>;

export interface IEventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventType: string, handler: EventHandler): void;
  unsubscribe(eventType: string, handler: EventHandler): void;
}

export interface TenantCreatedEvent extends DomainEvent {
  eventType: 'tenant.created';
  payload: {
    tenantId: string;
    slug: string;
    plan: string;
  };
}

export interface TenantUpdatedEvent extends DomainEvent {
  eventType: 'tenant.updated';
  payload: {
    tenantId: string;
    changes: Record<string, unknown>;
  };
}

export interface IncidentCreatedEvent extends DomainEvent {
  eventType: 'incident.created';
  payload: {
    incidentId: string;
    severity: string;
    title: string;
    createdBy?: string;
  };
}

export interface IncidentStatusChangedEvent extends DomainEvent {
  eventType: 'incident.status_changed';
  payload: {
    incidentId: string;
    from: string;
    to: string;
    title?: string;
    severity?: string;
  };
}

export interface IncidentSeverityChangedEvent extends DomainEvent {
  eventType: 'incident.severity_changed';
  payload: {
    incidentId: string;
    severity: string;
    previousSeverity: string;
    title: string;
  };
}

export interface RemediationProposedEvent extends DomainEvent {
  eventType: 'remediation.proposed';
  payload: {
    incidentId: string;
    remediationId: string;
    description: string;
  };
}

export interface RemediationApprovedEvent extends DomainEvent {
  eventType: 'remediation.approved';
  payload: {
    incidentId: string;
    remediationId: string;
    approvedBy: string;
  };
}

export interface RemediationRejectedEvent extends DomainEvent {
  eventType: 'remediation.rejected';
  payload: {
    incidentId: string;
    remediationId: string;
    rejectedBy: string;
    reason: string;
  };
}

export interface RemediationExecutedEvent extends DomainEvent {
  eventType: 'remediation.executed';
  payload: {
    incidentId: string;
    remediationId: string;
    status: string;
    stepsCompleted: number;
    totalSteps: number;
  };
}

export interface InvestigationCompletedEvent extends DomainEvent {
  eventType: 'investigation.completed';
  payload: {
    incidentId: string;
    rootCause: string;
    agentsUsed: string[];
  };
}

export interface PatternExtractedEvent extends DomainEvent {
  eventType: 'knowledge.pattern_extracted';
  payload: {
    patternId: string;
    incidentId: string;
    isNew: boolean;
    confidence: number;
    status: string;
  };
}

export interface InvestigationProgressEvent extends DomainEvent {
  eventType: 'investigation.progress';
  payload: {
    incidentId: string;
    stage: string;
    agentRole?: string;
    message: string;
  };
}

export interface FeedbackRecordedEvent extends DomainEvent {
  eventType: 'knowledge.feedback_recorded';
  payload: {
    feedbackId: string;
    patternId?: string;
    incidentId: string;
    type: string;
    actor: string;
  };
}

export interface GraphNodeUpsertedEvent extends DomainEvent {
  eventType: 'graph.node_upserted';
  payload: {
    serviceId: string;
    name: string;
    type: string;
    isNew: boolean;
  };
}

export interface GraphEdgeUpsertedEvent extends DomainEvent {
  eventType: 'graph.edge_upserted';
  payload: {
    edgeId: string;
    sourceService: string;
    targetService: string;
    edgeType: string;
  };
}

export interface GraphChangeAddedEvent extends DomainEvent {
  eventType: 'graph.change_added';
  payload: {
    changeId: string;
    serviceId: string;
    changeType: string;
    description: string;
  };
}

export interface GraphInfraDiscoveredEvent extends DomainEvent {
  eventType: 'graph.infra_discovered';
  payload: {
    servicesDiscovered: number;
    serviceIds: string[];
  };
}

export interface RunbookExecutedEvent extends DomainEvent {
  eventType: 'knowledge.runbook_executed';
  payload: {
    patternId: string;
    incidentId: string;
    remediationId: string;
    confidence: number;
  };
}

export interface CredentialVendedEvent extends DomainEvent {
  eventType: 'credential.vended';
  payload: {
    tenantId: string;
    incidentId: string;
    agentRole: string;
    provider: string;
  };
}

export interface CredentialRevokedEvent extends DomainEvent {
  eventType: 'credential.revoked';
  payload: {
    tenantId: string;
    incidentId: string;
  };
}

export interface NotificationSentEvent extends DomainEvent {
  eventType: 'notification.sent';
  payload: {
    notificationId: string;
    type: string;
    channelId: string;
  };
}

export interface ApprovalRespondedEvent extends DomainEvent {
  eventType: 'notification.approval_responded';
  payload: {
    approvalId: string;
    remediationId: string;
    action: string;
    respondedBy: string;
  };
}

export interface IntegrationConnectedEvent extends DomainEvent {
  eventType: 'integration.connected';
  payload: {
    integrationId: string;
    provider: string;
    connectedBy: string;
  };
}

export interface IntegrationDisconnectedEvent extends DomainEvent {
  eventType: 'integration.disconnected';
  payload: {
    integrationId: string;
    provider: string;
    disconnectedBy: string;
  };
}

export interface TriggerCreatedEvent extends DomainEvent {
  eventType: 'trigger.created';
  payload: {
    triggerId: string;
    triggerSlug: string;
    provider: string;
  };
}

export interface TriggerDeletedEvent extends DomainEvent {
  eventType: 'trigger.deleted';
  payload: {
    triggerId: string;
    triggerSlug: string;
    provider: string;
  };
}

export interface TriggerEventReceivedEvent extends DomainEvent {
  eventType: 'trigger.event_received';
  payload: {
    triggerId: string;
    triggerSlug: string;
    provider: string;
    composioTriggerId: string;
    actionTaken: string;
    data: Record<string, unknown>;
  };
}

// --- EventBus Implementation (in-process, async) ---
export class EventBus {
  handlers = new Map<string, Set<EventHandler>>();
  errorLogger: ((eventType: string, err: unknown) => void) | undefined;
  setErrorLogger(fn: (eventType: string, err: unknown) => void): void {
    this.errorLogger = fn;
  }
  async publish(event: DomainEvent): Promise<void> {
    const eventHandlers = this.handlers.get(event.eventType);
    if (!eventHandlers) return;
    const promises = [...eventHandlers].map(async (handler) => {
      try {
        await handler(event);
      } catch (err) {
        if (this.errorLogger) {
          this.errorLogger(event.eventType, err);
        }
      }
    });
    await Promise.allSettled(promises);
  }
  subscribe(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }
  unsubscribe(eventType: string, handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler);
  }
}
