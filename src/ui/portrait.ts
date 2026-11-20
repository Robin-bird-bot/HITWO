/**
 * A hiker's portrait image. Every hiker uses the placeholder portrait for now
 * (CLAUDE.md); test hikers (Phase 10a) have no art, so theirs is their
 * initials on a circle of their color, as an image so it fits wherever a
 * portrait does.
 */
import { ASSETS } from '../config/assets';
import { characterFor } from '../content/characters';

const cache = new Map<string, string>();

export function portraitSrc(hikerId: string): string {
  const c = characterFor(hikerId);
  if (c.portrait !== 'initials') return ASSETS.portraits.placeholder;
  const hit = cache.get(hikerId);
  if (hit) return hit;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<rect width="100" height="100" fill="${c.color}"/>` +
    `<text x="50" y="50" dy="0.35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" ` +
    `font-weight="700" font-size="40" fill="#1D2220">${c.initials ?? '?'}</text></svg>`;
  const src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  cache.set(hikerId, src);
  return src;
}
