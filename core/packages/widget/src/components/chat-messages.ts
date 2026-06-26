import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/base.css.js';
import type { WidgetMessage } from '../types.js';

@customElement('cf-chat-messages')
export class ChatMessages extends LitElement {
  static styles = [
    baseStyles,
    css`
      .messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .message {
        max-width: 85%;
        padding: 10px 14px;
        border-radius: 12px;
        font-size: 13px;
        line-height: 1.5;
        word-wrap: break-word;
      }
      .message.user {
        align-self: flex-end;
        background: var(--cf-primary);
        color: white;
        border-bottom-right-radius: 4px;
      }
      .message.assistant {
        align-self: flex-start;
        background: var(--cf-bg-secondary);
        color: var(--cf-text);
        border-bottom-left-radius: 4px;
      }
      .message.escalated {
        border-left: 3px solid #ef4444;
      }
      .meta {
        font-size: 11px;
        color: var(--cf-text-secondary);
        margin-top: 4px;
      }
      .impact, .resolution {
        margin-top: 8px;
        padding: 8px;
        background: white;
        border-radius: 6px;
        font-size: 12px;
      }
      .impact-label, .resolution-label {
        font-weight: 600;
        font-size: 11px;
        text-transform: uppercase;
        color: var(--cf-text-secondary);
        margin-bottom: 2px;
      }
      .follow-ups {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
      .follow-up-chip {
        background: white;
        border: 1px solid var(--cf-border);
        border-radius: 16px;
        padding: 4px 12px;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.15s;
      }
      .follow-up-chip:hover {
        background: var(--cf-primary);
        color: white;
        border-color: var(--cf-primary);
      }
      .welcome {
        text-align: center;
        color: var(--cf-text-secondary);
        padding: 24px 16px;
        font-size: 13px;
      }
    `,
  ];

  @property({ type: Array }) messages: WidgetMessage[] = [];
  @property() welcomeMessage = '';

  updated() {
    const container = this.shadowRoot?.querySelector('.messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  render() {
    return html`
      <div class="messages">
        ${this.messages.length === 0 && this.welcomeMessage
          ? html`<div class="welcome">${this.welcomeMessage}</div>`
          : ''}
        ${this.messages.map((msg) => this._renderMessage(msg))}
      </div>
    `;
  }

  private _renderMessage(msg: WidgetMessage) {
    const classes = `message ${msg.role}${msg.escalated ? ' escalated' : ''}`;
    return html`
      <div class="${classes}">
        <div>${msg.content}</div>
        ${msg.impact ? html`
          <div class="impact">
            <div class="impact-label">Impacto</div>
            ${msg.impact}
          </div>
        ` : ''}
        ${msg.resolution ? html`
          <div class="resolution">
            <div class="resolution-label">Resolução</div>
            ${msg.resolution}
          </div>
        ` : ''}
        ${msg.followUpQuestions?.length ? html`
          <div class="follow-ups">
            ${msg.followUpQuestions.map((q) => html`
              <button class="follow-up-chip" @click=${() => this._onFollowUp(q)}>${q}</button>
            `)}
          </div>
        ` : ''}
        ${msg.status === 'processing' ? html`<div class="meta">Investigando...</div>` : ''}
      </div>
    `;
  }

  private _onFollowUp(question: string) {
    this.dispatchEvent(new CustomEvent('follow-up', { detail: question }));
  }
}
