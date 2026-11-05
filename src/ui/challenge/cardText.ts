/**
 * Reading a card's text out (04-challenges.md, "How to read a challenge"):
 * - [Brackets] never show; they're game logic.
 * - {names} become the rolled numbers. A Y shows as its range on the card,
 *   and as each hiker's own number in their section.
 * - A "(25%)" part shows only if it was included at reveal. With no rolls
 *   yet (the #debug-challenges page), every part shows, marked with its chance.
 */
import { scaledRange, type CardDef, type CardRolls, type TextPart } from '../../engine';

export interface TextOptions {
  /** The card's rolls. Without them, every number shows as its range. */
  rolls?: CardRolls;
  /** Fill in this hiker's own Y numbers. */
  hikerId?: string;
  /** Ranges one tier up (TIER_SCALE). */
  scale?: number;
}

export function cardText(
  card: CardDef,
  parts: readonly TextPart[],
  opts: TextOptions = {},
): string {
  return parts
    .map((part) => {
      if (typeof part === 'string') return part;
      if (opts.rolls) return opts.rolls.includes[part.include] ? part.text : '';
      const chance = Math.round((card.includes?.[part.include] ?? 0) * 100);
      return ` (${chance}%:${part.text})`;
    })
    .join('')
    .replace(/\{(\w+)\}/g, (whole, name: string) => fill(card, name, opts) ?? whole)
    .trim();
}

/** A range as it reads on a card: "2–4", or "3" when it can only be one number. */
export function rangeText([lo, hi]: readonly [number, number]): string {
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}

function fill(card: CardDef, name: string, opts: TextOptions): string | undefined {
  const def = card.rolls?.[name];
  if (!def) return undefined;
  const range = rangeText(scaledRange(def, opts.scale ?? 1));
  if (!opts.rolls) return range;
  if (def.roll === 'x') return String(opts.rolls.x[name] ?? range);
  const own = opts.hikerId ? opts.rolls.y[opts.hikerId]?.[name] : undefined;
  return own === undefined ? range : String(own);
}
