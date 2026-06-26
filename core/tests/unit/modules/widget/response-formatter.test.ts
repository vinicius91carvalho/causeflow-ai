import { describe, it, expect } from 'vitest';
import { ResponseFormatter } from '../../../../src/modules/widget/application/response-formatter.js';
import type { ChatOutput } from '../../../../src/modules/memory/application/chat.usecase.js';

describe('ResponseFormatter', () => {
  const formatter = new ResponseFormatter();

  it('should format general intent response', () => {
    const chatOutput: ChatOutput = {
      chatId: 'chat-1',
      message: 'hello',
      intent: 'general',
      status: 'completed',
      answer: 'I am CauseFlow, your AI SRE assistant.',
    };

    const result = formatter.formatChatResponse(chatOutput);
    expect(result.text).toBe('I am CauseFlow, your AI SRE assistant.');
    expect(result.escalated).toBeUndefined();
  });

  it('should format memory_only intent response', () => {
    const chatOutput: ChatOutput = {
      chatId: 'chat-2',
      message: 'what happened last week?',
      intent: 'memory_only',
      status: 'completed',
      answer: 'Last week there were 3 OTP failures.',
    };

    const result = formatter.formatChatResponse(chatOutput);
    expect(result.text).toBe('Last week there were 3 OTP failures.');
  });

  it('should format live_check processing response', () => {
    const chatOutput: ChatOutput = {
      chatId: 'chat-3',
      message: 'any errors?',
      intent: 'live_check',
      status: 'processing',
    };

    const result = formatter.formatChatResponse(chatOutput);
    expect(result.text).toContain('Verificando');
  });

  it('should format live_check completed response', () => {
    const chatOutput: ChatOutput = {
      chatId: 'chat-4',
      message: 'any errors?',
      intent: 'live_check',
      status: 'completed',
      answer: 'No errors found in the last hour.',
    };

    const result = formatter.formatChatResponse(chatOutput);
    expect(result.text).toBe('No errors found in the last hour.');
  });

  it('should format incident response without customer explanation', () => {
    const chatOutput: ChatOutput = {
      chatId: 'chat-5',
      message: 'client X cant login',
      intent: 'incident',
      status: 'processing',
      incidentId: 'inc-1',
      incidentUrl: '/dashboard/analyses/inc-1',
    };

    const result = formatter.formatChatResponse(chatOutput);
    expect(result.text).toContain('investigando');
    expect(result.escalated).toBe(false);
    expect(result.incidentUrl).toBe('/dashboard/analyses/inc-1');
  });

  it('should format incident response with customer explanation', () => {
    const chatOutput: ChatOutput = {
      chatId: 'chat-6',
      message: 'OTP not received',
      intent: 'incident',
      status: 'completed',
      incidentId: 'inc-2',
    };
    const explanation = {
      summary: 'SMS provider Twilio had a regional outage.',
      impact: '47 customers affected in the last 2 hours.',
      resolution: 'Failover to backup provider has been activated.',
      eta: '15 minutes',
    };

    const result = formatter.formatChatResponse(chatOutput, explanation);
    expect(result.text).toBe('SMS provider Twilio had a regional outage.');
    expect(result.summary).toBe('SMS provider Twilio had a regional outage.');
    expect(result.impact).toBe('47 customers affected in the last 2 hours.');
    expect(result.resolution).toBe('Failover to backup provider has been activated.');
    expect(result.eta).toBe('15 minutes');
    expect(result.escalated).toBe(true);
  });

  it('should format progress events with default messages', () => {
    expect(formatter.formatProgressEvent('started')).toBe('Iniciando investigação...');
    expect(formatter.formatProgressEvent('synthesizing')).toBe('Compilando resultados...');
    expect(formatter.formatProgressEvent('unknown_stage')).toBe('Investigando...');
  });

  it('should use custom message for progress events when provided', () => {
    expect(formatter.formatProgressEvent('wave_started', 'Checking logs...'))
      .toBe('Checking logs...');
  });

  it('should format completion for widget', () => {
    const explanation = {
      summary: 'Database connection pool exhaustion.',
      impact: 'Users saw 502 errors for 15 minutes.',
      resolution: 'Scaling API instances.',
      eta: '30 minutes',
    };

    const result = formatter.formatCompletionForWidget(explanation);
    expect(result.text).toBe('Database connection pool exhaustion.');
    expect(result.escalated).toBe(true);
    expect(result.eta).toBe('30 minutes');
  });
});
