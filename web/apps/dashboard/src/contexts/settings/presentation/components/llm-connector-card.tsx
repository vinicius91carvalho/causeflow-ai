'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import type {
  LlmConnectorId,
  LlmConnectorResponse,
} from '@/contexts/settings/domain/llm-connector';
import { LLM_CONTEXT_TOO_LARGE_CODE } from '@/contexts/settings/domain/llm-connector';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';

/**
 * OSS settings surface for Core investigation LLM connector (AC-059).
 * Default: Ornith 9B on :8081. Fallback: DeepSeek V4 Flash via OpenCode Go
 * or NVIDIA NIM when Core reports LLM_CONTEXT_TOO_LARGE.
 */
export function LlmConnectorCard() {
  const t = useTranslations('dashboard.settings.llmConnector');
  const { addToast } = useToast();
  const [data, setData] = useState<LlmConnectorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<LlmConnectorId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/llm-connector');
      const body = (await res.json()) as LlmConnectorResponse & { error?: string };
      if (!res.ok) {
        setError(body.error ?? t('errorLoad'));
        setData(null);
        return;
      }
      setData(body);
    } catch {
      setError(t('errorLoad'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function selectConnector(connector: LlmConnectorId) {
    if (data?.active.id === connector) return;
    setSwitching(connector);
    try {
      const res = await fetch('/api/settings/llm-connector', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connector }),
      });
      const body = (await res.json()) as {
        active?: LlmConnectorResponse['active'];
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        addToast(body.hint ?? body.error ?? t('errorSwitch'), 'error');
        return;
      }
      addToast(t('switched', { label: body.active?.label ?? connector }), 'success');
      await load();
    } catch {
      addToast(t('errorSwitch'), 'error');
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div
      className="rounded-xl border border-border bg-card p-6 space-y-4"
      data-testid="llm-connector-card"
    >
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t('title')}</h3>
        <p className="text-xs text-muted-foreground mt-1">{t('description')}</p>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground" data-testid="llm-connector-loading">
          {t('loading')}
        </p>
      )}

      {error && (
        <p className="text-sm text-destructive" data-testid="llm-connector-error">
          {error}
        </p>
      )}

      {data && !loading && (
        <>
          <div
            className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
            data-testid="llm-connector-active"
            data-connector-id={data.active.id}
            data-connector-model={data.active.model}
          >
            <div className="font-medium text-foreground">
              {t('active')}: {data.active.label}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 font-mono">
              {data.active.model} · {data.active.contextWindowTokens.toLocaleString()} tokens
            </div>
          </div>

          <p
            className="text-xs text-muted-foreground"
            data-testid="llm-connector-overflow-code"
            data-overflow-code={data.contextOverflowCode || LLM_CONTEXT_TOO_LARGE_CODE}
          >
            {t('overflowHint', {
              code: data.contextOverflowCode || LLM_CONTEXT_TOO_LARGE_CODE,
            })}
          </p>

          <ul className="space-y-2" data-testid="llm-connector-options">
            {data.options.map((opt) => {
              const isActive = data.active.id === opt.id;
              const busy = switching === opt.id;
              return (
                <li
                  key={opt.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                  data-testid={`llm-connector-option-${opt.id}`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{opt.label}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {opt.model}
                      {!opt.credentialsConfigured && opt.id !== 'ornith'
                        ? ` · ${t('credsMissing')}`
                        : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isActive || busy || switching !== null}
                    onClick={() => void selectConnector(opt.id)}
                    className="shrink-0 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid={`llm-connector-select-${opt.id}`}
                  >
                    {isActive ? t('selected') : busy ? t('switching') : t('select')}
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="text-[11px] text-muted-foreground">{t('credsNote')}</p>
        </>
      )}
    </div>
  );
}
