'use client';

import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { PERMISSION } from '@/contexts/identity/domain/rbac/permissions';
import { usePermission } from '@/contexts/identity/domain/rbac/role-guard';
import type {
  InvestigationLlmProfile,
  InvestigationLlmProfilesResponse,
} from '@/contexts/settings/domain/investigation-llm-profile';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';

interface CreateFormState {
  label: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  contextWindowTokens: string;
}

const EMPTY_FORM: CreateFormState = {
  label: '',
  baseUrl: '',
  model: '',
  apiKey: '',
  contextWindowTokens: '',
};

/**
 * OSS settings surface for custom Investigation LLM profiles (AC-084).
 */
export function InvestigationLlmProfilesCard() {
  const t = useTranslations('dashboard.settings.investigationLlmProfiles');
  const { addToast } = useToast();
  const canManage = usePermission(PERMISSION.MANAGE_SETTINGS);

  const [items, setItems] = useState<InvestigationLlmProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/investigation-llm-profiles');
      const body = (await res.json()) as InvestigationLlmProfilesResponse & { error?: string };
      if (!res.ok) {
        setError(body.error ?? t('errorLoad'));
        setItems([]);
        return;
      }
      setItems(body.items ?? []);
    } catch {
      setError(t('errorLoad'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateForm<K extends keyof CreateFormState>(key: K, value: CreateFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) return;

    const label = form.label.trim();
    const baseUrl = form.baseUrl.trim();
    const model = form.model.trim();
    if (!label || !baseUrl || !model) {
      addToast(t('validationRequired'), 'error');
      return;
    }

    const payload: Record<string, string | number> = { label, baseUrl, model };
    const apiKey = form.apiKey.trim();
    if (apiKey) payload.apiKey = apiKey;
    const tokensRaw = form.contextWindowTokens.trim();
    if (tokensRaw) {
      const tokens = Number.parseInt(tokensRaw, 10);
      if (!Number.isInteger(tokens) || tokens <= 0) {
        addToast(t('validationContextWindow'), 'error');
        return;
      }
      payload.contextWindowTokens = tokens;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/settings/investigation-llm-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as InvestigationLlmProfile & { error?: string };
      if (!res.ok) {
        addToast(body.error ?? t('errorCreate'), 'error');
        return;
      }
      addToast(t('created', { label: body.label }), 'success');
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch {
      addToast(t('errorCreate'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="rounded-xl border border-border bg-card p-6 space-y-4"
      data-testid="investigation-llm-profiles-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t('title')}</h3>
          <p className="text-xs text-muted-foreground mt-1">{t('description')}</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowForm((open) => !open)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
            data-testid="investigation-llm-profile-toggle-form"
          >
            <Plus className="h-3.5 w-3.5" />
            {showForm ? t('cancel') : t('create')}
          </button>
        )}
      </div>

      {loading && (
        <p
          className="text-sm text-muted-foreground"
          data-testid="investigation-llm-profiles-loading"
        >
          {t('loading')}
        </p>
      )}

      {error && (
        <p className="text-sm text-destructive" data-testid="investigation-llm-profiles-error">
          {error}
        </p>
      )}

      {showForm && canManage && (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="rounded-lg border border-border bg-muted/20 p-4 space-y-3"
          data-testid="investigation-llm-profile-form"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs">
              <span className="font-medium text-foreground">{t('labelField')}</span>
              <input
                required
                value={form.label}
                onChange={(e) => updateForm('label', e.target.value)}
                placeholder={t('labelPlaceholder')}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                data-testid="investigation-llm-profile-label"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium text-foreground">{t('modelField')}</span>
              <input
                required
                value={form.model}
                onChange={(e) => updateForm('model', e.target.value)}
                placeholder={t('modelPlaceholder')}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                data-testid="investigation-llm-profile-model"
              />
            </label>
          </div>
          <label className="block space-y-1 text-xs">
            <span className="font-medium text-foreground">{t('baseUrlField')}</span>
            <input
              required
              type="url"
              value={form.baseUrl}
              onChange={(e) => updateForm('baseUrl', e.target.value)}
              placeholder={t('baseUrlPlaceholder')}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              data-testid="investigation-llm-profile-base-url"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs">
              <span className="font-medium text-foreground">{t('apiKeyField')}</span>
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => updateForm('apiKey', e.target.value)}
                placeholder={t('apiKeyPlaceholder')}
                autoComplete="off"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                data-testid="investigation-llm-profile-api-key"
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium text-foreground">{t('contextWindowField')}</span>
              <input
                inputMode="numeric"
                value={form.contextWindowTokens}
                onChange={(e) => updateForm('contextWindowTokens', e.target.value)}
                placeholder={t('contextWindowPlaceholder')}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                data-testid="investigation-llm-profile-context-window"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            data-testid="investigation-llm-profile-create"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {submitting ? t('creating') : t('saveProfile')}
          </button>
        </form>
      )}

      {!loading && !error && (
        <ul className="space-y-2" data-testid="investigation-llm-profile-list">
          {items.length === 0 ? (
            <li
              className="text-sm text-muted-foreground"
              data-testid="investigation-llm-profile-empty"
            >
              {t('empty')}
            </li>
          ) : (
            items.map((profile) => (
              <li
                key={profile.id}
                className="rounded-lg border border-border px-3 py-2 text-sm"
                data-testid={`investigation-llm-profile-item-${profile.id}`}
                data-profile-label={profile.label}
              >
                <div className="font-medium text-foreground">{profile.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                  {profile.model} · {profile.baseUrl}
                  {profile.contextWindowTokens
                    ? ` · ${profile.contextWindowTokens.toLocaleString()} tokens`
                    : ''}
                  {profile.apiKeyConfigured ? ` · ${t('apiKeyConfigured')}` : ''}
                </div>
              </li>
            ))
          )}
        </ul>
      )}

      {!canManage && <p className="text-[11px] text-muted-foreground">{t('adminOnly')}</p>}
    </div>
  );
}
