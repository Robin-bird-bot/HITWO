# Update: November 26, 2026 (the challenge pop-up, version 2; Bear with a Gun and Ants; Camp Cleanup; fixes)

**Builds on `UPDATE-2026-11-25-quick-games`** (all of it, including its section 0 fixes and the four games in `19-minigames-signs-trails.md`). Finish that first. Keep everything else as it is.

What's in it:
1. **The challenge pop-up, version 2** (`20-challenge-popup.md`, new):
   - big How to play text and Controls on the left;
   - a bot playing a demo of the real game in the GPS;
   - bars for the numbers that matter;
   - per-hiker lives;
   - Prepare slots that hikers fill with resources and items, through a Zelda-style pop-up inventory.
2. **Raccoon Shuffle fixes** (`18-minigames-quick.md`, section 6, "Revised November 26"):
   - much harder;
   - the card icons are new green pixel icons, centered in the card.
3. **New Dodge animals, Camp Cleanup and two fixes** (`21-minigames-dodge-camp.md`, new):
   - **Bearrels goes away;** its bear moves into Dodge as **Bear with a Gun**: Aimed Shot, Snipe (2 damage and a hole you can't walk on), Bear Traps, Rapid Fire, plus two ideas of mine;
   - **Ants** join Dodge: Marching Lines (like snake), Ant Mill, Fire Ants (one safe ant), Ant Hill, plus two ideas of mine;
   - **Camp Cleanup** replaces the planned snake game: the party is one snake on a grid, picking up trash in their colors;
   - **Ridgeline** gets its own hazards: drops on both sides that drain 2× fast, knife edges, scree and wind gusts;
   - **Rock Climb bug:** grabs never worked in practice. Grabs now queue and happen when the hand passes in reach, with a floatier jump.

**The reference for the pop-up is a working prototype:** `mockups/challenge-popup/prototype.html`. Open it in a browser, hover and click the slots, and match how it looks and behaves. The Dodge (Bees) example in it is complete, including the demo bot.

Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`. The Prepare options for each game (`20`, section 7) are all first guesses.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `20-challenge-popup.md` and `21-minigames-dodge-camp.md` → `docs/design/` (new).
- `18-minigames-quick.md` → `docs/design/` (replaces it).
- In `docs/design/10-minigames.md`, section 1 ("The challenge pop-up"), add at the top: "**Replaced by `20-challenge-popup.md` (November 26).**"
- `art/resources-green/` → the asset folder next to `resources/` (new: 16 resources plus `energy`, 12 × 12 each).
- `mockups/challenge-popup/` → `docs/mockups/minigames/challenge-popup/` (new: the prototype and screenshots).
- `mockups/dodge-new/` → `docs/mockups/minigames/dodge-new/` (new).
- **Art for `21`:**
  - `art/dodge/portraits/solid-red/` (new `bear-gun*` and `ant*` files) and `art/dodge/bear-gun/`, `art/dodge/ants/` → into the Dodge art folder;
  - `art/camp-cleanup/` → the minigame asset folder (new);
  - `art/trails/` (new Ridgeline pieces) → into the Trails art folder.
- **In `docs/design/12-minigames-dodge.md`,** section 4: add the Ants and Bear with a Gun rows from `21`, section 3.
- **In `docs/design/10-minigames.md`,** section 4 (Bearrels): add "**Removed November 26.**" at the top.
- **Delete `art/bearrels/`** and Bearrels' code and tests once nothing uses them (`21`, section 0).
- Then delete the leftover `update-2026-11-26-challenge-popup/` folder.

---

## 1. The pop-up (`20`, sections 1 to 4)
- **The layout:**
  - **left:** a small poster with the flavor line and chips, then HOW TO PLAY (the biggest text), then CONTROLS with keycap, mouse and finger pictures;
  - **middle:** the GPS with the demo;
  - **right:** IF YOU FAIL, the bars, per-hiker rows (lives), PREPARE and START.
- **Bars:**
  - segmented, in the pop-up's ink;
  - changes from Prepare show in green, hatched when a value goes down and filled when it goes up, with "−1" or "+1".
- **Prepare:**
  - one row per effect, each with its slots, and per-hiker effects as a slot in that hiker's row;
  - an empty slot shows a faded ghost of what it takes, cycling through the choices, with "×2" when it needs more than one;
  - its outline is split into the colors of every hiker who can fill it right now.
- **The pop-up inventory:**
  - hover to look, click the slot to pick;
  - it shows one tile per hiker stack, only things that fit, and all of them;
  - stacks without enough are faded and sorted last.
- **A filled slot:**
  - shows the thing in color, outlined in the owner's color, with an EditUndo × in the corner that empties it;
  - clicking the slot itself swaps what's in it.
- **Spending:** nothing is spent until Start. Then the resources leave the owners' packs, and items lose a use.
- **SKIP IT** rows turn Start into SKIP IT.
- **Testing tab:** Prepare now shows in test mode too, with a new **Packs** setting (Made-up, Empty, Lots). Nothing is really spent.

## 2. The demo bot (`20`, section 2)
- **The real game in demo mode:** the GPS runs the real minigame with a `demoBot` giving the inputs.
- **It uses the current Prepare choices,** so filling slots changes the demo.
- **It loops,** takes no input and plays no sound. With reduced motion it shows a still frame.
- **Each game's bot** is described in `20`, section 7. A simple bot that's sometimes wrong is the goal.

## 3. Every game's content (`20`, section 7)
Each game exports:
- `howToPlay`, the big text, written in section 7;
- `controls`, from its own design file;
- `chips`;
- `bars`;
- `prepare` (rows of `{ label, line, slots, perHiker?, accepts, need, effect, onlyIf? }`);
- `demoBot`.

The minigame and the demo get the final params, the tier's numbers plus every effect.

## 4. Raccoon Shuffle (`18`, section 6, "Revised November 26")
- **Harder numbers:**
  - 4 to 8 bins, always 1 empty;
  - 7 to 15 swaps that speed up through the shuffle;
  - far swaps;
  - fake-outs from Tier II;
  - two swaps at once from Tier II;
  - a shorter show;
  - night from Tier III.
- **Cards:**
  - use `art/resources-green/<id>.png` (and `energy.png`) at (4, 1) inside `card.png`, unscaled;
  - remove the old 14 × 14 icon box, which sat low.
- **Show the empty bins** defaults to Off.

## 5. Bear with a Gun and Ants (`21`, sections 1 to 3)
- **Two new Dodge animals,** built from the attack library like the others:
  - Bear with a Gun starts at Tier III (Level 2);
  - Ants start at Tier II (Level 1);
  - both are in the Stampede.
- **New mechanics in the library:**
  - an **aim line that tracks, then locks** (Aimed Shot);
  - **blocking areas** the sprite can't enter (snipe holes, the Ant Hill);
  - **damage 2** (Snipe);
  - **slowed** (traps);
  - **grid walkers** (Marching Lines).
  - Build each so other animals can use it later.
- **Bear Country** now plays Dodge with Bear with a Gun at Tier III.

## 6. Camp Cleanup (`21`, section 4)
- **Snake on a grid:** [25 × 14] cells of [12] units, one cell per step, queued turns, no reversing.
- **The snake:** it starts as the hikers in the line-up's order. Trash in each hiker's color adds a bag of that color at the end.
- **Crashes:** a crash drops a random number of bags off the end.
- **Results:** each hiker passes if they have their quota when time runs out.
- **Obstacles** from Tier III.
- It replaces "Ants Are Marching" in the plans.

## 7. Ridgeline and Rock Climb fixes (`21`, sections 5 and 6)
- **Ridgeline:**
  - [0.6×] width;
  - drops on both sides that drain 2× fast;
  - knife-edge pinches;
  - bigger jogs (slope cap [90%]);
  - scree that slides;
  - wind gusts with a warning.
- **Rock Climb:**
  - a tap on an active-color hold queues the grab, which happens when the hand passes within reach;
  - Space queues the closest one;
  - [0.9 s] jumps plus a [0.25 s] hang at the end;
  - a reach circle and rings on reachable holds;
  - tap tolerance [16];
  - add the test in `21`, section 9 that a planned jump must grab.

## 8. Tests
Follow `20`, section 8, `21`, section 9, and the new Raccoon Shuffle lines in `18`, section 9.

## When you're done
Send Wyatt a short summary with:
- what was built;
- anything you had to interpret;
- which games' demo bots are simple placeholders so far;
- which Prepare options you couldn't wire up yet (for example, items the game doesn't track uses for);
- what caused the Rock Climb grab bug, if it was more than the timing.
