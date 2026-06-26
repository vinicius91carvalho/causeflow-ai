import type { ProposeRemediationUseCase } from '../application/propose-remediation.usecase.js';
export declare function startRemediationConsumer(queueUrl: string, proposeRemediation: ProposeRemediationUseCase): {
    start: () => Promise<void>;
    stop: () => void;
};
