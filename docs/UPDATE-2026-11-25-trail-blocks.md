# Update: November 25, 2026 (new challenges, step 1: Trail Blocks, Sleeping Bear, Whackoon)

**Builds on the earlier minigame updates,** including the testing tab's categories from `UPDATE-2026-11-25-puzzle-games`. Finish those first if they aren't done. Keep everything already built.

Wyatt added a big set of new challenges, which ship in four steps. This is step 1:
- **Passing challenges:** a new rule for challenges that stand between the party and a tile.
  - Hikers who pass move on; hikers who fail go back and pay.
  - If nobody passes, the challenge stays on the tile, revealed.
- **Trail Blocks:** four first-person versions of one timing game, one per tile type, sharing an energy bar made of each hiker's chunk:
  - **Chop Tree:** green ends on a sliding bar;
  - **Mine Rockslide:** hold, then release in a green zone;
  - **River Flood:** hit the green spots;
  - **Clearing Animals:** a shrinking circle and a ring.
- **Sleeping Bear:** red light, green light past a sleeping bear, one hiker at a time, with fake-outs at higher tiers.
- **Whackoon:** whack-a-mole with raccoons in trash cans, and skunks as decoys.

The full design is in `14-minigames-trail-blocks.md`. Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `14-minigames-trail-blocks.md` → `docs/design/14-minigames-trail-blocks.md`.
- `mockups/*` → `docs/mockups/minigames/trail-blocks/`.
- `art/trail-blocks/`, `art/sleeping-bear/`, `art/whackoon/` → the game's minigame asset folder, next to the others.
- Then delete the leftover `update-2026-11-25-trail-blocks/` folder.

---

## 1. Passing challenges (design section 1)
- **The result** lists who passes, who goes back and what each pays, and whether the challenge stays on the tile.
- **If challenges already run from tiles,** apply the rules there:
  - passers move onto the tile;
  - the rest go back;
  - a challenge nobody passed stays, revealed.
- **If they don't yet,** return the result and show it on the results screen. Test mode never touches the save.

## 2. Trail Blocks (design section 2)
- **One game, four versions:** build a shared engine for the first-person scene, the energy bar, the work bar and the swing results. Each version brings its own timing control and art.
- **Energy chunks:** spent in line order. When a chunk empties, that hiker is out and the next one's sleeve takes over.
- **Sleeves:** tint the `-sleeve.png` layers with the active hiker's color, using the rule in the design.

## 3. Sleeping Bear (design section 3)
- **Moving:** hold Space, the mouse button or a finger to walk.
- **The bear:** sleeps, stirs, wakes, then sleeps again, with fake-outs at Tiers II and III.
- **The clock:** one shared clock, with time added per hiker.

## 4. Whackoon (design section 4)
- **Turns:** [10 s] each, with a team target.
- **Skunks:** whacking one costs time and fogs the screen.

## 5. Testing tab (design section 5)
Add the three games under Reaction and timing, with their settings.

## 6. Tests
See design section 6.

## When you're done
Send Wyatt a short summary with:
- what was built;
- anything you had to interpret, especially how passing challenges hook into the board;
- where each game is in the testing tab and which settings to try first.
