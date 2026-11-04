import { describe, expect, it } from 'vitest';
import type { NodeKind } from '../engine/types';
import { tileLabel } from './tileLabels';

const nodes = (...types: NodeKind[]) => types.map((type) => ({ type }));

describe('tileLabel', () => {
  it('labels River + Forest as Creek, in either order', () => {
    expect(tileLabel(nodes('river', 'forest'))).toBe('Creek');
    expect(tileLabel(nodes('forest', 'river'))).toBe('Creek');
  });

  it('labels 2 River + 1 other as River', () => {
    expect(tileLabel(nodes('river', 'mountain', 'river'))).toBe('River');
  });

  it('ignores Cap nodes', () => {
    expect(tileLabel(nodes('river', 'caps', 'forest'))).toBe('Creek');
  });

  it('leaves other combinations unlabelled', () => {
    expect(tileLabel(nodes('forest'))).toBeNull();
    expect(tileLabel(nodes('forest', 'wildlife', 'mountain'))).toBeNull();
  });
});
