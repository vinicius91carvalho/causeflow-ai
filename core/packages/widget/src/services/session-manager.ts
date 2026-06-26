const STORAGE_KEY = 'causeflow_widget_session';

interface StoredSession {
  sessionId: string;
  expiresAt: string;
}

export class SessionManager {
  load(): string | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const stored: StoredSession = JSON.parse(raw);
      if (new Date(stored.expiresAt) < new Date()) {
        sessionStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return stored.sessionId;
    } catch {
      return null;
    }
  }

  save(sessionId: string, expiresAt: string): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId, expiresAt }));
    } catch {
      // sessionStorage not available
    }
  }

  clear(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
