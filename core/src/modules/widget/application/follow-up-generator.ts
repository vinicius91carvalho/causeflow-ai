import type { LLMClient } from '../../../shared/application/ports/llm-client.port.js';
import type { WidgetMessage } from '../domain/widget-session.entity.js';
import { logger } from '../../../shared/infra/logger.js';

const FOLLOW_UP_PROMPT = `You are a support assistant for CauseFlow, an AI SRE platform.
The user (a support agent) sent a message but it lacks critical context to start an investigation.

Based on the message and conversation history, generate 2-3 concise follow-up questions to gather missing information.
Focus on: which service/system is affected, when the issue started, which customers are impacted.

Return ONLY valid JSON:
{
  "needsFollowUp": true|false,
  "questions": ["question1", "question2"],
  "reasoning": "brief explanation"
}

If the message has enough context (mentions a service or clear issue), set needsFollowUp to false.
Questions should be in the same language as the user's message.`;

export class FollowUpGenerator {
    private llmClient: LLMClient;

    constructor(llmClient: LLMClient) {
        this.llmClient = llmClient;
    }

    async generate(
        message: string,
        conversationHistory: WidgetMessage[],
    ): Promise<string[] | null> {
        try {
            const historyContext = conversationHistory.length > 0
                ? '\n\nConversation history:\n' + conversationHistory
                    .slice(-6)
                    .map((m) => `${m.role}: ${m.content}`)
                    .join('\n')
                : '';

            const result = await this.llmClient.complete({
                model: 'claude-haiku-4-5',
                systemPrompt: FOLLOW_UP_PROMPT,
                userPrompt: `User message: "${message}"${historyContext}`,
                maxTokens: 300,
                temperature: 0,
            });

            const jsonStr = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]) as { needsFollowUp?: boolean; questions?: string[]; reasoning?: string };
                if (parsed.needsFollowUp && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
                    return parsed.questions;
                }
            }
            return null;
        } catch (err) {
            logger.warn({ err }, 'Follow-up generation failed, proceeding without follow-ups');
            return null;
        }
    }
}
