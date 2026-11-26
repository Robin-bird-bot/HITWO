# Minigames, batch 3: Trail Map, Memory Puzzle, Picture Puzzle, Thin Ice

**Revised November 25 (after Wyatt played them).** What changed:
- **Five tiers:** every table now runs to Tier V (Tiers IV and V are harder versions).
- **Trail Map** was too easy: less time, every hiker must be connected at the same time (no more One at a time mode), and trail signs to connect from Tier II.
- **Memory Puzzle** was way too hard: no miss limit. It runs on a clock, a match adds time, and from Tier II a miss takes some away.
- **Picture Puzzle** was a bit hard: a piece placed in its right spot adds time. Wyatt's own photos replace the placeholders, tinted into the GPS greens.
- **Thin Ice:** great as is. It only gains Tiers IV and V.

Four more puzzle and memory games for Phase 10.8. They plug into the same framework as the others (`10-minigames.md`, `11-minigames-puzzles.md`): the challenge pop-up, the party GPS, the shared **Line up** step, per-hiker results and the testing tab.

**Test version:**
- placeholder pixel art in the GPS greens (`art/`, plus simple shapes drawn in code);
- no Prepare options yet;
- the same 320 × 240 scene units, scaled up with nearest-neighbor.

Numbers in [brackets] are first guesses. Put them in `balance.ts` with `TODO(wyatt)`, by game and tier. Settings marked **(setting)** are also in the testing tab.

**Where they sit in the categories** (design doc, "Minigame categories"):
- Trail Map, Picture Puzzle and Thin Ice are **Puzzle and logic**. Thin Ice replaces the planned Minefield.
- Memory Puzzle is **Memory**. It replaces the planned Trail Memory.

---

## 1. Trail Map
Turn trail tiles to connect each trailhead to the exit. See `mockups/1-trail-map.png` and `2-trail-map-hikers.png`.

### Tiles
- **The pieces:** dead end, straight, corner, tee and cross (`art/trail-map/trail-<kind>.png`, 16 × 16, drawn at 2× as 32-unit tiles).
- **Lit versions:** each piece has a `-lit` version for trail that's connected to a trailhead.
- **Turning:**
  - click or tap a tile to turn it 90° clockwise;
  - right-click, or Shift + click, turns it the other way;
  - keyboard: the arrow keys move a cursor, and Space turns the tile under it.
- **The turn itself:** quick, about [0.12 s], with a small click.

### The board
| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Grid **(setting)** | [4 × 4] | [5 × 5] | [6 × 6] | [6 × 6] | [6 × 6] |
| Time **(setting)** | [45 s] | [55 s] | [70 s] | [60 s] | [55 s] |
| Extra time per hiker after the first | +[15 s] | +[15 s] | +[15 s] | +[15 s] | +[15 s] |
| Trail signs to connect | 0 | [1] | [2] | [2] | [3] |
| Locked tiles (can't turn, marked with a stake) | 0 | [2] | [3] | [3] | [4] |

- **Trailheads:** one per hiker, on the outside edge next to an edge tile, shown as that hiker's token. The trail must enter that tile from the edge side.
- **The exit:** one gap on the edge, marked with an arrow and "EXIT". Never on the same side as a trailhead when that can be avoided.

### Making a board
1. Pick the exit and the trailheads.
2. Make each hiker's solution trail, from their trailhead to the exit, as a random walk without repeating tiles. Later trails may join earlier ones.
3. Give each tile on a trail the piece that matches its openings.
4. Fill the other tiles with random pieces: straight [30%], corner [35%], tee [20%], dead end [10%], cross [5%].
5. Turn every tile a random amount. If any trailhead is already connected, turn again.
6. Locked tiles are picked only from solution tiles, and are locked in their correct direction.

### Trail signs (new, Tier II and up)
- **What they are:** extra stops the trail has to reach as well as the exit. A sign is a tile with a small trail-sign post on it (`art/trail-map/trail-sign.png`, 16 × 16, drawn over the tile at 2×).
- **Reached:** a sign tile counts as reached when it's lit, connected to a trailhead. Its post switches to `trail-sign-lit.png`.
- **Placing them:** when making the board (step 2 above), route the first hiker's solution trail through every sign on its way to the exit: trailhead → sign 1 → sign 2 → exit, still without repeating tiles. Signs are never on an edge tile next to a trailhead or the exit.
- **Side panel:** SIGNS 1 / 2 and HIKERS 1 / 3. See `mockups/8-trail-map-signs.png`.

### Lighting up
- After every turn, trace from each trailhead through tiles whose openings line up.
- Every tile reached uses its `-lit` version, and the exit lights up when it's reached.
- A trail that's connected to the exit gets small footprints along it.

### Passing (changed: everyone together)
- **Every hiker's trailhead and every sign** must be connected to the exit **at the same moment**. Then everyone walks out together and passes. The One at a time mode is gone.
- **Running out of time:** everyone fails, unless all were connected at once.
- **One hiker:** the same rule, with one trailhead.
- No Line up is needed; trailheads are placed at random.

---

## 2. Memory Puzzle
Flip cards to find matching snacks. See `mockups/3-memory-preview.png`, `4-memory-play.png` and `5-memory-tier-3.png`.

### Cards
- **Art:** the card back is `art/memory/card-back.png` (22 × 26) and the face is `card-face.png`, with a trail-snack sprite (`find-object/snacks/`) centered on it.
- **Colors:** each set of matching cards belongs to one hiker, and its snack is drawn in **that hiker's color**.
  - **The tint:** the snack's dark greens become a dark shade of the hiker's color, its middle greens the color itself, and its light greens a pale shade. The black outline stays.
  - **Kinds:** the same snack can belong to two hikers. Finn's orange and Mom's orange are different sets. That also gives more kinds of cards than there are snacks.
  - **One hiker:** every snack is in their color.
- **Dealing:** sets go to the hikers in turn, so the split is as even as possible (8 pairs for 3 hikers = 3, 3, 2).

### The board
| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Grid | [4 × 4] | [5 × 4] | [6 × 4] | [6 × 4] | [6 × 4] |
| Match **(setting)** | pairs | pairs | sets of 3 | sets of 3 | sets of 3 |
| Preview **(setting)** | [1 s] | [1 s] | [1 s] | [0.8 s] | [0.6 s] |
| Swaps after the preview | none | [2] | [4], plus [1] after every miss | [6], plus [1] | [8], plus [1] |
| Time **(setting)** | [40 s] | [45 s] | [55 s] | [50 s] | [45 s] |
| A match adds | +[5 s] | +[4 s] | +[4 s] | +[3 s] | +[3 s] |
| A miss takes away | nothing | [1 s] | [2 s] | [3 s] | [4 s] |

**Changed:** there's no miss limit any more, only the clock. Wyatt found the misses way too hard.
- Show "+5 S" or "−2 S" by the clock for a moment when time changes. See `mockups/9-memory-clock.png`.

### Play
1. **Preview:** every card shows face up for the preview time, then they all flip over.
2. **Swaps (Tiers II and III):** cards visibly slide and trade places, one swap at a time ([0.4 s] each), so a sharp player can follow them.
3. **Flipping:** flip one card at a time by tap or click (or the arrow keys and Space).
   - When 2 (or 3) are face up and they all match, they stay up with a dark frame.
   - If they don't match, they stay up for [0.8 s] with a red frame, then flip back. From Tier II, the clock loses time.
4. **The end:**
   - when every set is matched, everyone passes;
   - when the time runs out, each hiker who still has an unmatched set fails, and hikers whose sets are all matched pass.
- **The side panel** shows the clock (a bar and the time) and each hiker's sets left.
- No Line up is needed.

---

## 3. Picture Puzzle
Rebuild a picture from pieces stacked in a tray. With two hikers there are two pictures and one shared tray. See `mockups/6-picture-puzzle.png`.

### Pictures and pieces
- **Pictures (new):** Wyatt's own photos, cut square and tinted into the GPS greens with a light LCD-style dither: `art/picture-puzzle/picture-lake-island.png`, `-mountain-lake`, `-green-valley`, `-foggy-forest`, `-canyon-trail` and `-rocky-butte`, 120 × 120 each. They replace the old placeholders (bear, peaks, oak, camp), which can be deleted. A game never repeats a picture. See `mockups/11-picture-photos-all.png`.
- **Pieces:** square cuts of the picture.
  - [4 × 4] on Tiers I and II: 30 units each.
  - [5 × 5] on Tiers III and IV: 24 units each.
  - [6 × 6] on Tier V: 20 units each.
- **Grid (setting):** 4 × 4, 5 × 5 or 6 × 6.

### Layout
- **One picture:** one empty grid near the top, centered. On Tier I a small thumbnail of the finished picture sits in the corner **(setting: On or Off)**.
- **Two pictures:** two grids side by side, each labeled with its hiker ("FINN'S PICTURE").
- **The tray** runs along the bottom with [6] piles on Tier I, [5] on Tier II and [4] on Tiers III to V. Fewer piles means taller stacks.
  - All the pieces are shuffled into the piles, from both pictures when there are two.
  - Only the top piece of each pile shows. Offset edges below it show how deep the pile is, with a count ("x4").

### Moving pieces
- **Placing:** drag the top piece of a pile onto any empty cell, and it snaps in. Taking it reveals the piece under it.
- **Tap, then tap** also works: tap a piece, then tap a cell.
- **Rearranging:**
  - a piece in a grid can be dragged to another cell, swapping with any piece already there;
  - or it can go back onto any pile, on top.
- **Feedback:**
  - Tier I: a piece dropped in its right spot clicks and locks.
  - Tiers II and III: no hints. Pieces snap anywhere, and the picture is checked when its grid is full.
- **Done:** when every piece of a picture is in its own spot, the picture glows, locks, and its hiker passes.

### Hikers and time
- **Pairs:** hikers play in pairs in line-up order: 1 and 2 together, then 3 and 4 (with 3 hikers: 1 and 2, then 3 alone).
- **Time (setting):** [3 s] per piece on Tiers I and II, [2.5 s] on Tier III, [2.2 s] on Tier IV and [2 s] on Tier V. That's 48 s for one 4 × 4 picture, and 96 s for two.
- **Time bonus (new):** the first time a piece lands in its own spot, the clock gains time: +[3 s] on Tier I, +[2 s] on Tiers II and III, +[1.5 s] on Tier IV, +[1 s] on Tier V. Show "+2 S" over the piece. Each piece earns it only once, so moving a piece out and back in doesn't add more. See `mockups/10-picture-photos.png`.
  - This also hints which pieces are right on Tiers II and up. That's fine: Wyatt wants it a bit easier.
- **Running out of time:** a hiker whose picture isn't finished fails.

---

## 4. Thin Ice
**Renamed Minefield (Dog Waste Zone) on November 26. The new Thin Ice is in `23-minigames-final.md`, section 7.**

Minesweeper on a frozen lake: the "mines" are holes in the ice. Map them without falling in. See `mockups/7-thin-ice.png`.

### The ice
| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Grid **(setting)** | [8 × 6] | [9 × 7] | [10 × 8] | [10 × 8] | [11 × 8] |
| Holes | [4] + 2 per hiker | [6] + 2 per hiker | [8] + 2 per hiker | [9] + 2 per hiker | [10] + 2 per hiker |
| Timer **(setting)** | none | [3:00] | [2:30] | [2:15] | [2:00] |

The 2 holes per hiker are Wyatt's rule, and a setting.

- **Cells:** 24 units (`art/thin-ice/*.png`, 12 × 12 drawn at 2×).
  - `ice`: not yet checked;
  - `open`: checked, safe;
  - `hole`: open water;
  - `flag`: a marker.

### Play
- **The first tap is always safe.** It opens a patch with no holes around it.
- **Tap (or click) to check a cell:**
  - safe ice shows how many holes touch it, diagonals included;
  - a 0 shows blank and opens its neighbors automatically.
- **Mapping a hole (flag):**
  - right-click, a long press ([0.4 s]), or the **FLAG** button, which switches taps to flags until it's pressed again;
  - flagged cells can't be checked until the flag is removed;
  - the panel shows the holes left: total − flags − holes already fallen into.
- **Keyboard:** the arrow keys move a cursor, Space checks, F flags.
- **Falling in:**
  - checking a hole means the **hiker at the front of the line falls in**, with a splash. They're out and fail;
  - the hole stays open, and the next hiker in line steps up;
  - the ice doesn't reset.
- **Winning:** when every safe cell is checked, every hiker still in passes.
- **Ending early:** if everyone falls in, the game ends. From Tier II it also ends when the timer runs out, and hikers still in fail.
- **Line up:** yes. It decides who steps first.

---

## 5. Testing tab
- **Group the game list by category:** Movement and dodging, Puzzle and logic, Memory, Search, Reaction and timing, Guess and luck. Use the category table in the design doc.
- **Add the four games**, each with **Tier** and **Hikers**, plus:
  - **Trail Map:** Grid (Auto, 4 to 7), Time (Auto, Off, or 20 to 180 s), Signs (Auto, 0 to 3). The Mode setting is gone;
  - **Memory Puzzle:** Match (Auto, Pairs, Threes), Preview (0.5 to 5 s), Swaps (Auto, Off, On), Time (Auto, or 20 to 180 s), Match bonus (Auto, 0 to 10 s), Miss cost (Auto, 0 to 10 s). The Misses setting is gone;
  - **Picture Puzzle:** Grid (Auto, 4 × 4, 5 × 5, 6 × 6), Thumbnail (Auto, On, Off), Seconds per piece (1 to 6), Right-spot bonus (Auto, 0 to 5 s), Picture (Random, or any one photo);
  - **Thin Ice:** Grid (Auto, or 6 × 5 to 12 × 9), Holes per hiker (0 to 4), Timer (Auto, Off, or 60 to 300 s).
- **Same flow as the other games:** the pop-up in test mode, Start, the GPS turns and zooms, Line up where the game uses it, the game, the results.
- Test mode never touches the save.

## 6. Tests
- **Trail Map:**
  - every board can be solved, and none start solved;
  - locked tiles are in their correct direction;
  - lighting follows only openings that line up on both tiles;
  - it passes only when every trailhead and every sign are connected to the exit at the same moment;
  - every board with signs can be solved, with each sign on a solution trail.
- **Memory Puzzle:**
  - sets split evenly among hikers;
  - the same snack in two colors counts as two sets;
  - a match adds time and, from Tier II, a miss takes time away, once per try;
  - swaps never lose a card;
  - when time runs out, exactly the hikers with unmatched sets fail;
  - sets of 3 need all 3.
- **Picture Puzzle:**
  - pieces from both pictures share the piles;
  - only top pieces can be taken;
  - pieces can go back onto a pile;
  - a picture passes only when every piece is in its own spot;
  - the right-spot bonus is given once per piece, never twice;
  - Tier I clicks correct pieces into place and later tiers don't.
- **Thin Ice:**
  - the first tap is never a hole and opens a patch;
  - the numbers are right;
  - a 0 opens its neighbors;
  - flags block checking;
  - falling in takes out the front hiker only;
  - the hole count is base + 2 per hiker;
  - checking every safe cell wins.
- **Testing tab:** the list is grouped by category.
