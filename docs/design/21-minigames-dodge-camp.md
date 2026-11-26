# Minigames, November 26: Bear with a Gun and Ants (Dodge), Camp Cleanup, a new Ridgeline, and the Rock Climb fix

Wyatt's additions:
- Bearrels goes away. Its bear moves into Dodge as **Bear with a Gun**.
- **Ants** join Dodge.
- The planned snake game (Ants Are Marching) becomes **Camp Cleanup**.
- **Trails: Ridgeline** gets its own hazards.
- **Rock Climb** gets a fix so grabbing works.

Numbers in [brackets] are first guesses for `balance.ts`, with `TODO(wyatt)`. Settings marked **(setting)** are in the testing tab. Ideas marked *(Claude's idea)* go behind the Dodge "Claude's ideas" setting, like the others.

---

## 0. Bearrels goes away
- **Remove Bearrels** from the minigame catalog, the testing tab and the challenge content. Then delete its code, tests and art (`art/bearrels/`) once nothing imports them.
- In `10-minigames.md`, section 4, add at the top: "**Removed November 26 (Wyatt): the bear moved into Dodge as Bear with a Gun.**"
- **Bear Country** stays as a challenge, with its poster and flavor line. It now plays **Dodge with Bear with a Gun**, at **Tier III**, his first tier. Its Prepare is in `20-challenge-popup.md`, section 7.
- **Guess and luck** now holds Raccoon Shuffle (and Squirrel Theft, later).

---

## 1. Bear with a Gun (Dodge)
A cowboy bear with a revolver. See `mockups/dodge-new/22-gun-aimed-shot.png` to `25-gun-rapid-fire.png`.

- **Box:** [160 × 110].
- **Portrait:** `bear-gun.png` (Solid + red, with `-blink`, `-bob` and `-bob-blink`, like the others). It gets the idle bob, not the float. Its face is at x [26], already padded to the middle.
- **Level 1:** Aimed Shot, Rapid Fire, Bear Traps.
- **Level 2 adds:** Snipe, and Ricochet *(Claude's idea)*.
- **Level 3 adds:** Quick Draw *(Claude's idea)*, and double shots in Aimed Shot.

### Aimed Shot (missile; Wyatt: like the sword jab, but faster and bigger)
- **The gun:** it picks a spot just outside the top wall or a side wall, with `muzzle-flash.png` there.
- **Aiming:** a thin dashed line runs from that spot to the sprite and **tracks it** for [0.5 s] (Level 1), [0.4 s] (Level 2) or [0.32 s] (Level 3). Then it locks and blinks for [0.2 s].
- **The shot:**
  - a lane [6] units wide (the jab's is 5) fires across the whole box along the locked line in [0.06 s] (the jab takes 0.12);
  - a light trail stays for [0.15 s], with `bullet.png` at its front;
  - hit shape: a segment [6] thick along the lane while the shot crosses.
- **In a row:** [3] shots (Level 1), [4] (Level 2) or [5] (Level 3), [0.25 s] apart, each from a new spot.
- **Doubles:** at Level 3, every third shot is a double, two lanes side by side [14] apart.

### Snipe (changer; Wyatt's)
- **Following:** a crosshair (`crosshair.png`, 27 across) appears on the sprite and follows it at [70%] of the sprite's top speed for [1.6 s] (Level 2), or [85%] for [2.0 s] (Level 3).
- **Locking:** it stops and turns red (`crosshair-locked.png`) for [0.35 s].
- **The blast:**
  - a circle [14] across from the middle;
  - **a hit costs 2 hearts** (Wyatt). With the usual 2 lives per hiker, that takes the hiker out;
  - the normal after-hit blink follows.
- **The hole:**
  - the blast leaves a hole (`hole-1.png`, [12] across from the middle) that **the sprite can't enter**: it's pushed out along the hole's edge, like a wall;
  - it stays [5 s] (Level 2) or [7 s] (Level 3);
  - then it fades over [2 s] through `hole-2` and `hole-3`, its blocking circle shrinking with it, until it's gone.
- **Limits:** at most [3] holes at once. Holes never cover more than [30%] of the box: if a new one would, it leaves no hole.
- **Level 3:** two snipes back to back.

### Bear Traps (changer; Wyatt's)
- **Tossing:** the bear tosses [2] traps (Level 1), [3] (Level 2) or [4] (Level 3) in arcs. Each landing spot shows `trap-shadow.png` [0.6 s] before.
- **On the floor:** a trap lands open (`trap-open.png`) and stays [8 s], [10 s] or [12 s] by level, then fades.
- **Stepping on one:**
  - it snaps shut (`trap-closed.png`) and costs 1 heart;
  - the sprite moves at [50%] speed for [1.5 s], with "SLOWED" beside it;
  - a closed trap is harmless and fades in [1 s].
- **Limits:**
  - at most [5] open traps;
  - none lands within [16] units of the sprite or on a hole;
  - other attacks keep coming while traps are out.

### Rapid Fire (missile; Wyatt's)
- **Warning:** the gun picks one spot outside a wall, with the muzzle flash, a "!" for [0.6 s], and a faint cone showing the spread, aimed at where the sprite is.
- **The spray:** [8] bullets (Level 1), [10] (Level 2) or [12] (Level 3) fly out over [1.2 s]. Each takes a random angle within ±[30°] of the cone's middle, at [200], [230] or [260] units/s.
- **Hit shape:** a circle [2] across from the middle, per bullet.

### Ricochet *(Claude's idea, Level 2 and up; missile)*
- One slower shot ([150] units/s).
- During a [0.8 s] warning its whole path shows as a dotted line, bouncing off the walls [2] times (Level 2) or [3] (Level 3). The bullet follows the path exactly.

### Quick Draw *(Claude's idea, Level 3; area)*
- **Warning:** "!" over the portrait for [0.6 s].
- **The blast:** a band [16] high across the whole row the sprite is on. Then [0.3 s] later, a band [16] wide down the column it's on now.
- **Fair:** always more than [30%] of the box is safe.

---

## 2. Ants (Dodge)
A swarm of ants. See `mockups/dodge-new/26-ants-lines.png` to `29-ants-hill.png`.

- **Box:** [150 × 120].
- **Portrait:** `ant.png` (Solid + red, with blink and bob frames).
- **Ants:**
  - `ant-1` and `-2` (7 × 9, facing up) swap every [0.12 s];
  - turn them in 90° steps on the grid, or by angle in code (nearest neighbor) when they walk at an angle;
  - hit shape: a circle [3] across from the middle per ant.
- **Level 1:** Marching Lines, Ant Mill, Leafcutter Parade *(Claude's idea)*.
- **Level 2 adds:** Fire Ants and the Ant Hill.
- **Level 3 adds:** Crumb Rush *(Claude's idea)*, plus the Level 3 changes below.

### Marching Lines (missile; Wyatt: like snake)
- **Entering:** a line of [8] ants (Level 1), [10] (Level 2) or [12] (Level 3) comes in from a wall at a "!" spot.
- **Walking like snake:** on a [7]-unit grid. It goes straight, then turns 90° every [3–6] cells, never back on itself, at [45], [55] or [65] units/s.
  - At Level 1 the lead ant shows its next turn with a tiny arrow [2] cells ahead.
- **How many:** [1] line at Level 1, [2] at Level 2, [3] at Level 3, coming in [0.5 s] apart from different walls.
- **Leaving:** after [5 s], each line heads for the nearest wall and walks out.

### Ant Mill (missile; Wyatt: a group goes round in circles)
- **The ring:** [12], [14] or [16] ants circle one spot ([22] across from the middle) for [4 s], turning at [1.2] radians/s.
- **The column:** at the same time, a straight column of [8], [10] or [12] ants marches across another part of the box, never through the ring.
- **Level 2:** the ring drifts slowly toward the sprite ([10] units/s).
- **Level 3:** two rings, turning opposite ways.

### Fire Ants (area; Wyatt's)
- **Coming in:** [4] ants (Level 2) or [5] (Level 3; [6] at Tier V) walk in and stop at spread-out spots, at least [30] apart.
- **Turning red:** after [0.6 s], **all but one** turn red (`fire-ant-1` and `-2`) and blink faster and faster for [1.2 s].
- **Exploding:** they blow up (`boom-1`, then `boom-2`), each blast a circle [26] across from the middle.
- **The safe ant:**
  - the one that stays dark is the safe spot: no blast reaches within [12] units of it;
  - pick the spots so it starts at least [40] units from the sprite, so you have to move;
  - at Level 3, it takes a few steps to a new spot during the warning, so you have to follow it.

### Ant Hill (changer; Wyatt's)
- **Popping up:** a crack (`anthill-1`) shows at a spot at least [50] units from the sprite for [0.6 s]. Then the hill rises (`anthill-2`, then `-3`).
- **Up:** it stays [3 s] (Level 2) or [4 s] (Level 3; [5 s] at Tier V). The hill is solid: the sprite can't walk through it (a circle [10] across from the middle).
- **Firing:** while it's up, it fires an ant toward where the sprite is every [0.4 s] (Level 2) or [0.3 s] (Level 3). Each ant walks straight at [70] or [80] units/s.
- **Then** it sinks back. Other attacks keep coming while it's up.

### Leafcutter Parade *(Claude's idea; missile)*
- A row of ants carrying leaves (`leaf.png`) crosses from one wall to the other at [40] units/s.
- The gaps between them are [18] (Level 1), [15] (Level 2) or [12] units (Level 3).
- Each leaf is a [10 × 8] hit box.

### Crumb Rush *(Claude's idea, Level 3; missile)*
- [2] crumbs (`crumb.png`) drop at spots, each with a "!" first ([3] crumbs at Tier V).
- Then [16] ants pour in from all the walls, straight at the nearest crumb, at [60] units/s.
- Stay out of the lanes into the crumbs.

---

## 3. Dodge: who shows up (changes to `12-minigames-dodge.md`, section 4)
Add these rows to the two tables:

| Animal | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Ants | — | 1 | 2 | 3 | 3 + overlaps |
| Bear with a Gun | — | — | 2 | 3 | 3 + overlaps |

| How common | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Ants | — | [25] | [20] | [20] | [20] |
| Bear with a Gun | — | — | [20] | [20] | [20] |

- **The Stampede** gets their attacks too. Snipe holes, traps and the Ant Hill are changers, so only one at a time.
- **The testing tab:** add both to the Dodge animal list, with their attacks in the Attack picker.

---

## 4. Camp Cleanup (it replaces Ants Are Marching, the planned snake game)
Clean up the campsite as one long line of hikers, like Google's snake. See `mockups/dodge-new/30-camp-cleanup.png` and `30b-camp-cleanup-crash.png`.

- **Movement and dodging,** any tile. It isn't a passing challenge: hikers pass or fail on their own, and those who fail lose [1] energy.
- **First, the line-up:** the party picks its order on the usual line-up screen (Wyatt). The first hiker leads.

### The board
- **A grid** of [25 × 14] cells, [12] units each, at (10, 28), drawn on `ground.png` (a checkered campsite floor) with a dark edge.
- **Everything moves cell by cell** (Wyatt: exact, like Google's snake).
- **The snake starts** as the hikers themselves, in line order, one cell each:
  - each cell is a dark rounded square with that hiker's person icon in their color;
  - it starts at the left middle, heading right.

### Moving
- **The snake moves** one cell every 1 ÷ the tier's speed.
- **Turning:** arrow keys or WASD, a swipe, or a tap on a side of the head (above, below, left or right of it).
- **No reversing.** Up to [2] turns queue up, so quick turns like a U-turn work (Google's snake does this).

### Trash
- **What's out:** one piece per hiker is on the board at a time, in that hiker's color:
  - a random kind: `trash-can`, `-bottle`, `-wrapper` or `-core`, with its light parts tinted;
  - on a free cell at least [3] cells from the head.
- **Picking it up:** when the head reaches it, a **bag** of that color (`bag.png`, tinted) is added at the end of the line (the snake grows by one on its next step). A new piece of that color shows up somewhere else.
- **Counts:** each hiker's count is the number of their bags in the line. The bottom bar shows it as squares out of the quota, with DONE at the quota.
- **Past the quota:** once a hiker has their quota, their trash gets a small check mark. More of it still counts, but it only makes the line longer and harder (Wyatt).

### Crashing (Wyatt)
- **A crash** is hitting a wall, an obstacle or the snake's own body.
- **The snake stops** for [0.6 s] and blinks. A **random** number of bags (the table) falls off the **end** of the line, tumbles and fades, and the counts go down to match. Hiker cells are never lost.
- **Then:**
  - it waits up to [1.5 s] for a direction (arrows at the head show the open ways);
  - if none comes, it turns toward the side with the most room and goes on.

### Obstacles (Tier III and up)
- **What:** rocks (`obstacle-rock`), stumps (`obstacle-stump`), logs (`obstacle-log`, 2 cells) and tents (`obstacle-tent`, 2 × 2).
- **Where:**
  - never on the start row or within [3] cells of the start;
  - placed so no part of the board is closed off.

### The end
- **When the timer runs out,** each hiker passes if their bags are at their quota or more, and fails if not (Wyatt).

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Time **(setting)** | [60 s] | [60 s] | [70 s] | [75 s] | [80 s] |
| Bags each hiker needs **(setting)** | [3] | [4] | [4] | [5] | [5] |
| Speed (cells per second) | [5] | [6] | [7] | [8] | [9] |
| Bags lost in a crash (random) | [2–3] | [2–4] | [3–5] | [3–6] | [4–7] |
| Obstacles | none | none | [3] | [5] | [7] |

- **With 5 or 6 hikers,** the quota goes down by [1] (the line gets long fast).

---

## 5. Trails: Ridgeline, revised (Wyatt: way too easy, make it its own thing)
Ridgeline was a slightly narrower Forest Path with small jogs, gentle because of the slope cap. Now it's a knife-edge ridge with wind. See `mockups/dodge-new/31-ridgeline.png`.

- **The drop:**
  - off the ridge is a sheer drop (`tile-drop.png`), not ground;
  - both edges have a crumbly lip (`ridge-edge.png`, every [8] units);
  - **off the trail on Ridgeline drains the bar [2×] as fast.**
- **Narrower:** [0.6×] the tier's width (was 0.75).
- **Knife edges:** every [250–400] units, a stretch of [60–100] units pinches to [0.6×] of the ridge's own width.
- **Bigger, sharper jogs:**
  - [40–70] units to the side;
  - for Ridgeline only, the slope cap is [90%] of the hiker's top speed (was 75%), so you have to read them coming.
- **Scree:**
  - patches of loose rock ([40–70] units long, `tile-scree.png`) on the trail;
  - on scree, steering is half as strong and the hiker keeps sliding: momentum dies off [3×] slower than normal.
- **Wind gusts:**
  - **warning:** wind streaks (`wind-1` and `-2`) blow across from one side for [0.8 s], with `gust-arrow.png` at that edge;
  - **the gust:** it pushes the hiker sideways for [1.0–1.5 s]. Steer against it.

| Ridgeline | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| A gust every | [6–8 s] | [5–7 s] | [4–6 s] | [3–5 s] | [2.5–4 s] |
| Gust push (units/s) | [35] | [45] | [55] | [60] | [65] |
| Scree patches | none | [1] per section | [1–2] | [2] | [2–3] |

---

## 6. Rock Climb: grabbing doesn't work (bug fix)
- **What's wrong:**
  - a grab only works if the hand is already within reach of the hold **at the exact moment of the tap**;
  - the jump lasts only [0.5 s] and the hand moves fast, so that moment is a few frames;
  - Space has no grab at all;
  - so in practice every jump falls.
- **The fix:**
  1. **Queued grab:**
     - tapping a hold of the active hand's color at any time during the jump queues it, with a small "GRAB QUEUED" tag over it;
     - every frame for the rest of the jump, if the hand is within reach of that hold, it grabs it right there;
     - a tap on another color does nothing.
  2. **Space** (or a tap that isn't on a hold) queues the active-color hold that the rest of the jump passes closest to.
  3. **A floatier jump:**
     - [0.9 s] (was 0.5), easing out;
     - then the hand hangs at the end for [0.25 s] before the fall, and it can still grab then.
  4. **Show it:**
     - during the jump, a faint circle the size of the reach goes around the hand;
     - every active-color hold that the jump will pass within reach of gets a soft ring in that hiker's color.
  5. **Tapping:** a tap counts for a hold within [16] units of its middle (was 12).
  6. **Tries:**
     - from Tier III (one try per jump), the queued grab is the try;
     - at Tiers I and II, a new tap replaces the queued hold.
- See `mockups/dodge-new/32-rock-climb-grab.png`.

---

## 7. Art
**`art/dodge/portraits/solid-red/`**
- `bear-gun.png` and `ant.png`, each with `-blink`, `-bob` and `-bob-blink`.

**`art/dodge/bear-gun/`**
- `bullet.png` (8 × 4), `pellet.png`, `muzzle-flash.png` (16 × 16).
- `crosshair.png` and `crosshair-locked.png` (27 × 27).
- `hole-1` to `hole-3` (30 × 30): fresh, fading, almost gone.
- `trap-open`, `trap-closed` and `trap-shadow` (18 × 12).

**`art/dodge/ants/`**
- `ant-1` and `-2`, `fire-ant-1` and `-2` (7 × 9).
- `boom-1` and `-2` (30 × 30).
- `anthill-1` to `-3` (26 × 18).
- `leaf.png` and `crumb.png`.

**`art/camp-cleanup/`**
- `ground.png` (300 × 168).
- `trash-can`, `-bottle`, `-wrapper` and `-core` (10 × 10, light parts tinted).
- `bag.png` (10 × 10, tinted).
- `obstacle-rock`, `-stump` (12 × 12), `-log` (24 × 12) and `-tent` (24 × 24).

**`art/trails/`** (new pieces)
- `tile-drop.png` and `tile-scree.png` (32 × 32).
- `ridge-edge.png` (8 × 4).
- `wind-1` and `-2` (28 × 9) and `gust-arrow.png` (14 × 14).

---

## 8. Testing tab
- **Dodge:** Ants and Bear with a Gun in the animal list. Their attacks go in the Attack picker, with Claude's ideas under the ideas setting.
- **Camp Cleanup** (Movement and dodging): Tier, Hikers, Time (Auto, 30 to 120 s), Bags each (Auto, 1 to 8), Speed (Auto, 3 to 12), Obstacles (Auto, Off, On).
- **Trails:** Ridgeline's hazards each get a switch (Gusts, Scree, Knife edges), for tuning.
- **Rock Climb:** **Show reach** (on by default while tuning).
- **Remove Bearrels.**

---

## 9. Tests
- **Bear with a Gun:**
  - the aim line tracks until it locks, then the shot follows the locked line;
  - a snipe hit costs 2 hearts, holes block movement, fade and shrink, and never cover more than [30%] of the box;
  - traps snap once, slow for the right time, and never land near the sprite;
  - Ricochet follows its shown path.
- **Ants:**
  - marching lines stay on the grid and never reverse;
  - fire ants always leave the safe circle unhurt;
  - the Ant Hill blocks the sprite and aims at it.
- **Camp Cleanup:**
  - movement is cell by cell, no reversing, and queued turns work;
  - a pickup adds a bag of that color at the end;
  - a crash removes a random number of bags in the tier's range, from the end only, and never a hiker;
  - obstacles never close off part of the board;
  - results compare each hiker's bags with the quota.
- **Ridgeline:**
  - off the trail drains 2× as fast;
  - gusts warn first;
  - scree changes the steering;
  - the slope cap holds at [90%].
- **Rock Climb:**
  - for every tier, plan a wall, aim and power at the next path hold, and queue its grab when the jump starts: it **must** grab;
  - a jump that misses the hold by more than reach must not grab;
  - Space queues the closest hold.
- **Bearrels:** gone from the catalog and the testing tab, and Bear Country plays Dodge with Bear with a Gun.
