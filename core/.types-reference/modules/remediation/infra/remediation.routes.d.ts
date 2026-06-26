import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { ProposeRemediationUseCase } from '../application/propose-remediation.usecase.js';
import type { ApproveRemediationUseCase } from '../application/approve-remediation.usecase.js';
import type { RejectRemediationUseCase } from '../application/reject-remediation.usecase.js';
import type { ExecuteRemediationUseCase } from '../application/execute-remediation.usecase.js';
import type { GetRemediationUseCase } from '../application/get-remediation.usecase.js';
import type { RecordRemediationFeedbackUseCase } from '../application/record-remediation-feedback.usecase.js';
export interface RemediationUseCases {
    proposeRemediation: ProposeRemediationUseCase;
    approveRemediation: ApproveRemediationUseCase;
    rejectRemediation: RejectRemediationUseCase;
    executeRemediation: ExecuteRemediationUseCase;
    getRemediation: GetRemediationUseCase;
    recordRemediationFeedback?: RecordRemediationFeedbackUseCase;
}
export declare function createRemediationRoutes(useCases: RemediationUseCases): Hono<AppEnv, import("hono/types").BlankSchema, "/">;
