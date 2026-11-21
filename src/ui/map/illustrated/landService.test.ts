/**
 * Getting the land onto the screen (Phase 10.5, section 12): a failure falls
 * back to the classic map, and the time it took is logged.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shownMapStyle } from '../mapStyleSetting';
import type { LandInput } from './land/model';

const timings = { land: 800, features: 100, paint: 40 };
vi.mock('./generate', () => ({
  generate: vi.fn(async (key: string) => ({
    result: { key, x0: 0, y0: 0, width: 10, height: 10, scale: 1, timings },
    painted: {},
    sketch: {},
  })),
}));

// Node has no Worker (so the land is made "on the main thread") and no frames.
vi.stubGlobal('requestAnimationFrame', (f: () => void) => setTimeout(f, 0));

const { failNextLand, landStatus, lastLandTimings, requestLand } = await import('./landService');

const req = (key: string) => ({ key, input: {} as LandInput, scale: 1 });
const settle = async (key: string) => {
  for (let i = 0; i < 50 && landStatus(key).status === 'drawing'; i++) {
    await new Promise((r) => setTimeout(r, 5));
  }
  return landStatus(key);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the land service', () => {
  it('makes the land and logs how long it took', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    requestLand(req('ok'));
    expect(landStatus('ok').status).toBe('drawing');
    expect((await settle('ok')).status).toBe('ready');
    expect(lastLandTimings()).toEqual(timings);
    expect(info).toHaveBeenCalledWith(expect.stringMatching(/^Illustrated map: \d+ ms \(land 800/));
  });

  it('a failure falls back to the classic map for that section, with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    failNextLand();
    requestLand(req('broken'));
    const status = await settle('broken');
    expect(status.status).toBe('failed');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('using the classic map'));
    expect(shownMapStyle('illustrated', status)).toBe('classic');
  });
});

describe('the map style shown', () => {
  it('is the one picked while the land is drawing or ready', () => {
    expect(shownMapStyle('illustrated', { status: 'drawing' })).toBe('illustrated');
    expect(shownMapStyle('illustrated', { status: 'ready' })).toBe('illustrated');
    expect(shownMapStyle('classic', { status: 'ready' })).toBe('classic');
  });
});
