import type { ChatOutput } from '../../memory/application/chat.usecase.js';

export interface CustomerExplanation {
    summary: string;
    impact: string;
    resolution: string;
    eta?: string;
}

export interface WidgetResponseMessage {
    text: string;
    summary?: string;
    impact?: string;
    resolution?: string;
    eta?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    escalated?: boolean;
    incidentUrl?: string;
}

const PROGRESS_MESSAGES: Record<string, string> = {
    started: 'Iniciando investigação...',
    wave_started: 'Analisando dados...',
    agent_completed: 'Encontrei informações relevantes.',
    wave_completed: 'Etapa de análise concluída.',
    synthesizing: 'Compilando resultados...',
};

export class ResponseFormatter {
    formatChatResponse(chatOutput: ChatOutput, customerExplanation?: CustomerExplanation): WidgetResponseMessage {
        switch (chatOutput.intent) {
            case 'general':
                return { text: chatOutput.answer ?? '' };

            case 'memory_only':
                return { text: chatOutput.answer ?? 'Não tenho dados suficientes ainda.' };

            case 'live_check':
                if (chatOutput.status === 'processing') {
                    return { text: 'Verificando os dados agora. Vou te responder em instantes...' };
                }
                return { text: chatOutput.answer ?? '' };

            case 'incident': {
                const msg: WidgetResponseMessage = {
                    text: 'Estou investigando o problema. Vou verificar logs, métricas e mudanças recentes.',
                    escalated: false,
                    incidentUrl: chatOutput.incidentUrl,
                };
                if (customerExplanation) {
                    msg.text = customerExplanation.summary;
                    msg.summary = customerExplanation.summary;
                    msg.impact = customerExplanation.impact;
                    msg.resolution = customerExplanation.resolution;
                    msg.eta = customerExplanation.eta;
                    msg.escalated = true;
                }
                return msg;
            }

            default:
                return { text: chatOutput.answer ?? '' };
        }
    }

    formatProgressEvent(stage: string, message?: string): string {
        return message ?? PROGRESS_MESSAGES[stage] ?? 'Investigando...';
    }

    formatCompletionForWidget(customerExplanation: CustomerExplanation): WidgetResponseMessage {
        return {
            text: customerExplanation.summary,
            summary: customerExplanation.summary,
            impact: customerExplanation.impact,
            resolution: customerExplanation.resolution,
            eta: customerExplanation.eta,
            escalated: true,
        };
    }
}
