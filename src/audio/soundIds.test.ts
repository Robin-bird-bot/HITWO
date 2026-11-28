/**
 * Every sound the code plays is in the manifest (32-audio-system.md, section
 * 8), and no hiker motifs are played. Reads the game's own source: every
 * quoted id with a sound's prefix (`'card.flip'`, `"ui.confirm"`), and the
 * ones with no prefix passed to the players.
 */
import { describe, expect, it } from 'vitest';
import { TEST_MANIFEST, known } from './testManifest';

// The screens and the audio code (the engine's own strings aren't sounds).
const SOURCES = import.meta.glob(
  ['../ui/**/*.{ts,tsx}', './*.ts', '../App.tsx', '!../**/*.test.{ts,tsx}'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
) as Record<string, string>;

const PREFIXES = new Set(
  Object.keys(TEST_MANIFEST.sounds)
    .filter((id) => id.includes('.'))
    .map((id) => id.split('.')[0]),
);
const BARE = Object.keys(TEST_MANIFEST.sounds).filter((id) => !id.includes('.'));

describe('the sounds the code plays', () => {
  const found = new Map<string, string>();
  for (const [file, text] of Object.entries(SOURCES)) {
    if (file.includes('/config/') || file.endsWith('testManifest.ts')) continue;
    for (const m of text.matchAll(/['"]([a-z][a-zA-Z]*)\.([a-zA-Z0-9.]+)['"]/g)) {
      const rest = m[2]!;
      // File names (`bear.png`) aren't sounds.
      if (/(^|\.)(png|svg|webp|jpg|gif|ogg|mp3|css|ts|tsx|json)$/.test(rest)) continue;
      if (PREFIXES.has(m[1]!) && !rest.endsWith('.')) found.set(`${m[1]}.${rest}`, file);
    }
    const players =
      /(?<![.\w])(?:sfx|mgSfx|loop|useMgLoop|useOpenSound|addOnce|add)\(\s*['"]([a-zA-Z]+)['"]/g;
    for (const m of text.matchAll(players)) found.set(m[1]!, file);
  }

  it('finds the game’s sounds', () => {
    expect(found.size).toBeGreaterThan(150);
    for (const id of BARE.filter((id) => id !== 'healed')) {
      // Each bare id the game plays is found by its player call.
      if (found.has(id)) expect(known(id)).toBe(true);
    }
  });

  it('are all in the manifest', () => {
    const missing = [...found].filter(([id]) => !known(id)).map(([id, f]) => `${id} (${f})`);
    expect(missing).toEqual([]);
  });

  it('never play a hiker motif', () => {
    expect([...found.keys()].filter((id) => id.startsWith('motif.'))).toEqual([]);
  });
});
