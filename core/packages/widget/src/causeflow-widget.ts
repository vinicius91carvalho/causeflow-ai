import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from './styles/base.css.js';
import { applyTheme } from './styles/theme.js';
import { WidgetApiClient } from './services/api-client.js';
import { SessionManager } from './services/session-manager.js';
import type { IncidentListItem } from './types.js';

// Severity badge colors
const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#ca8a04',
  low: '#16a34a',
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
};

@customElement('causeflow-widget')
export class CauseflowWidget extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
        position: relative;
        z-index: 999999;
        font-family: var(--cf-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      }

      /* Widget panel */
      .panel {
        background: var(--cf-bg, #ffffff);
        border-radius: var(--cf-radius, 12px);
        box-shadow: var(--cf-shadow, 0 4px 24px rgba(0, 0, 0, 0.12));
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      :host([mode="fullscreen"]) .panel {
        width: 100%;
        height: 100%;
        max-height: 100%;
        border-radius: 0;
        box-shadow: none;
      }

      :host(:not([mode="fullscreen"])) .panel {
        position: fixed;
        width: 380px;
        max-height: 560px;
        max-height: 80vh;
        animation: slideUp 0.25s ease-out;
      }

      :host(:not([mode="fullscreen"])) .panel.bottom-right { bottom: 84px; right: 20px; }
      :host(:not([mode="fullscreen"])) .panel.bottom-left { bottom: 84px; left: 20px; }

      /* FAB trigger button */
      .fab {
        position: fixed;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--cf-primary, #6366f1);
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        box-shadow: var(--cf-shadow, 0 4px 24px rgba(0, 0, 0, 0.12));
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .fab:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 32px rgba(0, 0, 0, 0.18);
      }
      .fab.bottom-right { bottom: 20px; right: 20px; }
      .fab.bottom-left { bottom: 20px; left: 20px; }

      /* Header */
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: var(--cf-primary, #6366f1);
        color: white;
      }
      .header-left { display: flex; align-items: center; gap: 8px; }
      .header-logo { height: 24px; width: auto; }
      .header-title { font-size: 14px; font-weight: 600; }
      .close-btn {
        background: none; border: none; color: white; cursor: pointer;
        padding: 4px; font-size: 18px; line-height: 1; opacity: 0.8;
      }
      .close-btn:hover { opacity: 1; }

      /* Panel body */
      .body {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
      }

      /* Unauthorized state */
      .unauthorized {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 24px;
        text-align: center;
        color: var(--cf-text-secondary, #6b7280);
      }
      .unauthorized-icon {
        font-size: 40px;
        margin-bottom: 12px;
        opacity: 0.6;
      }
      .unauthorized-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--cf-text, #1f2937);
        margin-bottom: 8px;
      }
      .unauthorized-desc {
        font-size: 13px;
        line-height: 1.5;
      }

      /* Loading state */
      .loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        color: var(--cf-text-secondary, #6b7280);
        font-size: 13px;
      }
      .spinner {
        width: 20px; height: 20px;
        border: 2px solid var(--cf-border, #e5e7eb);
        border-top-color: var(--cf-primary, #6366f1);
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
        margin-right: 8px;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* Empty state */
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        text-align: center;
        color: var(--cf-text-secondary, #6b7280);
      }
      .empty-title {
        font-size: 15px;
        font-weight: 600;
        color: var(--cf-text, #1f2937);
        margin-bottom: 4px;
      }
      .empty-desc { font-size: 13px; }

      /* Incident card */
      .incident-card {
        padding: 12px 16px;
        border-bottom: 1px solid var(--cf-border, #e5e7eb);
        cursor: pointer;
        transition: background 0.15s;
      }
      .incident-card:hover { background: var(--cf-bg-secondary, #f9fafb); }
      .incident-card:last-child { border-bottom: none; }

      .incident-top {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
      }
      .severity-badge {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.05em;
        padding: 2px 6px;
        border-radius: 4px;
        color: white;
        text-transform: uppercase;
        flex-shrink: 0;
      }
      .incident-status {
        font-size: 11px;
        color: var(--cf-text-secondary, #6b7280);
        margin-left: auto;
      }
      .incident-title {
        font-size: 13px;
        font-weight: 500;
        color: var(--cf-text, #1f2937);
        margin-bottom: 2px;
        line-height: 1.4;
      }
      .incident-summary {
        font-size: 12px;
        color: var(--cf-text-secondary, #6b7280);
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .incident-time {
        font-size: 11px;
        color: var(--cf-text-secondary, #6b7280);
        margin-top: 4px;
      }

      @keyframes slideUp {
        from { opacity: 0; transform: translateY(16px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .hidden { display: none; }

      /* Polling status */
      .poll-banner {
        font-size: 11px;
        padding: 6px 16px;
        background: var(--cf-bg-secondary, #f9fafb);
        color: var(--cf-text-secondary, #6b7280);
        text-align: center;
        border-top: 1px solid var(--cf-border, #e5e7eb);
      }
    `,
  ];

  @property({ attribute: 'api-key' }) apiKey = '';
  @property({ attribute: 'base-url' }) baseUrl = 'https://api.causeflow.ai';
  @property() position: 'bottom-right' | 'bottom-left' = 'bottom-right';
  @property() mode: 'widget' | 'fullscreen' = 'widget';
  @property({ attribute: 'header-text' }) headerText = 'CauseFlow';
  @property({ attribute: 'logo-url' }) logoUrl = '';
  @property({ attribute: 'primary-color' }) primaryColor = '';

  @state() private open = false;
  @state() private incidents: IncidentListItem[] = [];
  @state() private loading = true;
  @state() private unauthorized = false;
  @state() private error = '';

  private apiClient!: WidgetApiClient;
  private sessionManager = new SessionManager();
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  connectedCallback() {
    super.connectedCallback();
    if (this.primaryColor) {
      applyTheme(this, this.primaryColor);
    }
    this.apiClient = new WidgetApiClient(this.baseUrl, this.apiKey);

    // Auto-open in fullscreen mode
    if (this.mode === 'fullscreen') {
      this.open = true;
      this._init();
    }

    // Load branding from server
    this._loadConfig();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopPolling();
  }

  render() {
    if (this.mode === 'fullscreen') {
      return this._renderPanel();
    }

    return html`
      ${this.open ? this._renderPanel() : ''}
      <button
        class="fab ${this.position} ${this.open ? 'hidden' : ''}"
        @click=${this._toggle}
        aria-label="Open incident panel"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
      </button>
    `;
  }

  private _renderPanel() {
    return html`
      <div class="panel ${this.position}">
        <div class="header">
          <div class="header-left">
            ${this.logoUrl ? html`<img class="header-logo" src="${this.logoUrl}" alt="" />` : ''}
            <span class="header-title">${this.headerText}</span>
          </div>
          ${this.mode !== 'fullscreen' ? html`
            <button class="close-btn" @click=${this._toggle} aria-label="Close">✕</button>
          ` : ''}
        </div>
        <div class="body">
          ${this.unauthorized ? this._renderUnauthorized() : ''}
          ${this.loading && !this.unauthorized ? this._renderLoading() : ''}
          ${!this.loading && !this.unauthorized && this.incidents.length === 0 ? this._renderEmpty() : ''}
          ${!this.loading && !this.unauthorized && this.incidents.length > 0 ? this._renderIncidents() : ''}
        </div>
        ${!this.unauthorized ? html`
          <div class="poll-banner">Auto-refreshing every 30s</div>
        ` : ''}
      </div>
    `;
  }

  private _renderUnauthorized() {
    return html`
      <div class="unauthorized">
        <div class="unauthorized-icon">🔒</div>
        <div class="unauthorized-title">Unauthorized</div>
        <div class="unauthorized-desc">
          Please check your API key and try again.
        </div>
      </div>
    `;
  }

  private _renderLoading() {
    return html`
      <div class="loading">
        <div class="spinner"></div>
        <span>Loading incidents...</span>
      </div>
    `;
  }

  private _renderEmpty() {
    return html`
      <div class="empty">
        <div class="empty-title">No incidents</div>
        <div class="empty-desc">All systems are currently operating normally.</div>
      </div>
    `;
  }

  private _renderIncidents() {
    return html`
      ${this.incidents.map((inc) => this._renderIncidentCard(inc))}
    `;
  }

  private _renderIncidentCard(inc: IncidentListItem) {
    const sevColor = SEVERITY_COLORS[inc.severity] ?? '#6b7280';
    const sevLabel = SEVERITY_LABELS[inc.severity] ?? inc.severity;
    const time = new Date(inc.createdAt).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    return html`
      <div class="incident-card" @click=${() => this._onIncidentClick(inc)}>
        <div class="incident-top">
          <span class="severity-badge" style="background: ${sevColor}">${sevLabel}</span>
          <span class="incident-status">${inc.status}</span>
        </div>
        <div class="incident-title">${inc.title}</div>
        <div class="incident-summary">${inc.summary ?? ''}</div>
        <div class="incident-time">${time}</div>
      </div>
    `;
  }

  private async _toggle() {
    this.open = !this.open;
    if (this.open && this.incidents.length === 0 && !this.unauthorized) {
      await this._init();
    }
  }

  private async _init() {
    this.loading = true;
    this.unauthorized = false;
    this.error = '';

    try {
      // Create session to establish auth context
      await this.apiClient.createSession();
      // Fetch incidents
      await this._fetchIncidents();
      // Start polling
      this._startPolling();
    } catch (err: any) {
      if (err?.message?.includes('401') || err?.message?.includes('403')) {
        this.unauthorized = true;
      } else {
        this.error = err?.message ?? 'Failed to load';
      }
    } finally {
      this.loading = false;
    }
  }

  private async _fetchIncidents() {
    try {
      const result = await this.apiClient.getIncidents();
      this.incidents = result.items;
    } catch (err: any) {
      if (err?.message?.includes('401') || err?.message?.includes('403')) {
        this.unauthorized = true;
      }
    }
  }

  private _startPolling() {
    this._stopPolling();
    this.pollTimer = setInterval(() => {
      this._fetchIncidents();
    }, 30_000);
  }

  private _stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private _onIncidentClick(inc: IncidentListItem) {
    this.dispatchEvent(new CustomEvent('incident-click', {
      detail: { incidentId: inc.incidentId },
      bubbles: true,
      composed: true,
    }));
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
    } catch {
      // Config loading is non-critical
    }
  }
}
