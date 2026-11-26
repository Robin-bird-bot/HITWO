# Minigame revisions, November 26 (second round): Raccoon Shuffle, Rock Climb, Bear with a Gun, Ants, Bear with a Sword

Wyatt played the first November 26 update (the challenge pop-up, version 2). These are his changes, and my readings of them where he didn't say.

Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`. Mockups are in `mockups/revisions-nov-26/`. The pop-up text for these games is in `20-challenge-popup.md` (version 3), section 7.

---

## 1. Raccoon Shuffle (`18-minigames-quick.md`, section 6)
### 1.1 Wider cards with a minus
Wyatt: the icons didn't fit, and it should be clear the thing is being stolen. See `33-raccoon-cards-wide.png`.
- **The new card** (`art/raccoon-shuffle/card.png`, replaces it) is **30 × 26** (was 20 × 26), and its light panel is 26 × 14.
- **A red minus** is painted into the card on the left (x 5–10, y 7–9).
- **The 12 × 12 icon** goes at (13, 2) in the card, right of the minus.
- The card stays centered over its raccoon.

### 1.2 Tier III and up: bins get taken away (Wyatt)
Wyatt: "on Tier III and higher, there are two empty trash bins, but at the end one of them gets taken away, so the player has to track both. At Tier V maybe there's 3 and 2 get taken away." See `34-raccoon-takeaway.png`.
- **Empty bins:** Tiers III and IV get [2] empty bins, and Tier V gets [3]. The number of bins doesn't change.
- **The take-away**, after the last swap:
  - a [0.4 s] pause;
  - then a raccoon carries off one of the **empty** bins (picked at random), hauling it up into the woods over [0.9 s];
  - a dashed outline and a "TAKEN!" tag stay where it was;
  - Tiers III and IV take [1] bin. Tier V takes [2], one after the other, [0.5 s] apart.
- **So one empty bin is left** at every tier, but you didn't know which until the end. You have to follow all of them.
- **The gap** can't be picked. The pick works as before.
- **LURE ONE OUT** (Prepare, +1 empty bin) adds an empty bin that isn't taken, so two are left at the end.
- **Balance:** add `takeAway` by tier: [0, 0, 1, 1, 2]. Change `empty` to [1, 1, 2, 2, 3].
- **The demo bot:** it follows one empty bin. If that bin is taken, it picks at random from what's left.

---

## 2. Rock Climb (`19-minigames-signs-trails.md`, section 4)
### 2.1 Tries and falls (Wyatt)
Wyatt: "each hiker has 3 lives. Each fall loses an attempt and an energy. If a hiker loses all 3, they are removed from the order, and all of their colored rocks become random colors of the other hikers. If no hikers make it up, the challenge fails. Make it a passing challenge."
- **Tries:** each hiker has [3]. The HUD shows them as three pips in the hiker's color (see the mocks).
- **A fall** costs the hiker whose color the hand had:
  - one try;
  - [1] energy, paid at the end even if they pass later.
  - The same hand and color go again, as before.
- **Out of tries:**
  - "<NAME> IS OUT" shows for [1.2 s];
  - they leave the color sequence;
  - every hold in their color (on the path and decoys) changes to a random color of a hiker still in. The holds blink as they change over [0.6 s];
  - decoys still never take a color that a nearby path hold needs (as `planWall` does now), so pick their new colors with the same check;
  - the rest of the sequence is rebuilt from the hikers still in.
- **Everyone out:** the challenge fails for everyone (the everyone-fails rule).
- **Results** (it's still a passing challenge):
  - reaching the top: every hiker still in passes and moves onto the tile;
  - hikers who are out stay back. They've already lost energy from their falls, so failing costs them nothing more (my reading).
- **No timer** (my reading: the tries are the limit now). The tier's time becomes Off. The Time setting stays for testing.
- **Harness** (Prepare): the first fall costs no try and no energy.

### 2.2 The top (Wyatt)
Wyatt: "making it to the top means flying up past the top line, not just grabbing the last one." See `35c-rock-climb-top.png`.
- **The top line** is a ledge [40–70] units above the last path hold, drawn across the wall with "THE TOP" on it.
- **The last move** is a jump: if the hand goes above the line during the jump, the climber is over. No grab is needed.
  - A jump that doesn't reach the line is a normal fall.
  - The last move uses the next color in the sequence, like every other move. The ledge glows in that color.
- **Over the top:** the climber keeps going up past the line, lands standing on the ledge, and "OVER THE TOP!" shows.

### 2.3 Faster at higher tiers (Wyatt)
- **The arrow's swing** (`swingSec`, side to side): [1.6, 1.3, 1.0, 0.75, 0.6] s by tier (was 1.6 to 0.9).
- **The power meter** (`powerSec`, empty to full): [1.2, 1.0, 0.8, 0.6, 0.48] s by tier (was 1.2 to 0.8).

### 2.4 How it looks (Wyatt)
Wyatt: make the hand and the current color much more obvious; the free arm follows the arrow and is a bit animated, like the Woods Monster's reaching arm (inspiration: *A Difficult Game About Climbing*); a bigger free hand; the arrow in the hiker's color; the camera slides up; a fall goes all the way off the screen. See `35a-rock-climb-aim.png` and `35b-rock-climb-fall.png`.
- **The climber:**
  - the body is `art/rock-climb/climber-body.png` (26 × 30, from behind, no arms). It replaces `climber-hang.png` and `climber-leap.png`;
  - the arms are drawn in code: two straight parts (upper arm and forearm), [3] units thick with a [1] unit dark outline (G2 inside, G0 outline), from each shoulder ([±5] units from the body's middle, [8] down from its top) to its hand.
- **The hanging hand:** `hand-grip.png` (12 × 10) on the current hold. Its light parts take the color of that hold.
- **The free hand:**
  - `hand-open.png` (14 × 14, bigger than the head). Its light parts take the active hiker's color;
  - a ring in that color goes around it ([11] unit radius, [1.4] thick), pulsing slowly.
- **The free arm follows the aim:**
  - the hand sits [24] units from its shoulder in the arrow's direction;
  - it eases toward the arrow rather than snapping ([0.08 s] to catch up);
  - the elbow bends out a little and wiggles (±[1.5] units at [3] per second), like the Woods Monster's arms;
  - while power builds, the arm pulls in, up to [4] units shorter at full power, so the jump looks loaded.
- **The arrow:** its dots and its head are in the active hiker's color, with a dark outline on the head. The half-circle of aim ticks stays light green.
- **The power bar:** it fills in the active hiker's color.
- **A label** at the top left, under the HUD: "<NAME>'S HAND" with a dot in their color.
- **The camera:** after a grab, it slides up over [0.5 s] (easing out) so the climber sits about [65%] of the way down the screen. It no longer jumps.
- **A fall:**
  - the climber drops with gravity ([600] units/s²), arms up and turning a little ([20°]), until fully below the bottom of the screen;
  - then the box shows: "<NAME> FELL · N TRIES LEFT" and "-1 ENERGY", for [1.2 s];
  - then the camera slides back to the last hold over [0.6 s] and the climber fades in hanging there;
  - this replaces the slide back (`slideSec`).

---

## 3. Bear with a Gun (`21-minigames-dodge-camp.md`, section 1)
### 3.1 Bear Traps arm more slowly (Wyatt)
Wyatt: "Bear traps take a second longer to arm, being gray first, then red when active." See `36-gun-traps-arming.png`.
- A trap lands **gray and harmless** (`art/dodge/bear-gun/trap-arming.png`, new) for [1 s] more than it does now (`armSec`).
- Then it **snaps to red** (the open trap): from then on it bites, as now.
- The time it stays open starts when it turns red.

### 3.2 Ricochet: faster, longer, more (Wyatt)
Wyatt: "much faster, bounces longer, and a few come out by tier, up to 4." See `37-gun-ricochet.png`.
- **Speed:** [260] (was 150).
- **Bounces:** [3, 4, 5] by level (was 2, 2, 3).
- **Shots by tier:** [2] at Tier III, [3] at Tier IV, [4] at Tier V.
  - Every path shows at once for the warning ([0.8 s]);
  - then the shots fire [0.25 s] apart.
- Ricochet only plays from Level 2, so Tier III is the first tier that matters.

### 3.3 New attack: Bullet Ring (Tier IV and up, Wyatt)
Wyatt: a bullet-hell attack, like the Bear's old echo attack, but with single bullets shot out in a ring from the top. See `38-gun-bullet-ring.png`.
- **The warning:** "!" over the portrait and the muzzle flash at the middle of the box's top edge, for [0.6 s].
- **The rings:**
  - [3] rings at Tier IV and [4] at Tier V, [0.45 s] apart, all from that point;
  - each ring is [16] bullets (`pellet.png`) evenly spaced, moving outward at [70] units/s;
  - each ring is turned [11°] from the last, so the openings move;
  - the bullets that start outside the box don't count.
- **Hits** like Rapid Fire's bullets (a circle of radius [2]).
- **Only from Tier IV:** go by the tier, not the level (Fire Ants' `tierFive` already reads the tier).
- **Add it** to Bear with a Gun's list as `bulletRing`.

---

## 4. Ants: an Easy level for Tier I (Wyatt)
Wyatt: "Ants are great, but very hard. They're supposed to be another Tier 1 enemy like bees and squirrels, so make an easier version: fewer lines, which shift a bit less, and the circle attack only uses one circle on low tiers. Otherwise great on high tiers."
- **The roster:** Tier I gets ants at Easy (level 0). Tier I weights: bees [40], squirrels [30], ants [30].
- **Easy plays only** Marching Lines and Ant Mill. Do it the way bees and squirrels handle Easy.
- **Marching Lines:**
  - Easy: [1] line of [6] ants, at speed [38], turning every [5–8] cells. The next turn always shows;
  - turning gets more often by level: [5–8] cells at Easy, [4–7] at Level 1, and [3–6] (as now) at Levels 2 and 3;
  - the number of lines stays 1, 2 and 3 at Levels 1 to 3.
- **Ant Mill:**
  - Easy: one ring of [10] ants, turning at [0.9], with no column marching across;
  - Level 1: one ring and the column (as now);
  - Level 2: one ring that drifts (as now);
  - two rings only from Level 3, as now. If two ever show below Level 3, that's a bug.
- **Levels 2 and 3 don't change.**
- **Balance:** add a `0` entry to every ants table that's keyed by level (`march.ants`, `march.speed`, `march.lines`, `mill.ring`, `mill.column` and the new `march.turnEvery`). Make `mill.column[0]` [0].

---

## 5. Bear with a Sword: Sword Volley replaces the Sword sweep (Wyatt)
Wyatt: "Remove Bear with a Sword's swipe attack and replace it with an attack where 3+ swords show up on the edge of the box, with just their tip pointing in. Each is numbered in order, then they fly across the box in that order." See `39-sword-volley.png`.
- **Remove** `sweep` from Bear with a Sword's list, along with its numbers in `balance.ts` (`sword.warnStartSec`, `sweepSec` and the rest of that block).
  - The Tier III shrinking box stays. It now counts any of the bear's attacks.
  - Delete the sweep's code and tests once nothing uses them.
- **Sword Volley** (`volley`):
  - **How many:** [3] swords at Level 1, [4] at Level 2 and [5] at Level 3.
  - **Where:** each sword appears at a random spot on the box's edge (any side), at least [24] units from the others and [16] from a corner. It points straight across, and only its tip is inside the box ([10] units).
  - **They appear** one by one, [0.15 s] apart, each with a number badge (1, 2, 3…) just outside the edge beside it: a cream square with a dark outline and the number in the pixel font.
  - **The warning** lasts [0.6 s] after the last one appears. The next sword to fly shows its path as a faint dotted line.
  - **They fly** across the box in number order, [0.35 s] apart, at [260] units/s, and vanish past the far edge.
  - **A sword hits** as a segment [24] long with a half-width of [2].
- **Art:** reuse `dodge/sword.png` (hilt at the top, tip at the bottom), turned so the tip points in.

---

## 6. Tests
- **Raccoon Shuffle:**
  - only empty bins are ever taken;
  - exactly one empty bin is left at every tier, or two with LURE ONE OUT;
  - the gap can't be picked.
- **Rock Climb:**
  - a fall costs one try and [1] energy (none with the Harness, once);
  - a hiker with no tries leaves the sequence, and no hold keeps their color;
  - everyone out fails everyone;
  - the top passes only when the hand goes above the line;
  - no timer by default.
- **Bear with a Gun:**
  - a gray trap never hits;
  - Ricochet fires the tier's number of shots;
  - Bullet Ring never plays below Tier IV.
- **Ants:**
  - Easy plays only Marching Lines and Ant Mill, with one line and one ring;
  - two rings never show below Level 3.
- **Bear with a Sword:**
  - Sword sweep is gone;
  - Sword Volley's swords fly in number order;
  - the swords are never closer together than the minimum.
