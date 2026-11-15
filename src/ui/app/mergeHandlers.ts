/**
 * Several sets of props for one element, with any event handlers of the same
 * name run one after the other (in the order given) instead of the last one
 * winning. For an element that's a click target, a preview and a drag source.
 */
export function mergeHandlers<T extends object>(...parts: readonly object[]): T {
  const out: Record<string, unknown> = {};
  for (const part of parts) {
    for (const [key, value] of Object.entries(part)) {
      const before = out[key];
      out[key] =
        typeof before === 'function' && typeof value === 'function' && key.startsWith('on')
          ? (...args: unknown[]) => {
              (before as (...a: unknown[]) => void)(...args);
              (value as (...a: unknown[]) => void)(...args);
            }
          : value;
    }
  }
  return out as T;
}
