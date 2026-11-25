# Update: November 25, 2026 (minigame changes after Wyatt's playtest)

**Builds on `UPDATE-2026-11-25-trail-blocks`** (step 1 of the new challenges), and on both of today's portrait updates. Finish those first. Keep everything else as it is.

Wyatt played the games and asked for these changes:
- **Five challenge tiers (I to V).** Tiers IV and V are harder versions of the Tier III challenges. See `15-challenge-tiers.md`, a new design file.
- **Dodge:**
  - **Levels:** animals now play at a level (Easy, 1, 2, 3). Each tier picks which animals show up, how often, and at what level.
  - **Overlaps:** no overlapping attacks below Tier V.
  - **Bees:** much easier at Tier I (one at a time).
  - **Squirrel Army:** a new Easy level (one acorn at a time).
  - **Woods Monster:** always at Level 3, from Tier III up.
  - **Portraits, round 3:** solid dark heads with no outline, like Sans in Undertale.
- **Trail Map:**
  - less time;
  - every trailhead must be connected at the same moment (the One at a time mode is gone);
  - trail signs to connect from Tier II.
- **Memory Puzzle:** no miss limit. It runs on a clock: a match adds time, and from Tier II a miss takes some away.
- **Picture Puzzle:**
  - a piece placed in its right spot adds time;
  - Wyatt's six photos, tinted into the GPS greens, replace the placeholder pictures.
- **Thin Ice:** great as is. It just gets Tiers IV and V.
- **Whackoon:** a new **Colors** mode (the default) with raccoons in hiker colors. Each hiker needs their own color, and done hikers' raccoons still pop up.
- **Trail Blocks and Sleeping Bear:** Tier IV and V numbers.

Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- **Design files** go in `docs/design/`:
  - `12-minigames-dodge.md`, `13-minigames-puzzles-2.md` and `14-minigames-trail-blocks.md` replace the files with those names;
  - `15-challenge-tiers.md` is new.
- **Art** goes in the game's minigame asset folder:
  - `art/dodge/portraits/solid/` and `solid-red/`, next to the other portrait folders;
  - `art/picture-puzzle/picture-*.png`;
  - `art/trail-map/trail-sign*.png`;
  - `art/whackoon/raccoon-*-mask.png`.
- **Mockups:** `mockups/dodge/*`, `mockups/puzzles-2/*` and `mockups/trail-blocks/*` go in `docs/mockups/minigames/dodge/`, `puzzles-2/` and `trail-blocks/`.
- **Delete when nothing uses them:**
  - `portraits/mono/` and `portraits/red/` (round 2), and the round-2 mockups `17-in-game-*-mono.png` and `17-in-game-*-red.png`;
  - the old placeholder pictures `picture-bear`, `picture-peaks`, `picture-oak` and `picture-camp`.
- Then delete the leftover `update-2026-11-25-minigame-changes/` folder.

---

## 1. Tiers I to V (`15-challenge-tiers.md`)
- **Everywhere a tier appears:** support Tiers IV and V, including the labels and the testing tab.
- **Games with their own IV and V numbers:** Dodge, Trail Map, Memory, Picture Puzzle, Thin Ice, Trail Blocks, Sleeping Bear and Whackoon. Use their design files.
- **Every other game:** use the fallback rule, and write the results into `balance.ts`.

## 2. Dodge (`12-minigames-dodge.md`)
- **Section 4 (rewritten):**
  - levels Easy, 1, 2 and 3. The old Tier I, II and III numbers in the attack sections are now Levels 1, 2 and 3;
  - the table of which animal shows up at which tier and level;
  - the weights for picking an animal;
  - numbers by tier and by level.
- **Overlaps:** only at Tier V. Below it, one attack at a time. The Overlaps setting's Auto now means "on at Tier V only".
- **Bees:** new patterns by level (section 5). On Easy they come one at a time, aimed at the sprite; full rows only at Level 3.
- **Squirrel Army:** a new Easy level (sections 6 and 10):
  - one acorn at a time, breaking on the 2nd wall hit;
  - one still bomb with a longer fuse and smaller blast;
  - 2–3 pinecone columns;
  - no Wall scurry.
- **Woods Monster:**
  - shows up from Tier III and always plays Level 3;
  - at Tier V he overlaps attacks and gets his boss boost;
  - his second half always happens.
- **Portraits:**
  - swap to the `solid` and `solid-red` folders. The file names are the same as before;
  - the Portrait style setting and the P key switch between Solid (default) and Solid + red;
  - blink and bob stay as they are.
- **Testing tab:** Tier I to V, and a new **Level** setting (Auto, Easy, 1, 2, 3).

## 3. Trail Map, Memory Puzzle, Picture Puzzle, Thin Ice (`13-minigames-puzzles-2.md`)
- **Trail Map:**
  - new times;
  - pass only when every trailhead and every sign are connected at the same moment. Remove the Mode setting;
  - trail signs from Tier II, placed on the first hiker's solution trail.
- **Memory Puzzle:**
  - remove the miss limit and the Misses setting;
  - a clock on every tier, where a match adds time and a miss takes time away from Tier II;
  - new settings for the time, the match bonus and the miss cost.
- **Picture Puzzle:**
  - the time bonus the first time each piece lands in its own spot;
  - the six new photos;
  - a 6 × 6 grid on Tier V;
  - a Picture setting to pick a photo for testing.
- **Thin Ice:** add Tiers IV and V.

## 4. Whackoon, Trail Blocks, Sleeping Bear (`14-minigames-trail-blocks.md`)
- **Whackoon:**
  - a **Mode** setting: Colors (default) or Turns;
  - Colors uses one shared clock and the tinted raccoon masks;
  - each hiker needs whacks on their own color;
  - whacking a done hiker's raccoon does nothing and costs a [0.5 s] pause.
- **Trail Blocks and Sleeping Bear:** add the Tier IV and V columns. When everyone fails, they lose [2] energy at Tiers III to V.

## 5. Tests
Follow the updated test lists in each design file. Also:
- every game accepts Tiers IV and V;
- below Tier V, Dodge never overlaps attacks.

## When you're done
Send Wyatt a short summary with:
- what changed;
- the fallback Tier IV and V values you wrote for the older games;
- how tiers are given out in runs now (if they are);
- which settings to try first.
