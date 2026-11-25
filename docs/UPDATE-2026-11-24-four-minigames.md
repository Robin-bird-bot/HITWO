# Update: November 24, 2026 (four new minigames, test version)

**Builds on the Bearrels updates** (`UPDATE-2026-11-24-bearrels-test`, `-bearrels-styles` and `-bearrels-gps-greens`). Finish those first if they aren't done. Keep everything already built.

This adds four minigames to the minigame framework and the testing tab:
- **Traildle:** guess a hidden code on trail signs, with up to two codes at once, Quordle style;
- **Find the Object:** find the named trail snacks in a crowd. It's still on Tier I, windy on Tier II and dark with a flashlight on Tier III;
- **Remember the Path:** watch a ranger walk a trail, then walk it from memory;
- **Find the Path:** take turns guessing a hidden trail through a forest, one step at a time.

It also adds a reusable **Line up** step, where the player sets the order of the hikers.

**This is a test version.** Wyatt wants to get the rules and feel right first, so the art is simple placeholder pixel art in the GPS greens, and there are no Prepare options yet. The full design is in `11-minigames-puzzles.md`. Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`, grouped by game and tier.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `11-minigames-puzzles.md` → `docs/design/11-minigames-puzzles.md`.
- `mockups/*` → `docs/mockups/minigames/puzzles/`.
- `art/traildle/`, `art/find-object/`, `art/remember-path/` and `art/forest-tiles/` → the game's minigame asset folder, next to `bearrels/`. `forest-tiles` is shared by Remember the Path and Find the Path.
- Then delete the leftover `update-2026-11-24-four-minigames/` folder.

---

## 1. Shared (design section 1)
- **Line up:** a reusable step before any minigame with 2 or more hikers.
  - Numbered cards; drag to reorder, or tap two to swap; then **Go**. Skip it with 1 hiker.
  - Every game receives the order.
- **Hiker tokens:** colored circles with the hiker's initial, with waiting, current, safe and out states.
- **HUD:** the same GPS-style boxes as Bearrels.
- **Results:** Passed or Failed for every hiker, in the existing results card.
- **The scene** is 320 × 240 scene units, scaled up with nearest-neighbor. The sprites are 1 px per unit; the forest tiles are drawn at 2×.

## 2. Traildle (design section 2)
- Pairs of hikers, in line-up order. Each hiker in a pair has their own code, and every guess goes into both boards. A solved board locks.
- Marks are fills, not colors:
  - solid dark: right spot;
  - dashed light: wrong spot;
  - grey crossed out: not in the code.
  
  Repeated digits from Tier II follow Wordle's rules.
- Signs, guesses and timer by tier are in the design's table.
- Input: arrows on the signs, typing, hover plus a digit, tapping the digit strip, ← →, Backspace and Enter. They all work together.
- The digit strip shows what's known about each digit, split in half when there are two boards.

## 3. Find the Object (design section 3)
- 12 snack sprites, all the same greens: only the shape differs.
- One target per hiker; the first k hikers in line pass if k targets are found.
- A wrong click costs [2 s].
- Modes: **Still** (Tier I), **Windy** (Tier II: drift sideways and wrap around the edges), **Dark** (Tier III: a flashlight circle follows the pointer).

## 4. Remember the Path (design section 4)
- The path goes from the bottom row to the top row and never repeats a tile.
- The ranger walks it, showing only his last 2 footprints. Then each hiker walks it from memory by dragging, tapping or using the arrow keys.
- Strikes by tier: [3], [2], [1]. Each hiker gets a new path.

## 5. Find the Path (design section 5)
- **The trail** starts at a shown trailhead on the bottom row and goes only up, left or right.
- **Picking:** hikers pick neighboring tiles. Right tiles extend a drawn trail line. Wrong tiles become thick trees and cost a try. A wrong pick can also reveal a random unpicked tile.
- **Running out of tries:** back to the trailhead and the back of the line, and the group loses an attempt. With no attempts left, running out means out.
- **What carries over:** without fog, what's uncovered stays and later hikers walk the known trail on their own.
- **Fog (Tier III):** only the last 2 picks stay visible.
- **Energy:** the first hiker through gets +[1] Energy, shown only in test mode.

## 6. Testing tab
- Add all four games to the game list, with **Tier** and **Hikers** settings and these overrides:
  - Traildle: Signs and Timer;
  - Find the Object: Mode;
  - Find the Path: Fog.
- Same flow as Bearrels: the pop-up in test mode (game name in the banner, empty poster frame, a still frame in the GPS), then Start, the GPS turns and zooms, then the line up, the game, the results, and back.
- Test mode never touches the save.

## 7. Tests
See design section 6.

## When you're done
Send Wyatt a short summary with:
- what was built;
- anything you had to interpret or guess;
- how to open each game from the testing tab, and which overrides are worth trying first.
