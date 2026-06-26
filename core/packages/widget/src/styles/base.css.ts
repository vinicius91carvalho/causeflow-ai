import { css } from 'lit';

export const baseStyles = css`
  :host {
    --cf-primary: var(--causeflow-primary, #6366f1);
    --cf-primary-hover: var(--causeflow-primary-hover, #4f46e5);
    --cf-bg: var(--causeflow-bg, #ffffff);
    --cf-bg-secondary: var(--causeflow-bg-secondary, #f9fafb);
    --cf-text: var(--causeflow-text, #1f2937);
    --cf-text-secondary: var(--causeflow-text-secondary, #6b7280);
    --cf-border: var(--causeflow-border, #e5e7eb);
    --cf-radius: var(--causeflow-radius, 12px);
    --cf-shadow: var(--causeflow-shadow, 0 4px 24px rgba(0, 0, 0, 0.12));
    --cf-font: var(--causeflow-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);

    font-family: var(--cf-font);
    font-size: 14px;
    line-height: 1.5;
    color: var(--cf-text);
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
`;
