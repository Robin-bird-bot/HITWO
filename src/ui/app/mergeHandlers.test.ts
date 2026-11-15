import { describe, expect, it } from 'vitest';
import { mergeHandlers } from './mergeHandlers';

describe('mergeHandlers', () => {
  it('runs handlers of the same name in order, and keeps everything else', () => {
    const calls: string[] = [];
    const merged = mergeHandlers<Record<string, unknown>>(
      { onClick: () => calls.push('own'), title: 'a' },
      { onClick: () => calls.push('preview'), onPointerDown: () => calls.push('down') },
      { onPointerDown: () => calls.push('drag'), 'data-draggable': true },
    );
    (merged.onClick as () => void)();
    (merged.onPointerDown as () => void)();
    expect(calls).toEqual(['own', 'preview', 'down', 'drag']);
    expect(merged.title).toBe('a');
    expect(merged['data-draggable']).toBe(true);
  });
});
