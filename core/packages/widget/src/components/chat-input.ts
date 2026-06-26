import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { baseStyles } from '../styles/base.css.js';

@customElement('cf-chat-input')
export class ChatInput extends LitElement {
  static styles = [
    baseStyles,
    css`
      .input-container {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid var(--cf-border);
        background: var(--cf-bg);
        border-radius: 0 0 var(--cf-radius) var(--cf-radius);
      }
      textarea {
        flex: 1;
        resize: none;
        border: 1px solid var(--cf-border);
        border-radius: 8px;
        padding: 8px 12px;
        font-family: var(--cf-font);
        font-size: 13px;
        line-height: 1.4;
        outline: none;
        max-height: 80px;
        min-height: 36px;
      }
      textarea:focus {
        border-color: var(--cf-primary);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--cf-primary) 20%, transparent);
      }
      textarea:disabled {
        background: var(--cf-bg-secondary);
        cursor: not-allowed;
      }
      .send-btn {
        background: var(--cf-primary);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
        transition: background 0.15s;
        flex-shrink: 0;
      }
      .send-btn:hover:not(:disabled) {
        background: var(--cf-primary-hover);
      }
      .send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `,
  ];

  @property({ type: Boolean }) disabled = false;
  @state() private value = '';

  render() {
    return html`
      <div class="input-container">
        <textarea
          rows="1"
          placeholder="Digite sua mensagem..."
          .value=${this.value}
          ?disabled=${this.disabled}
          @input=${this._onInput}
          @keydown=${this._onKeyDown}
        ></textarea>
        <button
          class="send-btn"
          ?disabled=${this.disabled || !this.value.trim()}
          @click=${this._send}
          aria-label="Enviar"
        >➤</button>
      </div>
    `;
  }

  private _onInput(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    this.value = textarea.value;
    // Auto-resize
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px';
  }

  private _onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this._send();
    }
  }

  private _send() {
    const msg = this.value.trim();
    if (!msg || this.disabled) return;
    this.dispatchEvent(new CustomEvent('send-message', { detail: msg }));
    this.value = '';
    const textarea = this.shadowRoot?.querySelector('textarea');
    if (textarea) textarea.style.height = 'auto';
  }

  setMessage(msg: string) {
    this.value = msg;
  }
}
