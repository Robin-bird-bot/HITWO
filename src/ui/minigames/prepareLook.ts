/**
 * How Prepare's things look in the pop-up: a resource's or item's name and
 * picture (the painted icons, not the GPS greens), and the inventory's
 * header and foot lines (20-challenge-popup.md, section 4).
 */
import { ASSETS } from '../../config/assets';
import { ITEMS } from '../../content/items';
import { RESOURCES } from '../../content/resources';
import type { Thing, Tile } from '../../minigames/prepare';
import type { MinigameHiker } from '../../minigames/types';

/** "Bear Spray"; an item the game doesn't have yet gets its name from its id ("Woodcutting Axe"). */
export function thingName(t: Thing): string {
  if (t.kind === 'resource') return RESOURCES.find((r) => r.id === t.id)?.name ?? t.id;
  return ITEMS[t.id]?.name ?? t.id.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

/** Its picture, or none (an item without art yet). */
export function thingArt(t: Thing): string | null {
  if (t.kind === 'resource') return ASSETS.resources[t.id] ?? null;
  const art = ITEMS[t.id]?.art;
  return art ? ASSETS.itemArt(art) : null;
}

/** "MEAT, FISH OR MUSHROOM". */
export function acceptsLine(things: readonly Thing[]): string {
  const names = things.map((t) => thingName(t).toUpperCase());
  return names.length > 1
    ? `${names.slice(0, -1).join(', ')} OR ${names.at(-1)}`
    : (names[0] ?? '');
}

/** The foot line for a tile: "MOM'S GRASS · 3 FREE", "… (REST IN OTHER SLOTS) · NEEDS 1", "FISH · NOBODY HAS ANY". */
export function tileLine(
  tile: Tile,
  need: number,
  byId: (id: string) => MinigameHiker | undefined,
): { main: string; more: string } {
  const name = thingName(tile.thing).toUpperCase();
  if (!tile.hiker) return { main: name, more: '· NOBODY HAS ANY' };
  const who = (byId(tile.hiker)?.name ?? tile.hiker).toUpperCase();
  const rest = tile.partlyUsed ? ' (REST IN OTHER SLOTS)' : '';
  return {
    main: `${who}'S ${name}`,
    more: `· ${tile.free} FREE${rest}${tile.ok ? '' : ` · NEEDS ${need}`}`,
  };
}

/** A slot's outline: a conic gradient split evenly between the hikers who can fill it. */
export function ringOf(colors: readonly string[]): string | undefined {
  if (!colors.length) return undefined;
  const step = 360 / colors.length;
  return `conic-gradient(${colors.map((c, i) => `${c} ${i * step}deg ${(i + 1) * step}deg`).join(', ')})`;
}

/** "0:30". */
export const clockText = (sec: number): string => {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
