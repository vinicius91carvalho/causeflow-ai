'use client';

import { cn } from '@causeflow/ui/lib';
import { AlertCircle, Bell, CheckCircle2, ChevronRight, Info, ShieldAlert, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { formatRelativeTime } from '@/contexts/shared/lib/format-date';
import { Link } from '@/i18n/navigation';
import type { ApiNotification, PaginatedResponse } from '@/lib/api/core-api-types';

// ─── Type icon helper ──────────────────────────────────────────────────────

function NotificationTypeIcon({ type }: { type: string }) {
  const cls = 'h-4 w-4 shrink-0';
  if (type === 'incident_resolved')
    return <CheckCircle2 className={cn(cls, 'text-success')} aria-hidden="true" />;
  if (type === 'approval_required')
    return <ShieldAlert className={cn(cls, 'text-warning')} aria-hidden="true" />;
  if (type === 'analysis_complete')
    return <CheckCircle2 className={cn(cls, 'text-primary')} aria-hidden="true" />;
  if (type === 'incident_critical')
    return <AlertCircle className={cn(cls, 'text-destructive')} aria-hidden="true" />;
  return <Info className={cn(cls, 'text-muted-foreground')} aria-hidden="true" />;
}

// ─── Notification message helper ──────────────────────────────────────────

function notificationMessage(type: string): string {
  const messages: Record<string, string> = {
    incident_resolved: 'An incident has been resolved',
    approval_required: 'Remediation approval required',
    analysis_complete: 'Analysis completed successfully',
    incident_critical: 'Critical incident detected',
  };
  return messages[type] ?? 'New notification';
}

// ─── Main component ────────────────────────────────────────────────────────

export function NotificationBell() {
  const t = useTranslations('dashboard.notifications');
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const recent = notifications.slice(0, 5);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchNotifications = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/notifications?limit=10', { signal });
      if (!res.ok) return; // Silent fail — bell just shows no notifications
      const result = (await res.json()) as PaginatedResponse<ApiNotification>;
      setNotifications(result.items);
    } catch (err) {
      // Ignore abort errors — they are expected on unmount
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Silent fail — bell just shows no notifications
    }
  }, []);

  async function handleMarkRead(notificationId: string) {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === notificationId ? { ...n, read: true } : n)),
      );
    } catch {
      // Silent fail — optimistic update already applied
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    fetchNotifications(controller.signal);

    return () => {
      controller.abort();
      abortControllerRef.current = null;
    };
  }, [fetchNotifications]);

  // Close panel when clicking outside
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        type="button"
        className={cn(
          'relative flex items-center justify-center h-11 w-11 lg:h-8 lg:w-8 rounded-md hover:bg-accent transition-colors',
          'text-muted-foreground hover:text-foreground',
        )}
        onClick={() => setOpen((v) => !v)}
        aria-label={t('title')}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className={cn(
              'absolute top-0.5 right-0.5 lg:top-0 lg:right-0',
              'flex h-4 w-4 items-center justify-center rounded-full',
              'bg-primary text-primary-foreground text-[10px] font-bold leading-none',
              'ring-1 ring-background',
            )}
            aria-hidden="true"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        {/* Accessible unread count for screen readers */}
        {unreadCount > 0 && (
          <span className="sr-only">
            {unreadCount} {t('unread')}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          {/* Click-outside overlay (mobile-friendly) */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            ref={panelRef}
            role="dialog"
            aria-label={t('title')}
            className={cn(
              'absolute right-0 top-full mt-2 z-50',
              'w-80 sm:w-96',
              'rounded-xl border border-border bg-card shadow-lg shadow-black/10 dark:shadow-black/30 overflow-hidden',
              'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2',
            )}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-foreground">{t('title')}</h2>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {unreadCount}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="flex items-center justify-center h-6 w-6 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Notification list */}
            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                <Bell className="h-6 w-6 text-muted-foreground/40 mb-2" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{t('empty')}</p>
              </div>
            ) : (
              <ul className="divide-y divide-border" aria-label={t('title')}>
                {recent.map((notification) => (
                  <li key={notification.notificationId}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                        'hover:bg-accent/50',
                        !notification.read && 'bg-primary/5',
                      )}
                      onClick={() => {
                        if (!notification.read) {
                          handleMarkRead(notification.notificationId);
                        }
                      }}
                      aria-label={
                        notification.read
                          ? notificationMessage(notification.type)
                          : `${t('markRead')}: ${notificationMessage(notification.type)}`
                      }
                    >
                      <div className="mt-0.5">
                        <NotificationTypeIcon type={notification.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm text-foreground line-clamp-2',
                            !notification.read && 'font-medium',
                          )}
                        >
                          {notificationMessage(notification.type)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatRelativeTime(notification.createdAt, { compact: true })}
                        </p>
                      </div>
                      {!notification.read && (
                        <span
                          className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Footer */}
            <div className="border-t border-border px-4 py-2.5">
              <Link
                href="/dashboard"
                className="flex items-center justify-center gap-1 text-xs text-primary hover:underline"
                onClick={() => setOpen(false)}
              >
                {t('viewAll')}
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
