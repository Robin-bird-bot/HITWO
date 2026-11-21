/**
 * Trait icons (docs/ASSETS.md): white art on transparent in
 * public/assets/traits/, one file per trait, named after the trait in
 * lowercase with dashes ("Dog Mom" is `dog-mom`). A few share a file or use
 * another one; those say so with `icon` (Human Food uses `glutton`).
 */
import type { TraitDef } from '../../engine/effects';

/** "Just Around the Next Corner" → `just-around-the-next-corner`; "[Node] Finder" → `node-finder`. */
export function kebabName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** The trait's icon file name, without `.png`. */
export function iconFile(def: Pick<TraitDef, 'name' | 'icon'>): string {
  return def.icon ?? kebabName(def.name);
}
