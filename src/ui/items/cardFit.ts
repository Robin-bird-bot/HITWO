/**
 * How an item card's words fit (docs/design/31-trailmate-item-cards.md,
 * section 1), on the 220-wide card the mock is drawn at (`ItemCard` scales it
 * by width):
 *
 * - The text is Pixelify Sans at 12.5 px. Longer text shrinks, to 10 px at
 *   the least, so it never covers the bottom row.
 * - Text too long even at 10 px takes room from the art: the art shrinks (to
 *   [70] px at the least) and the name and text move up.
 * - The name (Edit Undo, 15 px) shrinks to fit its line.
 *
 * A character-count rule (like the old card's FIT_CHARS), measured from the
 * fonts: Pixelify Sans averages 0.395 em a character, Edit Undo 0.59 em.
 * Word wrap wastes some of each line.
 */

/** The full-size card's layout (31's mock, cards.html), in px. */
export const CARD = {
  width: 220,
  /** The art: its size and top, on the screen. */
  art: 118,
  artTop: 33,
  artMin: 70,
  /** The name's top, under the art; the text's top under the name. */
  nameTop: 156,
  textTop: 175,
  /** Where the bottom row begins (Quality and the counter). */
  bottomTop: 218,
  /** The text's and the name's width. */
  textWidth: 168,
  nameWidth: 174,
  text: { size: 12.5, min: 10, line: 1.18 },
  name: { size: 15, min: 10 },
} as const;

const TEXT_EM = 0.395;
const NAME_EM = 0.59;
/**
 * A wrapped line holds about this share of what would fit. Measured on every
 * card in the browser (#debug-items): at 0.65 the rule never counts fewer
 * lines than the card really has.
 */
const WRAP = 0.65;

/** How many lines `chars` characters take at a size. */
export function linesFor(chars: number, size: number): number {
  const perLine = Math.floor(CARD.textWidth / (TEXT_EM * size));
  return Math.max(1, Math.ceil(chars / Math.max(1, perLine * WRAP)));
}

export interface CardFit {
  /** The text's size, and the art's (it shrinks only when the text needs the room). */
  textSize: number;
  art: number;
  /** How much the name and text move up (the room the art gave). */
  lift: number;
  nameSize: number;
  lines: number;
}

/** The sizes for an item's name and text on a full-size card. */
export function cardFit(name: string, text: string): CardFit {
  const room = CARD.bottomTop - CARD.textTop;
  const height = (lines: number, size: number) => lines * size * CARD.text.line;
  let textSize: number = CARD.text.size;
  for (; textSize > CARD.text.min; textSize -= 0.5) {
    if (height(linesFor(text.length, textSize), textSize) <= room) break;
  }
  textSize = Math.max(CARD.text.min, textSize);
  const lines = linesFor(text.length, textSize);
  const over = Math.max(0, height(lines, textSize) - room);
  const art = Math.max(CARD.artMin, CARD.art - Math.ceil(over));
  const nameFits = CARD.nameWidth / (NAME_EM * Math.max(1, name.length));
  return {
    textSize,
    art,
    lift: CARD.art - art,
    nameSize: Math.max(CARD.name.min, Math.min(CARD.name.size, Math.floor(nameFits * 2) / 2)),
    lines,
  };
}

/** Whether the text fits above the bottom row with these sizes. */
export const fits = (f: CardFit): boolean =>
  f.lines * f.textSize * CARD.text.line <= CARD.bottomTop - CARD.textTop + f.lift;
