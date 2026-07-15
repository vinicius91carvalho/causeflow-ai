'use client';

import { Check, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { PERMISSION } from '@/contexts/identity/domain/rbac/permissions';
import { usePermission } from '@/contexts/identity/domain/rbac/role-guard';
import type {
  InvestigationLlmProfile,
  InvestigationLlmProfilesResponse,
} from '@/contexts/settings/domain/investigation-llm-profile';
import {
  INVESTIGATION_LLM_PROFILE_PRESETS,
  type InvestigationLlmProfilePreset,
} from '@/contexts/settings/domain/investigation-llm-profile-presets';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';

interface ProfileFormState {
  label: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  contextWindowTokens: string;
}

const EMPTY_FORM: ProfileFormState = {
  label: '',
  baseUrl: '',
  model: '',
  apiKey: '',
  contextWindowTokens: '',
};

/**
 * OSS settings surface for custom Investigation LLM profiles (AC-084, AC-085, AC-086, AC-087).
 */
export function InvestigationLlmProfilesCard() {
  const t = useTranslations('dashboard.settings.investigationLlmProfiles');
  const { addToast } = useToast();
  const canManage = usePermission(PERMISSION.MANAGE_SETTINGS);

  const [items, setItems] = useState<InvestigationLlmProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProfileFormState>(EMPTY_FORM);

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
      setActiveProfileId(body.activeProfileId ?? null);
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

  function resetFormState() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  }

  function updateForm<K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function applyPreset(preset: InvestigationLlmProfilePreset) {
    setEditingId(null);
    setShowForm(true);
    setForm({
      label: preset.label,
      baseUrl: preset.baseUrl,
      model: preset.model,
      apiKey: '',
      contextWindowTokens: preset.contextWindowTokens ? String(preset.contextWindowTokens) : '',
    });
  }

  function startEdit(profile: InvestigationLlmProfile) {
    setEditingId(profile.id);
    setShowForm(true);
    setForm({
      label: profile.label,
      baseUrl: profile.baseUrl,
      model: profile.model,
      apiKey: '',
      contextWindowTokens: profile.contextWindowTokens ? String(profile.contextWindowTokens) : '',
    });
  }

  function buildPayload(): Record<string, string | number> | null {
    const label = form.label.trim();
    const baseUrl = form.baseUrl.trim();
    const model = form.model.trim();
    if (!label || !baseUrl || !model) {
      addToast(t('validationRequired'), 'error');
      return null;
    }

    const payload: Record<string, string | number> = { label, baseUrl, model };
    const apiKey = form.apiKey.trim();
    if (apiKey) payload.apiKey = apiKey;
    const tokensRaw = form.contextWindowTokens.trim();
    if (tokensRaw) {
      const tokens = Number.parseInt(tokensRaw, 10);
      if (!Number.isInteger(tokens) || tokens <= 0) {
        addToast(t('validationContextWindow'), 'error');
        return null;
      }
      payload.contextWindowTokens = tokens;
    }
    return payload;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) return;

    const payload = buildPayload();
    if (!payload) return;

    setSubmitting(true);
    try {
      const isEdit = Boolean(editingId);
      const res = await fetch(
        isEdit
          ? `/api/settings/investigation-llm-profiles/${encodeURIComponent(editingId!)}`
          : '/api/settings/investigation-llm-profiles',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const body = (await res.json()) as InvestigationLlmProfile & { error?: string };
      if (!res.ok) {
        addToast(body.error ?? (isEdit ? t('errorUpdate') : t('errorCreate')), 'error');
        return;
      }
      addToast(
        isEdit ? t('updated', { label: body.label }) : t('created', { label: body.label }),
        'success',
      );
      resetFormState();
      await load();
    } catch {
      addToast(editingId ? t('errorUpdate') : t('errorCreate'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleActivate(profile: InvestigationLlmProfile) {
    if (!canManage || profile.isActive || activeProfileId === profile.id) return;

    setActivatingId(profile.id);
    try {
      const res = await fetch(
        `/api/settings/investigation-llm-profiles/${encodeURIComponent(profile.id)}/activate`,
        { method: 'POST' },
      );
      const body = (await res.json()) as { error?: string; activeProfileId?: string };
      if (!res.ok) {
        addToast(body.error ?? t('errorActivate'), 'error');
        return;
      }
      addToast(t('activated', { label: profile.label }), 'success');
      await load();
    } catch {
      addToast(t('errorActivate'), 'error');
    } finally {
      setActivatingId(null);
    }
  }

  async function handleDelete(profile: InvestigationLlmProfile) {
    if (!canManage) return;
    if (!window.confirm(t('deleteConfirm', { label: profile.label }))) return;

    setDeletingId(profile.id);
    try {
      const res = await fetch(
        `/api/settings/investigation-llm-profiles/${encodeURIComponent(profile.id)}`,
        { method: 'DELETE' },
      );
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        addToast(body.error ?? t('errorDelete'), 'error');
        return;
      }
      addToast(t('deleted', { label: profile.label }), 'success');
      if (editingId === profile.id) resetFormState();
      await load();
    } catch {
      addToast(t('errorDelete'), 'error');
    } finally {
      setDeletingId(null);
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
            onClick={() => (showForm && !editingId ? resetFormState() : startCreate())}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
            data-testid="investigation-llm-profile-toggle-form"
          >
            <Plus className="h-3.5 w-3.5" />
            {showForm && !editingId ? t('cancel') : t('create')}
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
          onSubmit={(e) => void handleSubmit(e)}
          className="rounded-lg border border-border bg-muted/20 p-4 space-y-3"
          data-testid="investigation-llm-profile-form"
        >
          <div
            className="rounded-md border border-dashed border-border/80 bg-background/60 p-3 space-y-2"
            data-testid="investigation-llm-profile-presets"
          >
            <div>
              <p className="text-xs font-medium text-foreground">{t('examplePresetsTitle')}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{t('examplePresetsHint')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {INVESTIGATION_LLM_PROFILE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="inline-flex items-center rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-accent transition-colors"
                  data-testid={`investigation-llm-preset-${preset.id}`}
                  data-preset-id={preset.id}
                  data-preset-label={preset.label}
                  data-preset-base-url={preset.baseUrl}
                  data-preset-model={preset.model}
                  data-preset-context-window={
                    preset.contextWindowTokens ? String(preset.contextWindowTokens) : ''
                  }
                >
                  {t('applyPreset', { label: preset.label })}
                </button>
              ))}
            </div>
          </div>
          {editingId && (
            <p
              className="text-xs font-medium text-muted-foreground"
              data-testid="investigation-llm-profile-editing"
            >
              {t('editing', { label: form.label || editingId })}
            </p>
          )}
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
                placeholder={
                  editingId && items.find((item) => item.id === editingId)?.apiKeyConfigured
                    ? t('apiKeyMaskedPlaceholder')
                    : t('apiKeyPlaceholder')
                }
                autoComplete="off"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                data-testid="investigation-llm-profile-api-key"
              />
              {editingId && items.find((item) => item.id === editingId)?.apiKeyConfigured && (
                <span
                  className="text-[11px] text-muted-foreground"
                  data-testid="investigation-llm-profile-api-key-masked"
                >
                  {t('apiKeyMaskedHint')}
                </span>
              )}
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
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              data-testid={
                editingId ? 'investigation-llm-profile-save' : 'investigation-llm-profile-create'
              }
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {submitting ? t('saving') : t('saveProfile')}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetFormState}
                className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-accent"
                data-testid="investigation-llm-profile-cancel-edit"
              >
                {t('cancel')}
              </button>
            )}
          </div>
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
            items.map((profile) => {
              const isActive = profile.isActive === true || activeProfileId === profile.id;
              return (
                <li
                  key={profile.id}
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                  data-testid={`investigation-llm-profile-item-${profile.id}`}
                  data-profile-label={profile.label}
                  data-profile-active={isActive ? 'true' : 'false'}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-foreground">{profile.label}</div>
                        {isActive && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                            data-testid={`investigation-llm-profile-active-badge-${profile.id}`}
                          >
                            <Check className="h-3 w-3" />
                            {t('activeBadge')}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                        {profile.model} · {profile.baseUrl}
                        {profile.contextWindowTokens
                          ? ` · ${profile.contextWindowTokens.toLocaleString()} tokens`
                          : ''}
                        {profile.apiKeyConfigured ? ` · ${t('apiKeyConfigured')}` : ''}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => void handleActivate(profile)}
                            disabled={activatingId === profile.id}
                            className="inline-flex items-center gap-1 rounded-md border border-primary/40 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                            data-testid={`investigation-llm-profile-activate-${profile.id}`}
                          >
                            {activatingId === profile.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            {t('activate')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => startEdit(profile)}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-accent"
                          data-testid={`investigation-llm-profile-edit-${profile.id}`}
                        >
                          <Pencil className="h-3 w-3" />
                          {t('edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(profile)}
                          disabled={deletingId === profile.id}
                          className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                          data-testid={`investigation-llm-profile-delete-${profile.id}`}
                        >
                          {deletingId === profile.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                          {t('delete')}
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}

      {!canManage && <p className="text-[11px] text-muted-foreground">{t('adminOnly')}</p>}
    </div>
  );
}
