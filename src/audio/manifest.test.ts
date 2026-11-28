import { describe, expect, it } from 'vitest';
import { fileUrl, idsStartingWith, parseManifest, pickFormat } from './manifest';
import { TEST_MANIFEST as manifest } from './testManifest';

const raw: unknown = Object.values(
  import.meta.glob('../../public/assets/audio/manifest.json', { eager: true, import: 'default' }),
)[0];
/** The sound files on disk, as `assets/audio/sfx/<name>.<ext>`. */
const onDisk = new Set(
  Object.keys(import.meta.glob('../../public/assets/audio/sfx/*.{ogg,mp3}')).map((p) =>
    p.replace('../../public/', ''),
  ),
);

describe('the sound manifest (32-audio-system.md, section 1)', () => {
  it('reads every sound', () => {
    expect(Object.keys(manifest.sounds)).toHaveLength(
      Object.keys((raw as { sounds: object }).sounds).length,
    );
    expect(Object.keys(manifest.sounds).length).toBeGreaterThanOrEqual(342);
  });

  it('has an .ogg and an .mp3 of every file', () => {
    expect(onDisk.size).toBeGreaterThan(800);
    const missing: string[] = [];
    for (const [id, e] of Object.entries(manifest.sounds)) {
      for (const f of e.files) {
        for (const format of ['ogg', 'mp3'] as const) {
          if (!onDisk.has(fileUrl(manifest, f, format, ''))) missing.push(`${id}: ${f}.${format}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('gives files only to sounds that are made', () => {
    for (const [id, e] of Object.entries(manifest.sounds)) {
      if (e.status === 'need' || e.status === 'code') expect(e.files, id).toEqual([]);
      else expect(e.files.length, id).toBeGreaterThan(0);
    }
  });

  it('has no hiker motifs (Wyatt)', () => {
    expect(idsStartingWith(manifest, ['motif.'])).toEqual([]);
  });

  it('skips entries that are not well formed', () => {
    const m = parseManifest({
      base: 'a/',
      sounds: {
        ok: { files: ['x'], bus: 'ui', status: 'made', loop: true, volume: 0.5 },
        badBus: { files: ['x'], bus: 'loud', status: 'made' },
        badFiles: { files: [3], bus: 'ui', status: 'made' },
      },
    });
    expect(Object.keys(m?.sounds ?? {})).toEqual(['ok']);
    expect(m?.sounds.ok).toEqual({
      files: ['x'],
      bus: 'ui',
      status: 'made',
      loop: true,
      volume: 0.5,
    });
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest({ sounds: [] })).toBeNull();
  });

  it('builds URLs under the site base', () => {
    expect(fileUrl(manifest, 'ui-click-1', 'ogg', '/HITWO/')).toBe(
      '/HITWO/assets/audio/sfx/ui-click-1.ogg',
    );
  });
});

describe('pickFormat', () => {
  it('uses .ogg, and .mp3 where Ogg Vorbis can’t play', () => {
    expect(pickFormat(() => 'probably')).toBe('ogg');
    expect(pickFormat(() => 'maybe')).toBe('ogg');
    expect(pickFormat(() => '')).toBe('mp3');
  });
});
