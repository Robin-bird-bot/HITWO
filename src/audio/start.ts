/**
 * Starting the sound (32-audio-system.md, section 2): load the manifest,
 * follow Settings → Sound, and at the title fetch the small, common sounds
 * (about 2 MB) so the first clicks are heard at once.
 */
import { audio } from './engine';
import { idsStartingWith } from './manifest';
import { followSoundSettings } from './settings';
import { installUiSounds } from './uiSounds';

/** The sounds fetched at the title screen. */
const COMMON = [
  'ui.',
  'select.',
  'card.',
  'res.',
  'item.',
  'stat.',
  'cond.',
  'map.',
  'foot.',
  'act.',
  'day.',
  'chal.',
  'mg.',
  'book.',
  'craft.',
  'scav.',
  'trans.',
  'load.',
  'title.',
];

export function startAudio(): void {
  followSoundSettings();
  installUiSounds();
  void audio.start(import.meta.env.BASE_URL).then((manifest) => {
    if (manifest) void audio.preload(idsStartingWith(manifest, COMMON));
  });
}
