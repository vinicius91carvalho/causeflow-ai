'use client';

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  durationMs: number;
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType, durationMs?: number) => void;
  removeToast: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue | null>(null);

// ---------------------------------------------------------------------------
// Individual toast component
// ---------------------------------------------------------------------------

const toastStyles: Record<ToastType, string> = {
  success: 'border-success/40 bg-success/10 text-success',
  error: 'border-destructive/40 bg-destructive/10 text-destructive',
  info: 'border-primary/40 bg-primary/10 text-primary',
  warning: 'border-warning/40 bg-warning/10 text-warning',
};

const toastIcons: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

interface SingleToastProps {
  toast: ToastItem;
  onRemove: (id: string) => void;
}

function SingleToast({ toast, onRemove }: SingleToastProps) {
  return (
    <output
      aria-live="polite"
      aria-atomic="true"
      className={[
        'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm font-medium shadow-lg',
        'animate-in fade-in slide-in-from-bottom-4 duration-300',
        'min-w-[280px] max-w-[400px]',
        toastStyles[toast.type],
      ].join(' ')}
    >
      <span className="shrink-0 font-bold text-base leading-5" aria-hidden="true">
        {toastIcons[toast.type]}
      </span>
      <span className="flex-1 leading-5">{toast.message}</span>
      <button
        type="button"
        onClick={() => onRemove(toast.id)}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity leading-5"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </output>
  );
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // useId gives a stable base id; we use a counter for uniqueness
  const baseId = useId();
  const counterRef = useRef(0);

  // Mounted flag ensures the portal only renders after the first client render.
  // Gating on `typeof document` diverges SSR from the first client render and
  // causes a hydration mismatch at this slot. See
  // memory/project_toast_provider_hydration_bug.md for the full postmortem.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = 'info', durationMs = 5000) => {
      counterRef.current += 1;
      const id = `${baseId}-toast-${counterRef.current}`;
      const item: ToastItem = { id, message, type, durationMs };

      setToasts((prev) => [...prev, item]);

      const timer = setTimeout(() => {
        removeToast(id);
      }, durationMs);
      timersRef.current.set(id, timer);
    },
    [baseId, removeToast],
  );

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {mounted &&
        createPortal(
          <div
            aria-live="polite"
            aria-atomic="false"
            className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none"
          >
            {toasts.map((toast) => (
              <div key={toast.id} className="pointer-events-auto">
                <SingleToast toast={toast} onRemove={removeToast} />
              </div>
            ))}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
}
