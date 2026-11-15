import { describe, expect, it } from 'vitest';
import { tookLabel } from './tookWords';

describe('the label after a scavenge', () => {
  it.each([
    [{ resources: ['fur'] }, '+1 Fur'],
    [{ resources: ['wood', 'wood', 'moss'] }, '+2 Wood · +1 Moss'],
    [{ resources: [], caps: 2 }, '+2 caps'],
    [{ resources: [], caps: 1 }, '+1 cap'],
    [{ resources: [], items: ['trailMix'] }, 'Trail Mix'],
    [{ resources: [], empty: true as const }, 'Empty'],
    [{ resources: [], dropped: true as const }, 'Slipped away'],
    [{ resources: [] }, 'No room'],
  ])('%j reads "%s"', (took, label) => {
    expect(tookLabel(took)).toBe(label);
  });
});
