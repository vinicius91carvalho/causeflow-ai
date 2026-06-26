'use client';

import { Key, Loader2, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PERMISSION } from '@/contexts/identity/domain/rbac/permissions';
import { usePermission } from '@/contexts/identity/domain/rbac/role-guard';
import { formatDate } from '@/contexts/shared/lib/format-date';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';
import type { ApiKey, CreatedApiKey } from '@/lib/api/core-api-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateDialogState {
  open: boolean;
  name: string;
  isSubmitting: boolean;
  createdKey: CreatedApiKey | null;
}

interface RevokeDialogState {
  open: boolean;
  key: ApiKey | null;
  isRevoking: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ApiKeysTab() {
  const t = useTranslations('dashboard.settings.apiKeys');
  const { addToast } = useToast();
  const canManage = usePermission(PERMISSION.MANAGE_SETTINGS);

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [createDialog, setCreateDialog] = useState<CreateDialogState>({
    open: false,
    name: '',
    isSubmitting: false,
    createdKey: null,
  });

  const [revokeDialog, setRevokeDialog] = useState<RevokeDialogState>({
    open: false,
    key: null,
    isRevoking: false,
  });

  const [copied, setCopied] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Load keys
  // ---------------------------------------------------------------------------

  const loadKeys = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/settings/api-keys');
      if (res.ok) {
        const data = (await res.json()) as { keys: ApiKey[] };
        setKeys(data.keys ?? []);
      }
    } catch {
      // Keep empty list — user can retry
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  // Focus name input when dialog opens
  useEffect(() => {
    if (createDialog.open && !createDialog.createdKey) {
      const timer = setTimeout(() => nameInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [createDialog.open, createDialog.createdKey]);

  // ---------------------------------------------------------------------------
  // Create API key
  // ---------------------------------------------------------------------------

  function openCreateDialog() {
    setCreateDialog({ open: true, name: '', isSubmitting: false, createdKey: null });
    setCopied(false);
  }

  function closeCreateDialog() {
    setCreateDialog({ open: false, name: '', isSubmitting: false, createdKey: null });
    setCopied(false);
    // Refresh list after key was shown and dialog closed
    void loadKeys();
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!createDialog.name.trim()) return;

    setCreateDialog((prev) => ({ ...prev, isSubmitting: true }));
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createDialog.name.trim() }),
      });
      if (!res.ok) throw new Error('Create failed');
      const created = (await res.json()) as CreatedApiKey;
      setCreateDialog((prev) => ({ ...prev, isSubmitting: false, createdKey: created }));
      addToast(t('createSuccess'), 'success');
    } catch {
      addToast(t('errorCreating'), 'error');
      setCreateDialog((prev) => ({ ...prev, isSubmitting: false }));
    }
  }

  async function handleCopyKey(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — silently skip
    }
  }

  // ---------------------------------------------------------------------------
  // Revoke API key
  // ---------------------------------------------------------------------------

  function openRevokeDialog(key: ApiKey) {
    setRevokeDialog({ open: true, key, isRevoking: false });
  }

  function closeRevokeDialog() {
    setRevokeDialog({ open: false, key: null, isRevoking: false });
  }

  async function handleRevoke() {
    if (!revokeDialog.key) return;

    setRevokeDialog((prev) => ({ ...prev, isRevoking: true }));
    try {
      const res = await fetch(
        `/api/settings/api-keys?keyId=${encodeURIComponent(revokeDialog.key.id)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('Revoke failed');
      closeRevokeDialog();
      addToast(t('revokeSuccess'), 'success');
      void loadKeys();
    } catch {
      addToast(t('errorRevoking'), 'error');
      setRevokeDialog((prev) => ({ ...prev, isRevoking: false }));
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{t('title')}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t('description')}</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openCreateDialog}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('create')}
          </button>
        )}
      </div>

      {/* Non-admin notice */}
      {!canManage && (
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          {t('adminOnly')}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-3 animate-pulse" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-muted" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (keys ?? []).length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-14 text-center">
          <Key className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
          {canManage && (
            <button
              type="button"
              onClick={openCreateDialog}
              className="mt-1 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('create')}
            </button>
          )}
        </div>
      )}

      {/* Key list */}
      {!isLoading && (keys ?? []).length > 0 && (
        <div className="space-y-2">
          {/* Table header — hidden on mobile */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto] sm:gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span>{t('name')}</span>
            <span>{t('prefix')}</span>
            <span>{t('status')}</span>
            <span>{t('createdAt')}</span>
            <span>{t('lastUsed')}</span>
          </div>

          {keys.map((key) => (
            <div
              key={key.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card px-4 py-3 sm:grid sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-center sm:gap-4"
            >
              {/* Name */}
              <span className="text-sm font-medium text-foreground truncate">{key.name}</span>

              {/* Prefix */}
              <span className="font-mono text-xs text-muted-foreground bg-muted rounded px-2 py-0.5 w-fit">
                {key.prefix}…
              </span>

              {/* Status badge */}
              <span
                className={[
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium w-fit',
                  key.status === 'active'
                    ? 'bg-success/50/10 text-success'
                    : 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {key.status === 'active' ? t('active') : t('revoked')}
              </span>

              {/* Created at */}
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(key.createdAt)}
              </span>

              {/* Last used */}
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {key.lastUsedAt ? formatDate(key.lastUsedAt) : '—'}
                </span>

                {/* Revoke button — admin only, active keys only */}
                {canManage && key.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => openRevokeDialog(key)}
                    aria-label={`${t('revoke')} ${key.name}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-destructive/60 hover:text-destructive focus:outline-none focus:ring-2 focus:ring-red-400/50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('revoke')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------------------------------------------------------------------
          Create API Key Dialog
      --------------------------------------------------------------------------- */}
      {createDialog.open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-key-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (!createDialog.isSubmitting) closeCreateDialog();
            }}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
            <div className="p-6">
              <h2
                id="create-key-dialog-title"
                className="text-base font-semibold text-foreground mb-4"
              >
                {t('create')}
              </h2>

              {/* Step 1: Enter name */}
              {!createDialog.createdKey && (
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="api-key-name"
                      className="block text-sm font-medium text-foreground"
                    >
                      {t('name')}
                      <span className="text-destructive ml-1" aria-hidden="true">
                        *
                      </span>
                    </label>
                    <input
                      ref={nameInputRef}
                      id="api-key-name"
                      type="text"
                      name="name"
                      value={createDialog.name}
                      onChange={(e) =>
                        setCreateDialog((prev) => ({ ...prev, name: e.target.value }))
                      }
                      disabled={createDialog.isSubmitting}
                      placeholder={t('namePlaceholder')}
                      maxLength={100}
                      required
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 disabled:cursor-not-allowed transition-shadow"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeCreateDialog}
                      disabled={createDialog.isSubmitting}
                      className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={createDialog.isSubmitting || !createDialog.name.trim()}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
                    >
                      {createDialog.isSubmitting && (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      )}
                      {t('create')}
                    </button>
                  </div>
                </form>
              )}

              {/* Step 2: Show plaintext key (once) */}
              {createDialog.createdKey && (
                <div className="space-y-4">
                  {/* Warning banner */}
                  <div className="rounded-lg border border-warning/60/40 bg-warning/50/10 px-4 py-3 text-sm text-warning">
                    {t('keyWarning')}
                  </div>

                  {/* Key display */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{t('yourNewKey')}</p>
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2">
                      <span className="flex-1 font-mono text-xs text-foreground break-all select-all">
                        {createDialog.createdKey.key}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          createDialog.createdKey && handleCopyKey(createDialog.createdKey.key)
                        }
                        className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
                      >
                        {copied ? t('copied') : t('copyKey')}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={closeCreateDialog}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
                    >
                      {t('done')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------------
          Revoke Confirmation Dialog
      --------------------------------------------------------------------------- */}
      {revokeDialog.open && revokeDialog.key && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoke-key-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (!revokeDialog.isRevoking) closeRevokeDialog();
            }}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card shadow-xl">
            <div className="p-6 space-y-4">
              <h2 id="revoke-key-dialog-title" className="text-base font-semibold text-foreground">
                {t('revokeConfirm')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('revokeConfirmMessage', { name: revokeDialog.key.name })}
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeRevokeDialog}
                  disabled={revokeDialog.isRevoking}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleRevoke}
                  disabled={revokeDialog.isRevoking}
                  className="inline-flex items-center gap-2 rounded-lg bg-destructive/80 px-4 py-2 text-sm font-medium text-white hover:bg-destructive/80 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-400/50 transition-colors"
                >
                  {revokeDialog.isRevoking && (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  {t('revoke')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
