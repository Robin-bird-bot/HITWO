# Update: November 25, 2026 (new challenges, step 3: ten new games, plus axe, whistle and mallet fixes)

**Builds on `UPDATE-2026-11-25-end-screens-lanes-fixes`.** Finish that first. Keep everything else as it is.

What's in it:
- **Fixes to step-1 games** (`14-minigames-trail-blocks.md`, "third pass"): the axe chops on its own side and passes behind the back, the whistle leans toward the ring, and Whackoon gets Wyatt's mallet. See section 0.
- **Six short games** (`18-minigames-quick.md`, new), sections 1 to 6.
- **Four more games** (`19-minigames-signs-trails.md`, new): Fake Trail Signs, Trails, Crossroads and Rock Climb. See section 7.

The six short games:
1. **Trail Blazes:** two trunks scroll past each other. Tap when the two lit blazes are level.
2. **Firefly Catch:** a firefly bounces around a night meadow. Tap when it's inside your jar ring.
3. **Size Up:** grow or shrink a find on the trail to match the field guide's drawing.
4. **Safari:** watch animals come down a hillside, then answer a question as a team. With 3 or more hikers there's a second question. At night, the players aim the flashlight with the mouse.
5. **Fly Swatter:** circles pop up where flies are about to land. Tap each one before it shrinks away.
6. **Raccoon Shuffle (challenge version):** watch which trash bins hold raccoons, follow the shuffle, and pick an empty bin.

None of the six is a passing challenge: each hiker passes or fails on their own. Hikers who fail lose [1] energy, except in Raccoon Shuffle, where the raccoon steals an item instead. Trails and Rock Climb (in `19`) are passing challenges. All ten end on the Challenge Passed / Challenge Failed screen.

Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- **Design files** go in `docs/design/`:
  - `14-minigames-trail-blocks.md` replaces the old one;
  - `18-minigames-quick.md` and `19-minigames-signs-trails.md` are new.
- **Trail Block art** (`art/trail-blocks/`):
  - **New:** `axe-raise`, `axe-chop-1`, `axe-chop-2`, `whistle-rest` and `whistle-lean-105`, `-125`, `-145`, `-165`;
  - **Replaced:** `axe-ready`;
  - **Delete** once nothing uses them: `axe-raised`, `axe-strike`, `whistle-hold`, `whistle-blow`.
- **Whackoon art** (`art/whackoon/`): `mallet-ready.png` and `mallet-whack.png` replace the old ones, and `CREDITS.md` is new.
- **New game art:** `art/trail-blazes/`, `art/firefly-catch/`, `art/size-up/`, `art/safari/`, `art/fly-swatter/`, `art/raccoon-shuffle/`, `art/fake-signs/`, `art/trails/`, `art/crossroads/` and `art/rock-climb/` go in the minigame asset folder.
- **Reused art:**
  - Raccoon Shuffle uses `art/whackoon/can.png`, `can-open.png` and `raccoon-up.png`;
  - Fake Trail Signs uses `art/trail-blocks/bg-trail.png`.
- **Mockups:**
  - `mockups/quick-games/` → `docs/mockups/minigames/quick-games/` (new);
  - `mockups/signs-trails/` → `docs/mockups/minigames/signs-trails/` (new);
  - `mockups/trail-blocks/*` → `docs/mockups/minigames/trail-blocks/` (adds the axe and whistle GIFs and the mallet mockup).
- **In `docs/design/15-challenge-tiers.md`,** under "Games with their own Tier IV and V numbers", add:
  - "**Trail Blazes, Firefly Catch, Size Up, Safari, Fly Swatter, Raccoon Shuffle** (`18-minigames-quick.md`).";
  - "**Fake Trail Signs, Trails, Crossroads, Rock Climb** (`19-minigames-signs-trails.md`)."
- Then delete the leftover `update-2026-11-25-quick-games/` folder.

---

## 0. Fixes to the step-1 games (`14-minigames-trail-blocks.md`, "Revised November 25, third pass")
- **Chop Tree's axe** (bug: the chop always played on the right):
  - draw every axe frame on the side the axe is on; the left side uses the mirrored frames at (0, 72);
  - the axe is on the side the marker is on. When the marker turns at an edge, the axe slides down out of view, then slides up on the other side as the marker crosses the middle. Each slide takes [0.2 s], or [20%] of the pass if that's shorter;
  - the chop turns around the end of the handle, which stays put: `axe-ready` → `axe-raise` → `axe-chop-1` → `axe-chop-2` → `axe-ready`;
  - see `trail-blocks/chop-tree-axe.gif`.
- **Clearing Animals' whistle:**
  - new 160 × 160 frames at (172, 44): `whistle-rest` sits further in and turned up;
  - on a hit, use the `whistle-lean-<n>` frame closest to the ring's direction, move it [6] units toward the ring, and send the waves at the ring;
  - a whiff just shakes it;
  - see `trail-blocks/clear-animals-whistle.gif`.
- **Whackoon's mallet:** Wyatt's hammer, recolored, 35 × 37 at the cans' scale. It swings to `mallet-whack` on a click.

---

## 1. Trail Blazes (`18-minigames-quick.md`, section 1)
- **Reaction and timing,** any tile, one hiker at a time.
- **Play:**
  - the left trunk scrolls up and the right one down;
  - tap when the lit pair is level (within the tier's distance);
  - a match draws a line in the hiker's color, and the next pair lights up;
  - a miss is a tap when they're not level, or letting them pass.
- **Mode setting:** Tries ([3] misses) is the default. Clock mode makes misses cost [2 s].
- **From Tier III,** the trunks' speeds change every pair.

## 2. Firefly Catch (`18`, section 2)
- **Reaction and timing,** any tile, one hiker at a time.
- **Play:**
  - [3] catches in [15 s];
  - a catch is when the firefly's center is inside the ring;
  - the ring drifts at every tier, faster at higher ones;
  - misses cost [1 s] from Tier II;
  - the firefly blinks dark from Tier III, but it can still be caught.

## 3. Size Up (`18`, section 3)
- **Reaction and timing,** any tile, one hiker at a time, one try each.
- **Play:**
  - tap the top half of the right panel to grow and the bottom half to shrink. Holding repeats;
  - lock in with Space, Enter or the button, or when time runs out;
  - the reveal shows the hiker's outline over the drawing, with the % off.
- **Scaling:** use nearest-neighbor at screen resolution, so small steps still show.

## 4. Safari (`18`, section 4)
- **Memory,** Wildlife tiles, the whole party at once.
- **Watching:**
  - animals walk down toward the party: they stop, travel in herds, turn back and hide in bushes, by tier;
  - each kind has its own speed, with a clear fastest and slowest;
  - birds zigzag across;
  - night from Tier III, and fog from Tier IV.
- **Night:** the flashlight cone comes up from the bottom middle and points straight at the mouse (or the finger on phones; Left and Right on keys).
- **The question:**
  - the front hiker guesses first;
  - a wrong guess fails only that hiker, and their sign is crossed out;
  - a right guess passes that hiker and everyone after them.
- **With 3 or more hikers, there are two questions, as a relay:** a right guess on question 1 passes only that hiker, and everyone after them answers question 2 under the same rules.
- **Plan each run first,** then pick the questions the run fits, and keep a log so the tests can check answers.
- **Bigfoot:** rare from Tier III. When he shows up, question 1 is always about him.

## 5. Fly Swatter (`18`, section 5)
- **Reaction and timing,** any tile, one hiker at a time.
- **Play:**
  - a circle pops up at a random spot on the picnic blanket and shrinks;
  - a fly heads for its middle and lands as it disappears;
  - tap inside the circle before then to swat it;
  - a landed fly is a strike, and so is a stray tap from Tier III;
  - from Tier III, some circles are bee circles: leave those alone, since tapping one is a sting and a strike;
  - [3] strikes and the hiker fails.

## 6. Raccoon Shuffle (`18`, section 6)
- **Guess and luck,** Wildlife tiles, one hiker at a time, each with their own fill and shuffle.
- **Play:**
  - the bins open: raccoons hold up cards showing what they'd steal from this hiker (from their own inventory), and the empty bins say EMPTY;
  - the lids close and the bins swap places;
  - the hiker picks one: empty passes with no cost, and a raccoon steals the item on its card.
- **Night** (Tiers IV and V): dark except a circle of light around the mouse, the whole round long.

## 7. Fake Trail Signs, Trails, Crossroads, Rock Climb (`19-minigames-signs-trails.md`)
- **Fake Trail Signs** (Puzzle and logic, any tile):
  - a rules screen in EditUndo with I UNDERSTAND, then signs judged REAL or FAKE;
  - each hiker's round adds a rule, up to the tier's cap, with at least the tier's minimum;
  - a wrong answer fails the hiker, and the next one repeats the same rules with new signs;
  - Tiers IV and V hide the old rules but still check them;
  - **build a rule generator** from the condition and requirement lists in section 1, and plan each round's signs from the rules.
- **Trails** (Movement and dodging, passing, common):
  - keep the icon on a trail scrolling down: Forest Path, Switchbacks, Ridgeline or Riverbank;
  - off the trail drains the hiker's bar;
  - one checkpoint per hiker;
  - a fail hands over from that spot, and hikers who passed come back with their leftover bars to finish the end.
- **Crossroads** (Memory; Wyatt's "Trailmap", renamed so it isn't confused with Trail Map):
  - remember a row of arrows, then walk them through 4-way crossings;
  - a wrong turn fails the hiker and shows their right steps in their color;
  - the next hiker sees the arrows again.
- **Rock Climb** (Movement and dodging, passing, Mountain):
  - aim, hold for power, jump, and grab a hold of the active hand's color;
  - the color sequence gives each hiker equal turns;
  - a fall fails that hand's hiker once;
  - **5 or 6 hikers isn't handled** (Wyatt): leave a `TODO(wyatt)` and a testing-tab note.

## 8. Testing tab
- **Reaction and timing:** Trail Blazes, Firefly Catch, Size Up, Fly Swatter.
- **Memory:** Safari, Crossroads.
- **Guess and luck:** Raccoon Shuffle.
- **Puzzle and logic:** Fake Trail Signs.
- **Movement and dodging:** Trails, Rock Climb.
- Settings are in each design file (`18`, section 8; `19`, section 6), including these tuning helpers:
  - **Show % live** (Size Up);
  - **Show answer** (Safari);
  - **Show the empty bins** (Raccoon Shuffle);
  - **Show answers** (Fake Trail Signs).

## 9. Tests
Follow `18`, section 9, and `19`, section 7. Also check the axe, whistle and Whackoon tests in `14`.

## When you're done
Send Wyatt a short summary with:
- what was built;
- anything you had to interpret;
- how Safari plans a run and picks its questions;
- how Raccoon Shuffle picks what the raccoons would steal;
- how the Fake Trail Signs rule generator works, with a few example rules per tier;
- which settings to try first.
