# Update: November 24, 2026 (fixes and changes after testing the four minigames)

Wyatt tested Traildle, Find the Object, Remember the Path and Find the Path, and liked them. This update fixes three bugs and makes a few changes. **Don't build Dodge yet:** Wyatt is holding that update until these games are tested.

The revised `11-minigames-puzzles.md` replaces the old one. The note at its top lists what changed. Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `11-minigames-puzzles.md` → `docs/design/11-minigames-puzzles.md`, replacing the old one.
- `mockups/*` → `docs/mockups/minigames/puzzles/`, next to the first nine.
- Then delete the leftover `update-2026-11-24-minigame-fixes/` folder.

---

## Bugs

1. **Traildle: signs spill out of the boards** (design section 2, "Fitting everything on screen").
   - Size the small signs and the rows from the space in each board.
   - If rows would get shorter than [9] units, keep them at 9 and let the board scroll. The newest guess always shows, and a "▲ N MORE" label appears when rows are hidden.
   - Shrink the big signs too, so 7 or 8 fit across. Check the worst case: 8 signs, two codes, 9 guesses (`mockups/10-traildle-fit.png`).
2. **Find the Object: the wrong slot gets checked** (section 3, Rules). A found snack must check a slot showing that same snack. Example: targets grapes, grapes, apple. Finding the apple first checks the apple slot, not a grape.
3. **Find the Path: a trail that can't be finished** (section 5, "Which tile is right"). Wyatt's hiker reached the end of the known trail with trees on every side, so a right tile had been marked wrong.
   - Decide "right" only by looking up the trail tile after the hiker's current tile. Never use a separate step counter.
   - Make lucky reveals, fog and hiding all read that same trail.
   - Reaching the top row always passes the hiker.
   - Add the 1,000-game simulation test from section 6.

## Changes

4. **Find the Object** (section 3):
   - **Rounds:** [3] by default (setting: 1 to 5). Round 1 asks for one target per hiker still in, and each later round [+1] more. Each round opens with a card (`mockups/12-find-object-round-card.png`).
   - **Losing hikers:** each target still unfound when time runs out puts one hiker out, from the back of the line, for the rest of the game. The line shows who's at risk right now.
   - **New mode, Dark + windy:** the flashlight and the drifting together. It's now the Tier III default (`mockups/11-find-object-dark-windy.png`).
   - **A shorter timer:** [3 s] + [3 s] per target. New settings: **Seconds per target** (1 to 8) and **Extra seconds per round** (0 to 20).
   - The testing tab's Mode list adds Dark + windy, and there's a **Rounds** setting.
5. **Remember the Path** (section 4):
   - **The ranger** appears below the grid's middle, walks under the grid to his column, then steps in (`mockups/13-remember-path-ranger-enters.png`). No start tile is marked anymore.
   - **Each hiker** also starts below the middle (`mockups/14-remember-path-start-below.png`). Their first step is into a bottom-row tile, and a wrong one is a strike.
   - **Keyboard:** ← → slide the token along under the grid, and ↑ steps in.
6. **Find the Path** (section 5, "Running out of tries"):
   - **Hide the trail on a run-out:** whenever a hiker runs out of tries, fog or no fog, the trail hides again: its tiles, its line, and trail tiles from lucky reveals. The next hiker starts at the trailhead (`mockups/15-find-path-hidden-after-run-out.png`).
   - **Trees stay visible** by default. A new setting, **Hide after a run-out** (Trail only, or Everything), can hide them too.
   - **Hidden trail tiles** still count as right when picked again, and cost nothing.
   - **Reaching the top:** the trail stays, and the hikers behind walk it and pass, as before.

## Tests
Add the new cases in design section 6. Re-run the old ones.

## When you're done
Send Wyatt a short summary with:
- what was fixed and changed;
- what caused the Find the Path bug;
- anything you had to interpret.
