export function applyTheme(host: HTMLElement, primaryColor?: string): void {
  if (primaryColor) {
    host.style.setProperty('--causeflow-primary', primaryColor);
    // Darken for hover
    host.style.setProperty('--causeflow-primary-hover', darken(primaryColor, 15));
  }
}

function darken(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - Math.round(2.55 * percent));
  const g = Math.max(0, ((num >> 8) & 0x00ff) - Math.round(2.55 * percent));
  const b = Math.max(0, (num & 0x0000ff) - Math.round(2.55 * percent));
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}
