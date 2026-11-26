/**
 * The minigames' colors (docs/design/10-minigames.md, "Art: the GPS
 * greens" and "Hikers"): the ten LCD greens, G0 (darkest) to G9
 * (lightest); each hiker's own color; and the red for mistakes and hits.
 * (They came from Bearrels' layout.json until it was removed, Nov 26.)
 */

export const LCD_GREENS: readonly string[] = [
  '#111A10',
  '#1D2918',
  '#2B3A23',
  '#3C4E2F',
  '#52653F',
  '#6A7E51',
  '#859A66',
  '#A0B37D',
  '#BAC995',
  '#D3DFAF',
];

/** Each hiker's minigame color, by art id. */
export const HIKER_COLORS: Readonly<Record<string, string>> = {
  finn: '#E2683C',
  ellie: '#4A8FD4',
  mom: '#EBC04A',
  wyatt: '#6FBF5A',
  gdog: '#B06BD0',
  wink: '#3FB8B0',
};

/** Mistakes and hits only. */
export const MISTAKE_RED = '#C8423A';
