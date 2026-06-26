import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

const logger = pino({ name: 'approval' });

export interface ApprovalRequest {
  approvalId: string;
  requestId: string;
  tenantId: string;
  resourceId: string;
  operation: string;
  params: Record<string, unknown>;
  reason: string;
  createdAt: number;
}

export interface ApprovalDecision {
  approvalId: string;
  approved: boolean;
  approver?: string;
  at: number;
}

export interface ApprovalTransport {
  forward(request: ApprovalRequest): Promise<void>;
}

export class ApprovalManager {
  private pending = new Map<string, { resolve: (decision: ApprovalDecision) => void; timer: ReturnType<typeof setTimeout> }>();

  constructor(
    private readonly transport: ApprovalTransport,
    private readonly timeoutMs: number = 5 * 60_000,
  ) {}

  async request(params: Omit<ApprovalRequest, 'approvalId' | 'createdAt'>): Promise<ApprovalDecision> {
    const approvalId = uuidv4();
    const full: ApprovalRequest = {
      ...params,
      approvalId,
      createdAt: Date.now(),
    };
    await this.transport.forward(full);
    logger.info({ approvalId, requestId: params.requestId, reason: params.reason }, 'Awaiting approval');

    return new Promise<ApprovalDecision>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(approvalId);
        resolve({ approvalId, approved: false, at: Date.now() });
      }, this.timeoutMs);
      this.pending.set(approvalId, { resolve, timer });
    });
  }

  resolve(decision: ApprovalDecision): void {
    const entry = this.pending.get(decision.approvalId);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(decision.approvalId);
    entry.resolve(decision);
  }
}
