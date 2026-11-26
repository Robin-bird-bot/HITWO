# Update: November 26, 2026, second round (the challenge pop-up, version 3; game revisions)

**Builds on `UPDATE-2026-11-26-challenge-popup`** (merged in main, PR #31). Keep everything else as it is.

What's in it:
1. **The challenge pop-up, version 3** (`20-challenge-popup.md`, replaces version 2):
   - every game explains all its important rules, with extra rule lines that show only when they apply (for example, Trail Map's signs only when there are signs);
   - solid tan-brown bars instead of segments;
   - **cost cards:** one rounded card per cost, color-coded green, blue or red. When a cost can do several things, you pick one after filling the slot. A per-hiker effect (+1 heart) takes one slot, and you pick the hiker after;
   - animated slot outlines, darker frames, stronger ghost icons, and the cost written out ("×2 FOREST RESOURCES");
   - Start under the GPS, with no note under it; a bigger poster;
   - the demo's scanlines fixed.
2. **Game revisions** (`22-minigame-revisions.md`, new):
   - **Raccoon Shuffle:**
     - wider cards with a red minus;
     - from Tier III, extra empty bins that a raccoon carries off at the end.
   - **Rock Climb:**
     - **rules:** [3] tries per hiker, and each fall costs a try and 1 energy. A hiker out of tries is out, and their holds change color. Finish by jumping past the top line. No timer. The arrow and power bar get faster at high tiers;
     - **looks:** a reaching free arm, a big hand and arrow in the active color, the camera sliding up, and falls off the bottom of the screen.
   - **Bear with a Gun:**
     - traps land gray and arm a second later;
     - Ricochet is faster, bounces longer, and fires 2 to 4 shots;
     - new Bullet Ring from Tier IV.
   - **Ants:** an Easy level, so they join Tier I.
   - **Bear with a Sword:** Sword Volley (numbered swords) replaces the Sword sweep.

**The reference for the pop-up is the version 3 prototype:** `mockups/challenge-popup/prototype.html`. Open it in a browser. Fill the FOOD card's slots to see the "what should it do?" and "who gets it?" steps.

Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`. The Prepare cards for each game (`20`, section 7) are all first guesses.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `20-challenge-popup.md` → `docs/design/` (replaces it).
- `22-minigame-revisions.md` → `docs/design/` (new).
- **Short notes in other docs**, each at the top of the section named:
  - `18-minigames-quick.md`, section 6 (Raccoon Shuffle): "**Revised again November 26: see `22-minigame-revisions.md`, section 1.**"
  - `19-minigames-signs-trails.md`, section 4 (Rock Climb): "**Tries, the top and the look revised November 26: see `22-minigame-revisions.md`, section 2.**"
  - `21-minigames-dodge-camp.md`, sections 1 and 2: "**Revised November 26 (second round): see `22-minigame-revisions.md`, sections 3 and 4.**"
  - `12-minigames-dodge.md`, "Sword sweep": "**Removed November 26: replaced by Sword Volley (`22-minigame-revisions.md`, section 5).**"
- `mockups/challenge-popup/` → `docs/mockups/minigames/challenge-popup/`:
  - `prototype.html` replaces the version 2 prototype;
  - the `v3-*.png` screenshots are new;
  - delete the version 2 screenshots (`1-start.png` to `5-filled.png`).
- `mockups/revisions-nov-26/` → `docs/mockups/minigames/revisions-nov-26/` (new).
- **Art,** into the matching minigame asset folders:
  - `art/raccoon-shuffle/card.png` (replaces it: 30 × 26 now);
  - `art/rock-climb/climber-body.png`, `hand-open.png`, `hand-grip.png` (new). Delete `climber-hang.png` and `climber-leap.png` once nothing uses them;
  - `art/dodge/bear-gun/trap-arming.png` (new).
- Then delete the leftover `update-2026-11-26-popup-v3/` folder.

---

## 1. The pop-up, version 3 (`20`)
Do sections 1 to 4 first, using the Dodge (Bees) example in the prototype, then section 7 game by game.
- **How to play** (section 1.1):
  - add `rules(s)` next to `howToPlay(s)`. It returns only the lines that apply to this run, each with an optional tag ("FROM TIER II");
  - section 7 rewrites every game's text so it covers all the important rules;
  - use this run's real numbers.
- **Bars** (section 3): a solid tan track with a deep brown fill; green hatching for a drop and solid green for a gain.
- **Cost cards** (section 4):
  - group each game's options by cost into cards;
  - after picking a tile: a "WHAT SHOULD IT DO?" step, then a "WHO GETS IT?" step, each only when needed;
  - a badge under each filled slot says what it does;
  - per-hiker rows no longer have slots.
- **Layout:** the poster is 156 × 234; START is under the GPS, as wide as it; the caption and the note are gone.
- **Scanlines** (section 2.1): draw them on a canvas at device pixels, and redraw on resize and zoom.

## 2. Game revisions (`22`)
- **Raccoon Shuffle:** the new card art and icon position; `empty` and the new `takeAway` by tier; the take-away animation; the bot.
- **Rock Climb:**
  - tries and energy per fall, hikers going out and the recolor, and the everyone-fails rule;
  - the top line and no timer;
  - faster swing and power by tier;
  - the new climber: arms drawn in code, the hands, the arrow and power bar in the active color, the camera slide, and the fall off the screen.
- **Bear with a Gun:** the trap arming stage; Ricochet's speed, bounces and shots by tier; Bullet Ring (Tier IV and up).
- **Ants:** level 0 (Easy) in every ants table, Tier I's roster and weights, and Easy playing only Marching Lines and Ant Mill.
- **Bear with a Sword:** remove the sweep; add Sword Volley.

## 3. Things to flag to Wyatt
These are my readings, not his words:
- **Rock Climb:**
  - no timer by default, now that tries are the limit;
  - hikers who go out lose nothing more at the end, because each fall already cost them energy.
- **Raccoon Shuffle:** the take-away only ever takes empty bins, so one is always left (two with LURE ONE OUT).
- **Cost cards:**
  - the colors: green is more for you, blue is see or know more, red is a weaker challenge;
  - at most [3] slots a card;
  - a ×2 slot takes 2 of the same thing from one hiker.
- **Bullet Ring:** I couldn't find the Bear's old echo attack in the repo, so it's built from Wyatt's description.

## 4. Tests
`20`, section 8, and `22`, section 6.
