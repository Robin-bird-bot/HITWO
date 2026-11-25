# Update: November 25, 2026 (four more minigames: Trail Map, Memory Puzzle, Picture Puzzle, Thin Ice)

**Builds on the earlier minigame updates**, including the Line up step from `UPDATE-2026-11-24-four-minigames` and the trail-snack sprites in `find-object/snacks/`. Finish those first if they aren't done. Keep everything already built.

This adds four test-version games, and groups the testing tab's game list by category:
- **Trail Map:** turn trail tiles to connect each hiker's trailhead to the exit. With several hikers, a **Mode** setting chooses One at a time or Together.
- **Memory Puzzle:** match snack cards.
  - Each set is drawn in its hiker's color. When misses run out, hikers with sets left fail.
  - Higher tiers add visible card swaps, a timer, and sets of 3.
- **Picture Puzzle:** drag pieces from stacked piles into a grid. Two hikers get two pictures that share one tray.
- **Thin Ice:** Minesweeper on a frozen lake. There are 2 holes per hiker on top of a base by tier. Falling in takes out the hiker at the front of the line.

The full design is in `13-minigames-puzzles-2.md`. Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `13-minigames-puzzles-2.md` → `docs/design/13-minigames-puzzles-2.md`.
- `mockups/*` → `docs/mockups/minigames/puzzles-2/`.
- `art/trail-map/`, `art/memory/`, `art/picture-puzzle/`, `art/thin-ice/` → the game's minigame asset folder, next to the others.
- Then delete the leftover `update-2026-11-25-puzzle-games/` folder.

---

## 1. Trail Map (design section 1)
- **Pieces:** five trail pieces, each with a lit version, as 32-unit tiles. Click turns a tile 90° clockwise; right-click or Shift + click turns it the other way.
- **Making a board:** start from solution trails (one per hiker, joining allowed), fill in the other tiles, then scramble the turns. Lock a few tiles on Tiers II and III.
- **Lighting:** trace from each trailhead after every turn.
- **Modes:** One at a time (default): a hiker passes the moment their trail reaches the exit. Together: every trail must reach it at once.
- **Time:** [60], [75] or [90] s by tier, +[20] s per extra hiker.

## 2. Memory Puzzle (design section 2)
- **Cards:** card back and face art, with the snack sprites tinted into each hiker's color using the tint rule in the design.
- **Board:** 4 × 4, 5 × 4 or 6 × 4.
- **Play:** a [1 s] preview, then visible swaps on Tiers II and III. Misses [6], [5], [4] by tier; Wyatt's 3 would be very tight with blind first flips, and the setting can go that low. Timer on Tiers II and III. Sets of 3 on Tier III.

## 3. Picture Puzzle (design section 3)
- **Pictures:** 120 × 120 placeholders, cut into 4 × 4 or 5 × 5 square pieces.
- **The tray:** piles where only the top piece shows. Taking it reveals the next one.
- **Moving pieces:** pieces snap to any empty cell, can be moved again or put back on a pile. Tier I locks correct pieces with a click.
- **Hikers:** two pictures at once for pairs of hikers.
- **Time:** [3 s] per piece.

## 4. Thin Ice (design section 4)
- **The rules:** the first tap is always safe, numbers count the holes around, and zeros open up their neighbors.
- **Flags:** right-click, a long press, or the FLAG button.
- **Holes:** a hole takes out the front hiker in line, and play goes on. Checking every safe cell wins.

## 5. Testing tab (design section 5)
- **Categories:** group the game list by category.
- **New games:** add the four, with their settings.

## 6. Tests
See design section 6.

## When you're done
Send Wyatt a short summary with:
- what was built;
- anything you had to interpret;
- where each game is in the testing tab and which settings to try first.
