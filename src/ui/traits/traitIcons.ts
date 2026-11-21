/**
 * Which trait icons are on disk, read from public/assets/traits/ when the
 * game is built. A trait with no file yet (one added later) shows its
 * initials instead.
 */
import { asset } from '../../config/assets';
import { TRAITS } from '../../content/traits';
import { iconFile } from '../../content/traits/icons';

const ON_DISK = new Set(
  Object.keys(import.meta.glob('/public/assets/traits/*.png')).map((path) =>
    path.slice(path.lastIndexOf('/') + 1, -'.png'.length),
  ),
);

/** The trait's icon, or none when its file isn't in yet. */
export function traitIconUrl(traitId: string): string | undefined {
  const def = TRAITS[traitId];
  if (!def) return undefined;
  const file = iconFile(def);
  return ON_DISK.has(file) ? asset(`traits/${file}.png`) : undefined;
}
