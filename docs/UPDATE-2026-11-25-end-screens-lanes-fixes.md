# Update: November 25, 2026 (end screens, Dodge portrait motion, step-1 fixes, challenge tiers by biome, and three new games)

**Builds on `UPDATE-2026-11-25-minigame-changes`.** Finish that first. Keep everything else as it is.

What's in it:
1. **Challenge Passed / Challenge Failed:** a classic end screen for every minigame (`16-challenge-end-screen.md`, new).
   - **Failing:** red drips run down the screen.
   - **Passing:** a Star Wars-style clock wipe.
   - **Then:** a dark green screen with a big flashing title and each hiker's result.
2. **Dodge:**
   - **Portraits:** Wyatt picked Solid + red, so remove the style setting and the P key. The bee and the Woods Monster float smoothly, the others do an old-school idle bob, and all of them blink.
   - **Woods Monster:** two new attacks from his portrait. **Long arms** wind up beside him, then thrust down at the sprite. **Glare** fires two sweeping beams from his own eyes.
3. **The step-1 games, after Wyatt's playtest** (`14-minigames-trail-blocks.md`):
   - every Trail Block marker freezes for [1 s] where you stopped it;
   - Chop Tree gets a random speed on every pass, and the axe switches to the side the marker is heading;
   - River Flood gets bigger spots;
   - Clearing Animals gets a solid circle under the ring, in a new spot each time;
   - **new art:** Wyatt's own reference sprites (axe, pickaxe, bucket, whistle, pine tree, rock pile), recolored into the GPS greens. There's no arm: the tool swings by itself with a light wash of the active hiker's color. Also ribbed cans and a mallet for Whackoon;
   - **Sleeping Bear bugs:** the clock jumped around and the game seemed impossible. Now the clock runs smoothly, stops while the bear is awake, and moving during a stir earns time back;
   - **Whackoon:** the logic is already fixed (colors, everyone at once), so only the art changes.
4. **Which tier a challenge gets** (`15-challenge-tiers.md`): Biome 1 is mostly Tier I, Biome 2 mostly II, and Biome 3 mostly III, each with some of the next tier. Nightmare climbs from III to V. Hard, Random tiers and Boss Rush are noted for later.
5. **New challenges, step 2** (`17-minigames-lanes.md`, new):
   - **Crossing:** Road, River and Critter as one Frogger-style game, mixing road and river from Tier III;
   - **Train!:** hop between tracks, with fog at Tiers IV and V;
   - **Rafting:** the party's raft heads upriver to the dock.

Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- **Design files** go in `docs/design/`:
  - `12-minigames-dodge.md`, `14-minigames-trail-blocks.md` and `15-challenge-tiers.md` replace the old ones;
  - `16-challenge-end-screen.md` and `17-minigames-lanes.md` are new.
- **Dodge art:**
  - `art/dodge/portraits/solid-red/` replaces that folder, and now includes the `-bob` frames;
  - `art/dodge/monster-hand*.png` are new;
  - delete `portraits/solid/` and `eye.png` once nothing uses them.
- **Trail Block art** (`art/trail-blocks/`):
  - **Replaced:**
    - the tool frames (`axe-*`, `pickaxe-*`, `bucket-*`, `whistle-*`);
    - `tree-0` to `tree-4` and `rocks-0` to `rocks-4`;
    - `rock-chips.png` and `splash.png`.
  - **New:** `tool-*.png`, `tree-stump.png` and `CREDITS.md`.
  - **Delete:** the `-sleeve.png` layers and `tree-cleared.png`.
- **Whackoon art** (`art/whackoon/`):
  - `can.png` and `can-open.png` are replaced;
  - `mallet-ready.png` and `mallet-whack.png` are new;
  - delete `pan-ready.png` and `pan-whack.png`.
- **New game art:** `art/crossing/`, `art/train/` and `art/rafting/` go in the minigame asset folder.
- **Mockups:** `mockups/<folder>/*` → `docs/mockups/minigames/<folder>/`, for `dodge`, `end-screens`, `lanes` and `trail-blocks`.
  - Files with the same names replace the old ones.
  - Delete `trail-blocks/7-whackoon-colors.png`.
- Then delete the leftover `update-2026-11-25-end-screens-lanes-fixes/` folder.

---

## 1. End screen (`16-challenge-end-screen.md`)
- **Build it once:** as a shared part of the minigame framework. Every game hands it the result.
- **The title:** PASSED when at least one hiker passed, FAILED when nobody did. It's big EditUndo text, flashing for [2.5 s].
- **The transitions:**
  - failing: red drips that cover the screen, then the end screen wipes in from the top, leaving short drips hanging;
  - passing: a clockwise clock wipe with a thin light edge.
- **One row per hiker:** their result and what they pay.
- **Passing challenges** also get a line about the tile ("THE WAY IS CLEAR").
- **Continuing:** "TAP TO CONTINUE" takes input after [0.8 s].
- **Reduced motion:** a crossfade instead.
- **See:** `end-screens/challenge-failed.gif` and `challenge-passed.gif`.

## 2. Dodge (`12-minigames-dodge.md`, sections 3 and 12)
- **Portraits:**
  - use only `solid-red`, and remove the Portrait style setting and the P key;
  - **flying** (bee, Woods Monster): a smooth float, drawn at whole units;
  - **idle bob** (the rest, cultists included): swap `<name>` and `<name>-bob` every [0.4 s], with the matching blink frames;
  - the Portrait motion setting turns all of it off;
  - see `dodge/20-portrait-motion.gif`.
- **Glare** (replaces The Eye):
  - his eyes flash red;
  - two cones from his eyes sweep across the box in opposite directions;
  - outside the box, only their red edges are drawn.
- **Long arms:**
  - jointed arms, [4] units thick, dark outside the box and light inside it, with hand sprites turned toward the reach;
  - a [0.7 s] wind-up with a dotted aim line and a "!";
  - a [0.2 s] thrust, a [0.3 s] grab, and a [0.4 s] pull back;
  - [4] thrusts, alternating arms.

## 3. The step-1 games (`14-minigames-trail-blocks.md`, "Revised November 25, after Wyatt played step 1")
- **Every Trail Block:** the marker freeze ([1 s], with a light frame; input waits).
- **The tools:**
  - draw each frame, then wash the whole tool with the active hiker's color at [30%], only on its own pixels;
  - there's no arm and no tint layer;
  - starting positions are in design section 2, "The screen".
- **Chop Tree:**
  - a random pass time from the tier's range on every pass;
  - the axe frames are mirrored to the left while the marker heads left;
  - the pine is notched on both sides, tips over when cleared, and leaves `tree-stump.png`.
- **River Flood:** bigger spots ([15%] on Tier I).
- **Clearing Animals:**
  - a solid dark circle under the ring;
  - a random spot for every try, inside x [50–270] and y [44–150], never over the tool or the HUD.
- **Sleeping Bear:**
  - the clock is smooth (subtract the frame's elapsed time every frame);
  - it's paused while the bear is awake, and counts up while the hiker moves during a stir;
  - walk speed is [55], with [10 s] per hiker on Tier I;
  - add a test proving it's beatable on every tier.
- **Whackoon:**
  - the logic is already fixed, so don't redo it;
  - swap in the new cans and the mallet cursor;
  - check that the numbers in the design table match `balance.ts`.

## 4. Tiers in runs (`15-challenge-tiers.md`, "Which tier a challenge gets")
- **Normal:** each challenge rolls its tier from its biome's table when it's placed.
- **Nightmare:** if it already exists, use its table.
- **Later:** keep Hard, Random tiers and Boss Rush as tables in `balance.ts`.

## 5. Crossing, Train!, Rafting (`17-minigames-lanes.md`)
- **All three:** passing challenges that end on the new end screen. Add them to the testing tab under Movement and dodging.
- **Crossing:**
  - Road, River, Critter and Mixed versions;
  - one hiker at a time;
  - a hit costs a life and sends the hiker back to the start and the back of the line.
- **Train!:** the Dodge party sprite and lives. Trains are warned with a headlight flash, and fog covers the far side at Tiers IV and V.
- **Rafting:** a shared raft, one life per hiker. Rapids speed up the rest of the run, and reaching the dock wins.

## 6. Tests
Follow the test sections in each design file. Also:
- each biome's tiers come out close to its table over many rolls.

## When you're done
Send Wyatt a short summary with:
- what was built;
- anything you had to interpret;
- what was making the Sleeping Bear clock jump;
- how tiers are handed out now;
- which settings to try first.
