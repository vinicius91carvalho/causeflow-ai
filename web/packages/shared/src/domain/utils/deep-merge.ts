export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/**
 * Deep-merges multiple objects. Later sources override earlier ones at the leaf level.
 * Arrays are replaced (not concatenated).
 */
export function deepMerge<T extends Record<string, unknown>>(
  ...sources: Array<DeepPartial<T> | Record<string, unknown>>
): T {
  const result: Record<string, unknown> = {};

  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        typeof result[key] === 'object' &&
        result[key] !== null &&
        !Array.isArray(result[key])
      ) {
        result[key] = deepMerge(
          result[key] as Record<string, unknown>,
          value as Record<string, unknown>,
        );
      } else {
        result[key] = value;
      }
    }
  }

  return result as T;
}
