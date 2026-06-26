/**
 * WebSocket client for the investigation worker side.
 *
 * Connects to the API server's investigation relay, sends checkpoints
 * and progress, and receives user guidance messages.
 *
 * Implements IInvestigationChannel for use in InvestigateIncidentUseCase.
 */
import WebSocket from 'ws';
import { logger } from '../logger.js';
import type { IInvestigationChannel, InvestigationCheckpoint, InvestigationProgress, InvestigationQuestion, InvestigationToolCall, InvestigationEvidence } from '../../application/ports/investigation-channel.port.js';
import type { AgentToUserMessage } from './investigation-relay-protocol.js';

export interface InvestigationCompleteData {
    rootCause?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    recommendedActions?: Array<{
        action: string;
        label?: string;
        description?: string;
        riskLevel?: string;
    }>;
    status?: string;
    costUsd?: number;
    durationMs?: number;
    agentsUsed?: string[];
}

export interface InvestigationIdleContext {
    title?: string;
    description?: string;
    rootCause?: string;
    status?: string;
    severity?: string;
}

export interface InvestigationWSClientConfig {
    relayUrl: string;
    token: string;
    tenantId: string;
    incidentId: string;
    /** Connection timeout in ms. Default: 5000 */
    connectTimeoutMs?: number;
}

export class InvestigationWSClient implements IInvestigationChannel {
    private ws: WebSocket | null = null;
    private guidanceHandler: ((guidance: string) => void) | null = null;
    private shutdownHandler: ((reason?: string) => void) | null = null;
    private connected = false;
    private config: InvestigationWSClientConfig;

    constructor(config: InvestigationWSClientConfig) {
        this.config = config;
    }

    /** Connect to the relay. Non-blocking — investigation continues even if connection fails. */
    async connect(): Promise<void> {
        const { relayUrl, token, tenantId, incidentId, connectTimeoutMs = 5000 } = this.config;

        const url = `${relayUrl}?tenantId=${encodeURIComponent(tenantId)}&incidentId=${encodeURIComponent(incidentId)}&role=worker&token=${encodeURIComponent(token)}`;

        return new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
                logger.warn({ tenantId, incidentId }, 'Investigation relay connection timed out — continuing without relay');
                resolve();
            }, connectTimeoutMs);

            try {
                // WAF requires Origin + User-Agent headers (NoUserAgent_HEADER rule in AWS CommonRuleSet)
                const origin = relayUrl.replace('wss://', 'https://').replace('ws://', 'http://').split('/v1')[0];
                this.ws = new WebSocket(url, {
                    headers: {
                        'Origin': origin,
                        'User-Agent': 'CauseFlow-Worker/1.0',
                    },
                });

                this.ws.on('open', () => {
                    clearTimeout(timeout);
                    this.connected = true;
                    logger.info({ tenantId, incidentId }, 'Investigation relay connected (worker)');
                    resolve();
                });

                this.ws.on('message', (data: Buffer | string) => {
                    try {
                        const msg = JSON.parse(typeof data === 'string' ? data : data.toString());
                        if (msg.type === 'guidance' && this.guidanceHandler) {
                            this.guidanceHandler(msg.message);
                        } else if (msg.type === 'answer' && this.guidanceHandler) {
                            // Forward structured answer as JSON so checkpoint handler can extract questionId
                            this.guidanceHandler(JSON.stringify({ questionId: msg.questionId, answer: msg.answer }));
                        } else if (msg.type === 'shutdown' && this.shutdownHandler) {
                            this.shutdownHandler(msg.reason);
                        }
                    } catch { /* ignore malformed messages */ }
                });

                this.ws.on('close', () => {
                    this.connected = false;
                    logger.info({ tenantId, incidentId }, 'Investigation relay disconnected (worker)');
                });

                this.ws.on('error', (err) => {
                    clearTimeout(timeout);
                    this.connected = false;
                    logger.warn({ err: err.message, tenantId, incidentId }, 'Investigation relay connection failed — continuing without relay');
                    resolve(); // Don't block investigation
                });
            } catch (err) {
                clearTimeout(timeout);
                logger.warn({ err, tenantId, incidentId }, 'Failed to create WebSocket — continuing without relay');
                resolve();
            }
        });
    }

    sendCheckpoint(data: InvestigationCheckpoint): void {
        this.send({
            type: 'checkpoint',
            incidentId: this.config.incidentId,
            stage: data.stage,
            finding: data.finding,
            confidence: data.confidence,
            toolCallCount: data.toolCallCount,
            turn: data.turn,
            severity: data.severity,
            category: data.category,
            timestamp: new Date().toISOString(),
        });
    }

    sendQuestion(data: InvestigationQuestion): void {
        this.send({
            type: 'question',
            incidentId: this.config.incidentId,
            questionId: data.questionId,
            question: data.question,
            options: data.options,
            timeoutMs: data.timeoutMs ?? 60000,
            timestamp: new Date().toISOString(),
        });
    }

    sendProgress(data: InvestigationProgress): void {
        this.send({
            type: 'progress',
            incidentId: this.config.incidentId,
            stage: data.stage,
            message: data.message,
            turn: data.turn,
            maxTurns: data.maxTurns,
            timestamp: new Date().toISOString(),
        });
    }

    sendToolCall(data: InvestigationToolCall): void {
        this.send({
            type: 'tool_call',
            incidentId: this.config.incidentId,
            toolName: data.toolName,
            input: data.input,
            timestamp: new Date().toISOString(),
        });
    }

    sendEvidence(data: InvestigationEvidence): void {
        this.send({
            type: 'evidence',
            incidentId: this.config.incidentId,
            evidenceId: data.evidenceId,
            agentRole: data.agentRole,
            evidenceType: data.evidenceType,
            content: data.content,
            metadata: data.metadata,
            timestamp: new Date().toISOString(),
        });
    }

    onGuidance(handler: (guidance: string) => void): void {
        this.guidanceHandler = handler;
    }

    onShutdown(handler: (reason?: string) => void): void {
        this.shutdownHandler = handler;
    }

    isConnected(): boolean {
        return this.connected && this.ws?.readyState === WebSocket.OPEN;
    }

    /** Send completion message and close connection */
    complete(data?: InvestigationCompleteData): void {
        this.sendComplete(data);
        this.close();
    }

    /** Send completion message WITHOUT closing — use when entering idle mode */
    sendComplete(data?: InvestigationCompleteData): void {
        this.send({
            type: 'complete',
            incidentId: this.config.incidentId,
            rootCause: data?.rootCause,
            severity: data?.severity,
            recommendedActions: data?.recommendedActions,
            status: data?.status,
            costUsd: data?.costUsd,
            durationMs: data?.durationMs,
            agentsUsed: data?.agentsUsed,
            timestamp: new Date().toISOString(),
        });
    }

    /** Signal that the worker is idle and available for follow-up questions */
    sendIdle(summary: string, expiresAt: Date, context?: InvestigationIdleContext): void {
        this.send({
            type: 'idle',
            incidentId: this.config.incidentId,
            summary,
            context,
            expiresAt: expiresAt.toISOString(),
            timestamp: new Date().toISOString(),
        });
    }

    /** Send a follow-up response to a user question */
    sendFollowup(message: string): void {
        this.send({
            type: 'followup',
            incidentId: this.config.incidentId,
            message,
            timestamp: new Date().toISOString(),
        });
    }

    /** Send error message and close connection */
    error(message: string): void {
        this.send({
            type: 'error',
            incidentId: this.config.incidentId,
            message,
            timestamp: new Date().toISOString(),
        });
        this.close();
    }

    close(): void {
        if (this.ws) {
            try { this.ws.close(); } catch { /* ignore */ }
            this.ws = null;
            this.connected = false;
        }
    }

    private send(message: AgentToUserMessage): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        try {
            this.ws.send(JSON.stringify(message));
        } catch (err) {
            logger.warn({ err, type: message.type }, 'Failed to send investigation relay message');
        }
    }
}
