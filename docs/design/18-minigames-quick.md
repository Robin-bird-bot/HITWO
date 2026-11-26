# Minigames, batch 4, step 3: Trail Blazes, Firefly Catch, Size Up, Safari, Fly Swatter, Raccoon Shuffle

**Revised November 26 (Wyatt): Raccoon Shuffle was way too easy, and its card icons sat low and didn't match the screen.** See section 6, "Revised November 26".

Six short games. None of them is a passing challenge: each hiker passes or fails on their own, like Whackoon. Hikers who fail lose [1] energy each (Raccoon Shuffle is different: the raccoon steals something instead, section 6).

**Test version:**
- placeholder pixel art in the GPS greens (`art/trail-blazes/`, `art/firefly-catch/`, `art/size-up/`, `art/safari/`, `art/fly-swatter/`, `art/raccoon-shuffle/`);
- the 320 × 240 scene;
- the end screen from `16-challenge-end-screen.md`.

Numbers in [brackets] are first guesses for `balance.ts`, with `TODO(wyatt)`. Settings marked **(setting)** are in the testing tab. Every table runs to Tier V.

**Categories:**
- **Reaction and timing:** Trail Blazes, Firefly Catch, Size Up, Fly Swatter
- **Memory:** Safari
- **Guess and luck:** Raccoon Shuffle

**Tile types:**
- **Any tile:** Trail Blazes, Firefly Catch, Size Up, Fly Swatter
- **Wildlife:** Safari, Raccoon Shuffle

**First tier they can show up in runs:** [I] for all six.

**Turns:** Trail Blazes, Firefly Catch, Size Up, Fly Swatter and Raccoon Shuffle are played one hiker at a time, in line order. The bottom bar shows each hiker's token, name, state (DONE, NOW, WAITING, then PASSED or FAILED) and their squares or jar. The active hiker's slot has a light frame. Safari is watched by the whole party at once.

---

## 1. Trail Blazes (the line game)
Two tree trunks, side by side, painted with trail blazes. One trunk scrolls up and the other scrolls down. Tap when the two lit blazes are level. See `mockups/quick-games/1-trail-blazes.png`.

### The screen
- **The scene:** `bg.png` (deep woods, side view) from y 0 to 200.
- **The trunks:** `trunk.png` repeats up and down in two columns, at x [96] and [180]. The left one scrolls **up**, and the right one scrolls **down**. A small UP and DOWN sign stands beside each trunk.
- **Blazes:** `blaze.png` every [30] units on each trunk, centered on it.
- **The lit pair:** one blaze on each trunk is `blaze-lit.png`, with a frame in the active hiker's color drawn around it.

### Play
- **Tap, click or press Space** when the two lit blazes are level. "Level" means their centers are within the tier's distance (the table).
- **A match:**
  - a short line in the hiker's color joins the two blazes for [0.4 s];
  - both fade out, and they stay gone (bare trunk) as they scroll on;
  - a new pair lights up, starting [80–140] units apart and heading toward each other.
- **A miss:**
  - tapping when they're not level;
  - or letting the lit pair pass each other without a tap.
  - After a miss, a new pair lights up.
- **The hiker passes** when they've matched all their pairs.

### Mode **(setting)**
- **Tries (the default):** each hiker has [3] tries. A miss uses one. With none left, the hiker fails. The squares in the bottom bar are tries left.
- **Clock:** each hiker gets a clock (the table). A miss costs [2 s]. When time runs out, the hiker fails.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Pairs per hiker | [4] | [5] | [6] | [6] | [7] |
| Level within (units) | [8] | [7] | [6] | [5] | [4] |
| Trunk speed (units/s, each) | [30] | [34] | [38] | [42] | [46] |
| Speed changes | none | none | each pair, ±[25%] | each pair, ±[30%] | each pair, ±[30%], plus a wobble of ±[15%] while they approach |
| Tries **(setting)** | [3] | [3] | [3] | [3] | [3] |
| Clock per hiker (Clock mode) | [25 s] | [25 s] | [25 s] | [22 s] | [20 s] |

That makes the tap window about [0.27 s] at Tier I and about [0.09 s] at Tier V.

When the speeds change, the two trunks get different speeds, so the meeting point moves around.

---

## 2. Firefly Catch (the bouncing dot)
A firefly bounces around a night meadow. Tap when it's inside your jar ring. See `mockups/quick-games/2-firefly-catch.png`.

### Play
- **The scene:** `bg.png` (a night meadow with dark pines and stars). The play area is a box, x [38–282] and y [30–192], drawn as a thin light frame.
- **The firefly** (`firefly.png`) flies in straight lines and bounces off the box edges. Every [0.5–1 s] its direction wobbles by up to ±[20°].
- **The jar ring:** a circle in the active hiker's color, with a thin light inner ring, drawn in code.
  - It drifts slowly and bounces off the edges (Wyatt's first note: the circle moves around the box too).
- **Tap, click or press Space:**
  - **a catch** if the firefly's center is inside the ring. The firefly flies down into the hiker's jar in the bottom bar (`jar-0` to `jar-3` show how many are in). A new firefly appears at a random spot at least [60] units from the ring;
  - **a miss** if it isn't. From Tier II, a miss costs [1 s].
- **Blinking (from Tier III):** the firefly goes dark (`firefly-dim.png`) for a moment every [1.5–2.5 s]. It can still be caught while it's dark. It's just harder to see.
- **The hiker passes** with the catches needed before their time runs out.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Catches needed **(setting)** | [3] | [3] | [3] | [3] | [3] |
| Time per hiker **(setting)** | [15 s] | [15 s] | [15 s] | [15 s] | [15 s] |
| Ring size (across, units) | [30] | [26] | [22] | [19] | [16] |
| Firefly speed (units/s) | [60] | [75] | [90] | [100] | [110] |
| Ring drift (units/s) | [12] | [20] | [30] | [40] | [45] |
| A miss costs | nothing | [1 s] | [1 s] | [1 s] | [1 s] |
| Dark for | never | never | [0.4 s] | [0.5 s] | [0.6 s] |

---

## 3. Size Up (the size match)
A ranger's field guide shows a nature find at its actual size. The same thing lies on the trail, the wrong size and turned around. Grow or shrink it to match. See `mockups/quick-games/3-size-up.png` and `4-size-up-reveal.png`.

### The screen
- **Left, FIELD GUIDE:** `guide-page.png` with the sketch (`object-<name>-sketch.png`) in the middle and "<NAME>, ACTUAL SIZE" under it. Each turn, the sketch is drawn at a random [2.5–3.5×], so a size can't be memorized.
- **Right, ON THE TRAIL:** `ground.png` with the find (`object-<name>.png`).
  - It starts [20–40%] too big or too small, never within the pass range.
  - It's turned or mirrored by tier (the table).
  - Its top half and bottom half are two tap areas, each with a thin frame and a hint: "+ TAP TOP HALF TO GROW" and "- TAP BOTTOM HALF TO SHRINK".
- **Finds:** pinecone, acorn, mushroom, maple leaf, feather, paw print.
- **Scaling:** draw the finds with nearest-neighbor at screen resolution, not snapped to scene units, so small steps still show.

### Play
- **Grow:** tap the top half, or press Up or W. **Shrink:** tap the bottom half, or press Down or S. Each tap changes the size by the tier's step.
- **Holding** repeats every [0.1 s] after [0.35 s].
- **Locking in:** Space, Enter, or a LOCK IN button under the panels. Otherwise the size locks when time runs out.
- **The reveal** ([1.5 s]):
  - the find slides over the sketch as an outline in the hiker's color;
  - a label shows "N% OFF" and PASSED or FAILED;
  - N is how far the hiker's size is from the sketch's size: |their scale ÷ sketch scale − 1| × 100, rounded.
- **One try per hiker,** with a new find each turn.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Step per tap | [4%] | [3%] | [2%] | [1.5%] | [1%] |
| Pass within | [8%] | [6%] | [5%] | [4%] | [3%] |
| Time per hiker **(setting)** | [12 s] | [10 s] | [9 s] | [8 s] | [7 s] |
| Turned | upright, same way | any angle | any angle, sometimes mirrored | any angle, sometimes mirrored | any angle, sometimes mirrored |
| Finds | pinecone, acorn, mushroom, leaf | the same four | all six | all six | all six |

---

## 4. Safari (Wildlife)
The party watches animals come down a hillside, then answers a question together (two questions with 3 or more hikers). See `mockups/quick-games/5-safari-parade.png`, `6-safari-question.png` and `7-safari-night.png`.

### Watching
- **The scene:** `bg.png` (a hillside meadow with a game trail down the middle), from y 22 to 202, with [3] bushes (`bush.png`) at random spots.
- **The animals:**
  - they come in at the top, walk down toward the party, and leave at the bottom;
  - they face you, with two walking frames (`animal-<name>-1` and `-2`) swapping every [0.25 s];
  - **birds** fly across from side to side in a zigzag.
- **The animals:** deer, raccoon, turkey, rabbit, fox, bear and bird (`art/safari/`).
- **Speeds:** each kind gets its own walking speed in a run, inside the tier's range. The fastest kind is at least [1.4×] as fast as the next one, and the slowest is at most [0.7×] the next one, so "fastest" and "slowest" questions have a clear answer.
- **What they do** (from the tier in the table):
  - **stop and look around** for [0.6–1.5 s], with a "?" above them;
  - **walk in herds** of [2–3] of the same kind;
  - **turn back:** they walk back up and out the top;
  - **hide in a bush:** they walk behind one and don't come out.
- **The bottom bar:** "WATCH CLOSELY. ONE QUESTION AT THE END." ("TWO QUESTIONS" with 3 or more hikers). The top bar's clock shows the watch time running down.

### Night and fog **(setting)**
- **Night** (from Tier III, a [25%] chance):
  - everything outside a flashlight cone is [93%] dark;
  - **the players aim it (Wyatt):** the cone comes up from the bottom middle, and its center line points at the mouse, so the middle of the beam is wherever the mouse is. It follows at once, with no lag;
  - on phones it points at the finger: touch and drag to move it. With keys, Left and Right (or A and D) swing it at [120°/s];
  - the beam is [30°] wide and reaches the top of the scene;
  - an animal in the dark shows only its eyes, as two small light dots.
- **Fog** (from Tier IV, a [25%] chance, never with night): patches of fog drift across and hide [70%] of anything behind them.

### The question
- **The screen dims,** and the question shows in a box, with "QUESTION 1 OF 2" under it when there are two. The answers are on wooden signs (`sign.png`, text drawn in code; for animal answers, a small icon of the animal and its name).
- **Guessing:**
  - the hiker at the front of the line picks a sign;
  - **right:** that hiker and every hiker after them pass;
  - **wrong:** the sign gets a red X, that hiker fails, and the next hiker guesses. A crossed-out sign can't be picked again;
  - **if every hiker guesses wrong,** everyone fails.
- **A second question with 3 or more hikers (Wyatt), as a relay:**
  - on question 1, a right guess passes **only that hiker**;
  - every hiker after them in line goes on to question 2, with the same rules: a wrong guess fails that hiker, and a right guess passes that hiker and everyone after them;
  - if the last hiker in line answers question 1, there's no question 2;
  - question 2 is a different type from question 1, and fresh signs come up.
- **Counting rule:** "see" counts every animal that came into view, even ones that turned back or hid.
- **Number answers:** the signs are a run of numbers around the right one, with the right one at a random place in the run. They're [2] apart at Tier I and [1] apart from Tier II. No sign is below 0.

### Questions by tier
- **Tier I:** "HOW MANY <ANIMALS> DID YOU SEE?"
- **Tier II adds:**
  - "WHICH ANIMAL CAME FIRST?" and "WHICH CAME LAST?";
  - "WHICH WAS MOVING FASTEST?" and "WHICH WAS MOVING SLOWEST?" (from Wyatt's first notes);
  - "WERE THERE MORE <A> OR <B>?" (signs: A, B, THE SAME).
- **Tier III adds:**
  - "WHICH ANIMAL NEVER SHOWED UP?" (one sign is a kind that didn't come);
  - "HOW MANY TURNED BACK?" and "HOW MANY HID IN A BUSH?"
- **Tiers IV and V add:**
  - "HOW MANY ANIMALS DID YOU SEE IN ALL?";
  - "HOW BIG WAS THE BIGGEST HERD?"
- **Making it fair:** the run is planned first, then the question is picked, and the run must fit it. A question about a kind needs at least one of that kind, and "first" or "last" can't be part of a herd that came in together.

### Bigfoot (from Tier III)
- **How rare:** [5%] of runs at Tier III, [8%] at Tier IV, [10%] at Tier V.
- **What he does:** he crosses once, quickly ([2 s]), partly behind a bush.
- **When he shows, question 1 is always about him** (Wyatt: rarer and harder). Question 2, if there is one, is a normal one:
  - "WHICH ANIMAL CAME RIGHT BEFORE BIGFOOT?";
  - "WHICH ANIMAL WAS OUT WHEN BIGFOOT WENT BY?" (plan the run so exactly one other kind is on screen while he crosses);
  - "WHEN DID BIGFOOT SHOW UP?" (signs: EARLY, MIDDLE, LATE, meaning the first, middle and last third of the watch time).

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Watch time | [15 s] | [18 s] | [20 s] | [22 s] | [25 s] |
| Animals that come | [8] ±[2] | [10] ±[2] | [12] ±[2] | [14] ±[2] | [16] ±[2] |
| Kinds in a run | [3] | [4] | [5] | [6] | [7] |
| Most on screen at once | [3] | [4] | [5] | [6] | [6] |
| Time to walk down | [5–8 s] | [4.5–7 s] | [4–6.5 s] | [3.5–6 s] | [3–5.5 s] |
| What they do | walk straight | + stop, herds, birds | + turn back, hide | all, more often | all, more often |
| Answer signs | [3] | [4] | [4] | [5] | [5] |
| Night | no | no | [25%] | [25%] | [25%] |
| Fog | no | no | no | [25%] | [25%] |
| Bigfoot | no | no | [5%] | [8%] | [10%] |

---

## 5. Fly Swatter
Flies are heading for the picnic. Circles pop up where each one will land: tap a circle before it shrinks away and the fly gets there. See `mockups/quick-games/8-fly-swatter.png`.

### Play
- **The scene:** `bg.png` (a checked picnic blanket with food on the grass). Circles appear inside x [40–280] and y [40–180].
- **A circle:**
  - appears at full size at a random spot, drawn in the active hiker's color with a thin light inner ring and a dot in the middle;
  - shrinks to nothing over the tier's time;
  - a fly (`fly-1` and `-2`, swapping every [0.08 s]) flies in from off screen toward the dot, with a dotted trail, and arrives just as the circle disappears.
- **Tap, click or press Space with the mouse over it,** anywhere inside the circle:
  - **a swat:** the cursor slaps (`swatter-ready` → `swatter-swat` for [0.15 s]), `splat.png` stays for [0.6 s], and the fly is gone;
  - where two circles overlap, the tap swats the one closest to disappearing.
- **A strike:**
  - the circle disappears and the fly lands on the food;
  - from Tier III, a tap that hits no circle;
  - tapping a bee circle (below).
- **Bees (from Tier III, setting):** some circles are bee circles: a dashed light outline, with a bee (`bee-1` and `-2`) heading in. Leave them alone: letting one shrink away is fine, and tapping it is a sting (a strike, and the screen shakes for [0.3 s]).
- **Each hiker's round:** the tier's number of flies, one after another, with several circles up at once at higher tiers. The top bar shows "SWATS n/N".
- **The hiker passes** if they finish the round with strikes to spare. At [3] strikes they fail, and the round stops. The squares in the bottom bar are strikes left.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Flies per hiker | [8] | [10] | [12] | [14] | [16] |
| Circle size (across, units) | [44] | [40] | [36] | [32] | [28] |
| Shrink time | [1.6 s] | [1.4 s] | [1.2 s] | [1.0 s] | [0.9 s] |
| A new circle every | [1.0 s] | [0.8 s] | [0.7 s] | [0.6 s] | [0.5 s] |
| Most circles up at once | [1] | [2] | [3] | [3] | [4] |
| Bee circles **(setting)** | none | none | [15%] | [20%] | [25%] |
| Strikes allowed **(setting)** | [3] | [3] | [3] | [3] | [3] |
| A tap on nothing is a strike | no | no | yes | yes | yes |

---

## 6. Raccoon Shuffle (the challenge version)
**Revised again November 26: see `22-minigame-revisions.md`, section 1.**

Raccoons hide in trash bins, then the bins get shuffled like the cup-and-ball game. Find an empty bin. Each hiker gets their own shuffle (Wyatt). The opportunity version comes later. See `mockups/quick-games/9-raccoon-shuffle-show.png`, `10-raccoon-shuffle-swap.png` and `11-raccoon-shuffle-night.png`.

### Play
- **The scene:** `bg.png` (a trailhead pad at dusk with a forest edge). The bins stand in one row on the line at y [150], spaced evenly across the screen.
- **The bins:** Whackoon's ribbed cans, `art/whackoon/can.png` and `can-open.png`.
- **1. The show** (the tier's show time; the top bar says WATCH):
  - every lid opens;
  - in most bins, a raccoon (`art/whackoon/raccoon-up.png`) pops up, holding up `card.png` with the resource it would steal from **this hiker** in the middle;
  - the empty bins show `tag-empty.png` with EMPTY on it;
  - then the raccoons duck and the lids close.
- **What the raccoons would steal:**
  - each one is picked at random from the active hiker's own inventory, using the game's own resource icons;
  - if the hiker has nothing a raccoon could take, its card shows the energy icon instead (that raccoon takes [1] energy).
- **2. The shuffle** (the top bar shows "SWAP n/N"):
  - two bins swap places: one lifts and arcs over, the other slides under;
  - from Tier IV, two pairs can swap at the same time.
- **3. The pick** (the top bar says PICK): tap or click a bin, or use Left and Right and then Space. That bin opens:
  - **empty:** the hiker passes and loses nothing;
  - **a raccoon:** the hiker fails. The raccoon pops up with its card, and the item flies off with it (the hiker loses it).
  - Failing here costs only the stolen item, not energy.
- **Then** the other bins open for [1 s], so everyone can see where things went, and the next hiker gets a new fill and a new shuffle.

### Night **(setting)**
- **When:** from Tier III, at the chance in the table (revised November 26).
- **The dark:** everything is [93%] dark except a circle of light around the mouse, [40] units across, with a soft [6]-unit edge. It's dark through the whole round, the show included, so you have to follow the bins with the light.
- **On phones:** the light sits where the finger last touched, and dragging moves it. With keys, the light follows the selected bin.

### Revised November 26: harder, and better cards
- **Why it was easy:**
  - few bins, with a lot of them empty (2 of 5 empty at Tier III is a 40% coin flip);
  - slow, steady swaps of neighbors that are easy to follow;
  - a long show.
- **Harder numbers:** the table below replaces the old one.
- **Swaps speed up:** each shuffle starts at the tier's first swap time and speeds up evenly to its last swap time by the final swap. There's no pause between swaps.
- **Far swaps:** a share of swaps are between bins that aren't neighbors (the table). They arc higher ([+10] units) so they pass over the bins between them.
- **Fake-outs** (from Tier II):
  - two bins lift and start to cross as if swapping, then go back to their own spots;
  - a fake-out takes one swap's time but doesn't count as a swap;
  - it can happen alongside a real swap when two swaps at once are on.
- **The cards:**
  - draw the resource on the GPS screen with the new green pixel icons, `art/resources-green/<id>.png` (12 × 12, outline included). Energy is `energy.png`;
  - put the icon at **(4, 1)** inside `card.png` at 1:1, so it fills the card's light square exactly. Don't scale it, and drop the old 14 × 14 box with the 12 px painted icon, which sat 2–3 px low;
  - see `mockups/challenge-popup/raccoon-cards-before.png` and `raccoon-cards-after.png`.
- **Show the empty bins** (the testing tab's tuning helper) must default to **Off**.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Bins | [4] | [5] | [6] | [7] | [8] |
| Empty bins | [1] | [1] | [1] | [1] | [1] |
| Swaps | [7] | [9] | [11] | [13] | [15] |
| Time per swap (first → last) | [0.5 → 0.35 s] | [0.45 → 0.3 s] | [0.4 → 0.26 s] | [0.36 → 0.22 s] | [0.32 → 0.2 s] |
| Far swaps | [30%] | [45%] | [60%] | [70%] | [80%] |
| Fake-outs (of swap steps) | none | [15%] | [20%] | [25%] | [30%] |
| Two swaps at once | no | [20%] | [35%] | [50%] | [60%] |
| Show time | [2.2 s] | [2.0 s] | [1.8 s] | [1.6 s] | [1.5 s] |
| Night | no | no | [20%] | [30%] | [35%] |

---

## 7. Art
All placeholder art is in the GPS greens.

**`art/trail-blazes/`**
- `bg.png` (320 × 200): deep woods, side view.
- `trunk.png` (44 × 64): repeats up and down.
- `blaze.png` and `blaze-lit.png` (16 × 22): a painted blaze with a drip. The hiker-colored frame around the lit pair is drawn in code.

**`art/firefly-catch/`**
- `bg.png` (320 × 200): the night meadow.
- `firefly.png` and `firefly-dim.png` (15 × 15).
- `jar-0.png` to `jar-3.png` (22 × 26): the bottom-bar jar with 0 to 3 fireflies. Past 3, keep `jar-3`.
- The ring is drawn in code.

**`art/size-up/`**
- `guide-page.png` and `ground.png` (140 × 150): the two panels.
- `object-<name>.png` and `object-<name>-sketch.png` (32 × 32): `pinecone`, `acorn`, `mushroom`, `leaf`, `feather`, `paw`.

**`art/safari/`**
- `bg.png` (320 × 180): the hillside meadow.
- `animal-<name>-1.png` and `-2.png`: `deer`, `raccoon`, `turkey`, `rabbit`, `fox`, `bear`, `bird` and `bigfoot` (from 20 × 14 for the bird to 30 × 46 for Bigfoot).
- `bush.png` (44 × 26) and `sign.png` (70 × 30).

**`art/fly-swatter/`**
- `bg.png` (320 × 200): the picnic blanket.
- `fly-1.png` and `fly-2.png` (14 × 12), `bee-1.png` and `bee-2.png` (16 × 14): wings up and down.
- `swatter-ready.png` and `swatter-swat.png` (34 × 46): the cursor. Its hot spot is the middle of the mesh.
- `splat.png` (16 × 14).
- The circles are drawn in code.

**`art/raccoon-shuffle/`**
- `bg.png` (320 × 200): the trailhead pad.
- `card.png` (20 × 26): the card a raccoon holds up. Draw the resource icon centered in its top square (14 × 14).
- `tag-empty.png` (30 × 11): the EMPTY tag (text drawn in code).
- **Reused:** `art/whackoon/can.png`, `can-open.png` and `raccoon-up.png`.
- **Resource icons:** use the game's own. The icons in the mockup are placeholders.

---

## 8. Testing tab
- **Under Reaction and timing:**
  - **Trail Blazes:** Tier, Hikers, Mode (Tries or Clock), Tries (Auto, 1 to 5);
  - **Firefly Catch:** Tier, Hikers, Catches (Auto, 1 to 6), Time (Auto, 5 to 30 s);
  - **Size Up:** Tier, Hikers, Find (Random or each one), Time (Auto, 4 to 20 s), and **Show % live** (shows how far off you are while playing, for tuning).
  - **Fly Swatter:** Tier, Hikers, Bees (Auto, On, Off), Strikes (Auto, 1 to 5).
- **Under Guess and luck:**
  - **Raccoon Shuffle:** Tier, Hikers, Night (Auto, On, Off), and **Show the empty bins** (marks them through the shuffle, for tuning).
- **Under Memory:**
  - **Safari:** Tier, Hikers, Version (Auto, Day, Night, Fog), Questions (Auto, 1, 2), Bigfoot (Auto, Always, Never), Question (Random or each type), and **Show answer** (shows the counts in a corner, for tuning).

---

## 9. Tests
- **Trail Blazes:**
  - "level" uses the blazes' centers and the tier's distance;
  - a lit pair that passes without a tap is a miss;
  - a new pair always starts at least [80] units apart;
  - Tries and Clock modes both end the turn correctly.
- **Firefly Catch:**
  - a catch needs the firefly's center inside the ring;
  - the firefly and the ring never leave the box;
  - a new firefly starts at least [60] units from the ring;
  - a dark firefly can still be caught.
- **Size Up:**
  - the starting size is never within the pass range;
  - the % off matches the formula, and passing matches the tier;
  - holding repeats, and time running out locks the size in.
- **Safari:**
  - for every question type, the answer matches what was shown (keep a log of the run and check it);
  - the right answer is always on a sign, there are no repeated signs, and no number is below 0;
  - a wrong guess fails only that hiker, and a right guess passes that hiker and everyone after them;
  - with 3 or more hikers: a right guess on question 1 passes only that hiker, the rest go to question 2, and there's no question 2 when the last hiker answers question 1;
  - "fastest" and "slowest" always have a clear answer;
  - the beam's center line goes through the mouse;
  - a Bigfoot question only comes when he showed up.
- **Fly Swatter:**
  - each fly arrives just as its circle disappears;
  - a tap inside a circle swats it, and overlapping circles swat the one closest to disappearing;
  - landed flies, stray taps (from Tier III) and bee taps are strikes, and letting a bee circle go is not;
  - the round stops at the strike limit.
- **Raccoon Shuffle:**
  - every swap keeps each bin's contents with it, and the bin picked opens with what was put in it;
  - fake-outs never move a bin's contents, and they don't count toward the swaps;
  - swap times speed up from the first to the last, and the far-swap share matches the tier;
  - card icons are the green 12 × 12 icons at (4, 1), unscaled;
  - each card shows something from the active hiker's inventory, or energy when they have nothing;
  - an empty bin passes with no cost, and a raccoon takes exactly the item on its card;
  - each hiker gets a new fill and a new shuffle.
- **All six:** they end on the Challenge Passed or Challenge Failed screen, with the right result for each hiker. Hikers who failed lose [1] energy, except in Raccoon Shuffle, where they lose the stolen item.
