import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/base.css.js';

@customElement('cf-chat-header')
export class ChatHeader extends LitElement {
  static styles = [
    baseStyles,
    css`
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: var(--cf-primary);
        color: white;
        border-radius: var(--cf-radius) var(--cf-radius) 0 0;
      }
      .header-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .header-logo {
        height: 24px;
        width: auto;
      }
      .header-title {
        font-size: 14px;
        font-weight: 600;
      }
      .close-btn {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        font-size: 18px;
        line-height: 1;
        opacity: 0.8;
      }
      .close-btn:hover { opacity: 1; }
    `,
  ];

  @property() headerText = 'CauseFlow';
  @property() logoUrl = '';
  @property({ type: Boolean }) showClose = true;

  render() {
    return html`
      <div class="header">
        <div class="header-left">
          ${this.logoUrl ? html`<img class="header-logo" src="${this.logoUrl}" alt="" />` : ''}
          <span class="header-title">${this.headerText}</span>
        </div>
        ${this.showClose ? html`
          <button class="close-btn" @click=${this._onClose} aria-label="Fechar">✕</button>
        ` : ''}
      </div>
    `;
  }

  private _onClose() {
    this.dispatchEvent(new CustomEvent('close-widget'));
  }
}
