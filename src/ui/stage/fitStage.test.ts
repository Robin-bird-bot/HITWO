import { describe, expect, it } from 'vitest';
import { fitStage } from './fitStage';

describe('fitStage', () => {
  it('fits exactly at the stage size', () => {
    expect(fitStage(1600, 1000)).toEqual({ scale: 1, left: 0, top: 0 });
  });

  it('letterboxes left and right in a wide window', () => {
    expect(fitStage(2000, 1000)).toEqual({ scale: 1, left: 200, top: 0 });
  });

  it('letterboxes top and bottom in a tall window', () => {
    expect(fitStage(1600, 2000)).toEqual({ scale: 1, left: 0, top: 500 });
  });

  it('scales down for a phone in landscape', () => {
    const fit = fitStage(844, 390);
    expect(fit.scale).toBeCloseTo(0.39);
    expect(fit.left).toBe(110);
    expect(fit.top).toBe(0);
  });

  it('scales up on a big screen', () => {
    const fit = fitStage(1920, 1080);
    expect(fit.scale).toBeCloseTo(1.08);
    expect(fit.left).toBe(96);
    expect(fit.top).toBe(0);
  });

  it('falls back to scale 1 before the viewport has a size', () => {
    expect(fitStage(0, 0)).toEqual({ scale: 1, left: 0, top: 0 });
  });
});
