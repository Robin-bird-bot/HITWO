/**
 * The edge test's check (Phase 10.6, part B): every card in a marked window
 * (`data-edge-window`, cards `data-edge-card` or `data-scav-card`) and every
 * tooltip on screen must lie inside its window and the game screen.
 */
import { BALANCE } from '../../config/balance';

export interface Problem {
  where: string;
  what: string;
}

/** Every card and tooltip on screen, checked against its window and the stage. */
export function edgeCheck(): { checked: number; problems: Problem[] } {
  const stage = document.querySelector('[data-stage]') ?? document.body;
  const s = stage.getBoundingClientRect();
  const inside = (r: DOMRect, o: DOMRect, m = 0) =>
    r.left >= o.left + m - 0.5 &&
    r.top >= o.top + m - 0.5 &&
    r.right <= o.right - m + 0.5 &&
    r.bottom <= o.bottom - m + 0.5;
  const problems: Problem[] = [];
  let checked = 0;
  for (const w of document.querySelectorAll<HTMLElement>('[data-edge-window]')) {
    const wr = w.getBoundingClientRect();
    const name = w.dataset.edgeWindow ?? 'Window';
    const cards = w.querySelectorAll<HTMLElement>('[data-edge-card], [data-scav-card]');
    cards.forEach((c, i) => {
      checked += 1;
      const cr = c.getBoundingClientRect();
      if (!inside(cr, wr))
        problems.push({ where: name, what: `card ${i + 1} goes outside the window` });
      if (!inside(cr, s)) problems.push({ where: name, what: `card ${i + 1} goes off the screen` });
    });
  }
  const margin = BALANCE.ui.popupMargin * (s.width / 1600);
  for (const t of document.querySelectorAll<HTMLElement>(
    '[role="tooltip"], [role="dialog"][aria-label="Trait"]',
  )) {
    if (t.offsetParent === null) continue;
    checked += 1;
    if (!inside(t.getBoundingClientRect(), s, margin)) {
      problems.push({ where: 'Tooltip', what: (t.textContent ?? '').slice(0, 40) });
    }
  }
  return { checked, problems };
}
