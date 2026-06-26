import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from './styles/base.css.js';
import { applyTheme } from './styles/theme.js';
import { WidgetApiClient } from './services/api-client.js';
import { SSEClient } from './services/sse-client.js';
import { SessionManager } from './services/session-manager.js';
import type { WidgetMessage } from './types.js';

// Import sub-components (side-effect registration)
import './components/chat-header.js';
import './components/chat-messages.js';
import './components/chat-input.js';
import './components/typing-indicator.js';

@customElement('causeflow-widget')
export class CauseflowWidget extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        position: relative;
        z-index: 999999;
      }

      /* FAB trigger button */
      .fab {
        position: fixed;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--cf-primary);
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        box-shadow: var(--cf-shadow);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .fab:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 32px rgba(0, 0, 0, 0.18);
      }
      .fab.bottom-right { bottom: 20px; right: 20px; }
      .fab.bottom-left { bottom: 20px; left: 20px; }

      /* Chat window */
      .chat-window {
        position: fixed;
        width: 380px;
        height: 560px;
        max-height: 80vh;
        background: var(--cf-bg);
        border-radius: var(--cf-radius);
        box-shadow: var(--cf-shadow);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: slideUp 0.25s ease-out;
      }
      .chat-window.bottom-right { bottom: 84px; right: 20px; }
      .chat-window.bottom-left { bottom: 84px; left: 20px; }

      /* Fullscreen mode */
      :host([mode="fullscreen"]) .chat-window {
        position: relative;
        width: 100%;
        height: 100%;
        max-height: 100%;
        border-radius: 0;
        box-shadow: none;
        animation: none;
      }
      :host([mode="fullscreen"]) .fab { display: none; }

      .chat-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }

      @keyframes slideUp {
        from { opacity: 0; transform: translateY(16px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .hidden { display: none; }
    `,
  ];

  @property({ attribute: 'api-key' }) apiKey = '';
  @property({ attribute: 'base-url' }) baseUrl = 'https://api.causeflow.ai';
  @property({ attribute: 'agent-id' }) agentId = '';
  @property({ attribute: 'agent-name' }) agentName = '';
  @property() position: 'bottom-right' | 'bottom-left' = 'bottom-right';
  @property() mode: 'widget' | 'fullscreen' = 'widget';
  @property({ attribute: 'welcome-message' }) welcomeMessage = 'Olá! Como posso ajudar?';
  @property({ attribute: 'header-text' }) headerText = 'CauseFlow';
  @property({ attribute: 'logo-url' }) logoUrl = '';
  @property({ attribute: 'primary-color' }) primaryColor = '';

  @state() private open = false;
  @state() private messages: WidgetMessage[] = [];
  @state() private loading = false;
  @state() private sessionId = '';
  @state() private typingMessage = '';

  private apiClient!: WidgetApiClient;
  private sseClient: SSEClient | null = null;
  private sessionManager = new SessionManager();

  connectedCallback() {
    super.connectedCallback();
    if (this.primaryColor) {
      applyTheme(this, this.primaryColor);
    }
    this.apiClient = new WidgetApiClient(
      this.baseUrl,
      this.apiKey,
      this.agentId || undefined,
      this.agentName || undefined,
    );

    // Auto-open in fullscreen mode
    if (this.mode === 'fullscreen') {
      this.open = true;
      this._initSession();
    }

    // Load branding from server
    this._loadConfig();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.sseClient?.disconnect();
  }

  render() {
    if (this.mode === 'fullscreen') {
      return this._renderChatWindow();
    }

    return html`
      ${this.open ? this._renderChatWindow() : ''}
      <button
        class="fab ${this.position} ${this.open ? 'hidden' : ''}"
        @click=${this._toggle}
        aria-label="Abrir suporte"
      >💬</button>
    `;
  }

  private _renderChatWindow() {
    return html`
      <div class="chat-window ${this.position}">
        <cf-chat-header
          headerText=${this.headerText}
          logoUrl=${this.logoUrl}
          ?showClose=${this.mode !== 'fullscreen'}
          @close-widget=${this._toggle}
        ></cf-chat-header>
        <div class="chat-body">
          <cf-chat-messages
            .messages=${this.messages}
            welcomeMessage=${this.welcomeMessage}
            @follow-up=${this._onFollowUp}
          ></cf-chat-messages>
          ${this.loading ? html`
            <cf-typing-indicator message=${this.typingMessage || 'Investigando...'}></cf-typing-indicator>
          ` : ''}
          <cf-chat-input
            ?disabled=${this.loading}
            @send-message=${this._onSendMessage}
          ></cf-chat-input>
        </div>
      </div>
    `;
  }

  private async _toggle() {
    this.open = !this.open;
    if (this.open && !this.sessionId) {
      await this._initSession();
    }
  }

  private async _initSession() {
    const existing = this.sessionManager.load();
    if (existing) {
      this.sessionId = existing;
      this._connectSSE();
      return;
    }

    try {
      const session = await this.apiClient.createSession();
      this.sessionId = session.sessionId;
      this.sessionManager.save(session.sessionId, session.expiresAt);
      this._connectSSE();
    } catch (err) {
      console.error('[CauseFlow] Failed to create session:', err);
    }
  }

  private _connectSSE() {
    if (this.sseClient) return;
    this.sseClient = new SSEClient(this.baseUrl, this.apiKey, this.sessionId);
    this.sseClient.onEvent((event, data) => {
      if (event === 'widget.progress') {
        this.typingMessage = (data as any).message ?? 'Investigando...';
        this.loading = true;
      } else if (event === 'widget.completed' || event === 'chat.response') {
        this.loading = false;
        const response = (data as any).response ?? data;
        this.messages = [
          ...this.messages,
          {
            role: 'assistant',
            content: response.text ?? response.answer ?? '',
            timestamp: new Date().toISOString(),
            summary: response.summary,
            impact: response.impact,
            resolution: response.resolution,
            eta: response.eta,
            escalated: response.escalated,
            status: 'completed',
          },
        ];
      }
    });
    this.sseClient.connect();
  }

  private async _onSendMessage(e: CustomEvent<string>) {
    const message = e.detail;
    this.messages = [
      ...this.messages,
      { role: 'user', content: message, timestamp: new Date().toISOString() },
    ];
    this.loading = true;
    this.typingMessage = 'Processando...';

    try {
      const result = await this.apiClient.sendMessage(this.sessionId, message);

      if (result.status === 'completed') {
        this.loading = false;
        this.messages = [
          ...this.messages,
          {
            role: 'assistant',
            content: result.response.text,
            timestamp: new Date().toISOString(),
            followUpQuestions: result.followUpQuestions,
            summary: result.response.summary,
            impact: result.response.impact,
            resolution: result.response.resolution,
            eta: result.response.eta,
            escalated: result.response.escalated,
            status: 'completed',
          },
        ];
      }
      // If status === 'processing', response will come via SSE
    } catch (err) {
      this.loading = false;
      this.messages = [
        ...this.messages,
        {
          role: 'assistant',
          content: 'Desculpe, ocorreu um erro. Tente novamente.',
          timestamp: new Date().toISOString(),
        },
      ];
      console.error('[CauseFlow] Send failed:', err);
    }
  }

  private _onFollowUp(e: CustomEvent<string>) {
    const input = this.shadowRoot?.querySelector('cf-chat-input') as any;
    if (input) {
      input.setMessage(e.detail);
    }
  }

  private async _loadConfig() {
    try {
      const config = await this.apiClient.getConfig();
      if (config.branding.primaryColor && !this.primaryColor) {
        applyTheme(this, config.branding.primaryColor);
      }
      if (config.branding.headerText && this.headerText === 'CauseFlow') {
        this.headerText = config.branding.headerText;
      }
      if (config.branding.logoUrl && !this.logoUrl) {
        this.logoUrl = config.branding.logoUrl;
      }
      if (config.branding.welcomeMessage && this.welcomeMessage === 'Olá! Como posso ajudar?') {
        this.welcomeMessage = config.branding.welcomeMessage;
      }
    } catch {
      // Config loading is non-critical
    }
  }
}
