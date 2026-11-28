/** The game's real sound manifest, read through Vite, for tests. */
import { parseManifest, type Manifest } from './manifest';

const raw: unknown = Object.values(
  import.meta.glob('../../public/assets/audio/manifest.json', { eager: true, import: 'default' }),
)[0];

export const TEST_MANIFEST: Manifest = parseManifest(raw) ?? { version: 0, base: '', sounds: {} };

/** True when the id is in the manifest. */
export const known = (id: string): boolean => id in TEST_MANIFEST.sounds;
