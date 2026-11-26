# Update: November 25, 2026 (new challenges, step 3: Trail Blazes, Firefly Catch, Size Up, Safari, Fly Swatter, Raccoon Shuffle)

**Builds on `UPDATE-2026-11-25-end-screens-lanes-fixes`.** Finish that first. Keep everything else as it is.

What's in it: six short games (`18-minigames-quick.md`, new).
1. **Trail Blazes:** two trunks scroll past each other. Tap when the two lit blazes are level.
2. **Firefly Catch:** a firefly bounces around a night meadow. Tap when it's inside your jar ring.
3. **Size Up:** grow or shrink a find on the trail to match the field guide's drawing.
4. **Safari:** watch animals come down a hillside, then answer a question as a team. With 3 or more hikers there's a second question. At night, the players aim the flashlight with the mouse.
5. **Fly Swatter:** circles pop up where flies are about to land. Tap each one before it shrinks away.
6. **Raccoon Shuffle (challenge version):** watch which trash bins hold raccoons, follow the shuffle, and pick an empty bin.

None of them is a passing challenge: each hiker passes or fails on their own. Hikers who fail lose [1] energy, except in Raccoon Shuffle, where the raccoon steals an item instead. All six end on the Challenge Passed / Challenge Failed screen.

Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `18-minigames-quick.md` → `docs/design/` (new).
- `art/trail-blazes/`, `art/firefly-catch/`, `art/size-up/`, `art/safari/`, `art/fly-swatter/` and `art/raccoon-shuffle/` → the minigame asset folder (all new).
- Raccoon Shuffle also reuses `art/whackoon/can.png`, `can-open.png` and `raccoon-up.png`, which are already there.
- `mockups/quick-games/` → `docs/mockups/minigames/quick-games/` (new).
- In `docs/design/15-challenge-tiers.md`, under "Games with their own Tier IV and V numbers", add: "**Trail Blazes, Firefly Catch, Size Up, Safari, Fly Swatter, Raccoon Shuffle** (`18-minigames-quick.md`)."
- Then delete the leftover `update-2026-11-25-quick-games/` folder.

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

## 2. Firefly Catch (section 2)
- **Reaction and timing,** any tile, one hiker at a time.
- **Play:**
  - [3] catches in [15 s];
  - a catch is when the firefly's center is inside the ring;
  - the ring drifts at every tier, faster at higher ones;
  - misses cost [1 s] from Tier II;
  - the firefly blinks dark from Tier III, but it can still be caught.

## 3. Size Up (section 3)
- **Reaction and timing,** any tile, one hiker at a time, one try each.
- **Play:**
  - tap the top half of the right panel to grow and the bottom half to shrink. Holding repeats;
  - lock in with Space, Enter or the button, or when time runs out;
  - the reveal shows the hiker's outline over the drawing, with the % off.
- **Scaling:** use nearest-neighbor at screen resolution, so small steps still show.

## 4. Safari (section 4)
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

## 5. Fly Swatter (section 5)
- **Reaction and timing,** any tile, one hiker at a time.
- **Play:**
  - a circle pops up at a random spot on the picnic blanket and shrinks;
  - a fly heads for its middle and lands as it disappears;
  - tap inside the circle before then to swat it;
  - a landed fly is a strike, and so is a stray tap from Tier III;
  - from Tier III, some circles are bee circles: leave those alone, since tapping one is a sting and a strike;
  - [3] strikes and the hiker fails.

## 6. Raccoon Shuffle (section 6)
- **Guess and luck,** Wildlife tiles, one hiker at a time, each with their own fill and shuffle.
- **Play:**
  - the bins open: raccoons hold up cards showing what they'd steal from this hiker (from their own inventory), and the empty bins say EMPTY;
  - the lids close and the bins swap places;
  - the hiker picks one: empty passes with no cost, and a raccoon steals the item on its card.
- **Night** (Tiers IV and V): dark except a circle of light around the mouse, the whole round long.

## 7. Testing tab
- Trail Blazes, Firefly Catch, Size Up and Fly Swatter go under **Reaction and timing**, Safari under **Memory**, and Raccoon Shuffle under **Guess and luck**.
- Settings are in section 8 of the design file, including three tuning helpers:
  - **Show % live** (Size Up);
  - **Show answer** (Safari);
  - **Show the empty bins** (Raccoon Shuffle).

## 8. Tests
Follow section 9 of the design file.

## When you're done
Send Wyatt a short summary with:
- what was built;
- anything you had to interpret;
- how Safari plans a run and picks its questions;
- how Raccoon Shuffle picks what the raccoons would steal;
- which settings to try first.
