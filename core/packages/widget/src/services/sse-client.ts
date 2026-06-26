export type SSEEventHandler = (event: string, data: Record<string, unknown>) => void;

export class SSEClient {
  private baseUrl: string;
  private apiKey: string;
  private sessionId: string;
  private eventSource: EventSource | null = null;
  private handlers: SSEEventHandler[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(baseUrl: string, apiKey: string, sessionId: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.sessionId = sessionId;
  }

  connect(): void {
    if (this.eventSource) return;

    // EventSource doesn't support custom headers natively.
    // Pass API key as query param (validated server-side alongside header).
    const url = `${this.baseUrl}/v1/widget/sessions/${this.sessionId}/stream?apiKey=${encodeURIComponent(this.apiKey)}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0;
    };

    this.eventSource.onerror = () => {
      this.eventSource?.close();
      this.eventSource = null;
      this.scheduleReconnect();
    };

    // Listen for widget-specific events
    for (const eventType of ['widget.progress', 'widget.completed', 'chat.response']) {
      this.eventSource.addEventListener(eventType, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          this.handlers.forEach((h) => h(eventType, data));
        } catch {
          // ignore parse errors
        }
      });
    }
  }

  onEvent(handler: SSEEventHandler): void {
    this.handlers.push(handler);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.eventSource?.close();
    this.eventSource = null;
  }

  get connected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }
}
