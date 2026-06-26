export function sanitizeInput(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim();
}

export function sanitizeFormData<T extends object>(data: T): T {
  const sanitized = { ...data } as Record<string, unknown>;
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeInput(sanitized[key] as string);
    }
  }
  return sanitized as T;
}
