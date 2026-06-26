/**
 * Bidirectional communication channel between investigation agent and user.
 * Used by the orchestrator to send checkpoints/progress and receive guidance.
 */
export interface InvestigationCheckpoint {
    stage: string;
    finding: string;
    confidence?: number;
    toolCallCount?: number;
    turn?: number;
    severity?: 'info' | 'warning' | 'critical';
    category?: string;
}

export interface InvestigationProgress {
    stage: string;
    message: string;
    turn?: number;
    maxTurns?: number;
}

export interface InvestigationQuestion {
    questionId: string;
    question: string;
    options?: string[];
    timeoutMs?: number;
}

export interface InvestigationToolCall {
    toolName: string;
    input?: Record<string, unknown>;
}

export interface InvestigationEvidence {
    evidenceId: string;
    agentRole: string;
    evidenceType: string;
    content: string;
    metadata?: Record<string, unknown>;
}

export interface IInvestigationChannel {
    /** Send a key finding to the user */
    sendCheckpoint(data: InvestigationCheckpoint): void;
    /** Send a progress update */
    sendProgress(data: InvestigationProgress): void;
    /** Send a structured question to the user (with options + timeout) */
    sendQuestion(data: InvestigationQuestion): void;
    /** Send a tool call notification (real-time visibility) */
    sendToolCall(data: InvestigationToolCall): void;
    /** Send evidence collected during investigation */
    sendEvidence(data: InvestigationEvidence): void;
    /** Register handler for user guidance messages */
    onGuidance(handler: (guidance: string) => void): void;
    /** Register handler for server-issued shutdown signal (e.g. all dashboards disconnected) */
    onShutdown?(handler: (reason?: string) => void): void;
    /** Whether a user is actively connected */
    isConnected(): boolean;
}
