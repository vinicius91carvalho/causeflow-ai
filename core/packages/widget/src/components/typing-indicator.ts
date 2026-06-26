import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { baseStyles } from '../styles/base.css.js';

@customElement('cf-typing-indicator')
export class TypingIndicator extends LitElement {
  static styles = [
    baseStyles,
    css`
      :host {
        display: block;
      }
      .indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        background: var(--cf-bg-secondary);
        border-radius: 12px;
        max-width: 85%;
        align-self: flex-start;
        font-size: 12px;
        color: var(--cf-text-secondary);
      }
      .dots {
        display: flex;
        gap: 3px;
      }
      .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--cf-text-secondary);
        animation: bounce 1.4s ease-in-out infinite;
      }
      .dot:nth-child(2) { animation-delay: 0.2s; }
      .dot:nth-child(3) { animation-delay: 0.4s; }
      @keyframes bounce {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
        40% { transform: scale(1); opacity: 1; }
      }
      :host([hidden]) { display: none; }
    `,
  ];

  @property() message = 'Investigando...';

  render() {
    return html`
      <div class="indicator">
        <div class="dots">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
        <span>${this.message}</span>
      </div>
    `;
  }
}
