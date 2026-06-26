/**
 * Formats a price value for display.
 * Numbers are formatted as USD currency; strings (e.g. "Custom") are returned as-is.
 */
export function formatPrice(price: number | string): string {
  if (typeof price === 'string') {
    return price;
  }

  if (price === 0) {
    return '$0';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Formats a number with comma separators for readability.
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}
