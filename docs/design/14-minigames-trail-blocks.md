# Minigames, batch 4, step 1: passing challenges, Trail Blocks, Sleeping Bear, Whackoon

Wyatt added a big set of new challenges. They ship in four steps, and this is the first:
1. **This step:** the passing-challenge rules, the four Trail Blocks, Sleeping Bear and Whackoon.
2. Lane games: Road, River and Critter Crossing, Train! and Rafting.
3. Quick games: Trail Blazes, Firefly Catch, Size Up and Safari.
4. Rock Climb, Sketchy Bridge and Falling Rocks.

These games plug into the same framework as the others (`10-minigames.md`, `11-minigames-puzzles.md`): the challenge pop-up, the party GPS, per-hiker results and the testing tab.

**Test version:**
- placeholder pixel art in the GPS greens (`art/`, plus simple shapes drawn in code);
- no Prepare options yet;
- the same 320 × 240 scene units, scaled up with nearest-neighbor.

Numbers in [brackets] are first guesses. Put them in `balance.ts` with `TODO(wyatt)`, by game and tier. Settings marked **(setting)** are also in the testing tab.

**Categories:** all three games are **Reaction and timing**.

**Tile types:**
- Chop Tree and Whackoon: Forest
- Mine Rockslide: Mountain
- River Flood: River
- Clearing Animals and Sleeping Bear: Wildlife

---

## 1. Passing challenges (a new rule)
Some challenges stand between the party and a tile, and the party has to get past them.

**Which games:**
- **Built in this step:** the four Trail Blocks and Sleeping Bear.
- **Coming in later steps:** the Crossings, Train!, Rafting, Rock Climb, Sketchy Bridge and Falling Rocks.

**The rules:**
- **Hikers who pass** move onto the tile.
- **Hikers who fail** go back to the tile they came from and pay that game's cost.
- **If at least one hiker passes,** the challenge is gone from the tile.
- **If nobody passes:**
  - everyone goes back and loses energy: [1] at Tiers I and II, [2] at Tier III;
  - the challenge stays on the tile, now revealed (face up);
  - hikers can try it again or go another way, and it stays until someone passes it.
- **Trail Blocks are team work:** finishing the work clears the way for everyone, so the whole party moves on. Only hikers whose energy ran out pay (section 2).

**Hooking it up:**
- **If challenges already run from tiles in a run,** apply these rules there.
- **If they don't yet,** return them as part of the result and show them on the results screen. Return:
  - who passes;
  - who goes back, and what each one pays;
  - whether the challenge stays on the tile.
- **Test mode never changes the save.** It only shows the result.

---

## 2. Trail Blocks
**Four versions, one game:** Chop Tree, Mine Rockslide, River Flood and Clearing Animals. The rules are the same and only the move changes. Wyatt wants them about equally hard.

**How often they appear:** they're the most common challenges, especially at Tier I. Higher tiers bring harder versions.

### The screen
See `mockups/1-chop-tree.png` to `4-clear-animals.png`.
- **First-person view:**
  - the obstacle sits on the trail ahead (`bg-trail.png`);
  - the active hiker's arm holds the tool at the bottom right;
  - the sleeve is in that hiker's color, so you can see whose energy is being spent.
- **Top:** the challenge name, the **work bar** (TREE, ROCKS, WATER or ANIMALS: how much is done) and the tier.
- **Bottom:** the energy bar.
- **The timing control:**
  - Chop Tree and River Flood: a dark strip just above the energy bar (y 178–196);
  - Mine Rockslide: a tall bar on the left;
  - Clearing Animals: a ring in the sky.
- **Starting positions** (scene units):
  - tool frames at (160, 72), with the bucket at (160, 58);
  - the tree at (118, 22);
  - the rocks at (30, 66).

### Energy
- **The bar:** each hiker adds the same amount, [24]. It's split into one chunk per hiker, in their colors, in line order.
- **Spending:** energy comes out of the first hiker's chunk.
- **Running out:** when a hiker's chunk is empty, that hiker is out and loses [1] real energy. The next hiker takes over: the sleeve changes color, and the work done so far stays.
- **Costs:**
  - each swing costs [2];
  - a miss costs [4] (missing costs more);
  - a perfect swing gives back [1].
- **If every chunk runs out** before the work is done, everyone fails (section 1).

### Work
| | Tier I | Tier II | Tier III |
| --- | --- | --- | --- |
| Work to clear | [50] + [25] per hiker | [60] + [30] per hiker | [70] + [35] per hiker |

- **A good swing** does [8] to [14] work, depending on how accurate it is.
- **A perfect swing** (the best [15%] of the zone) does [16] and gives back energy.
- **A miss** does nothing.
- **After each swing,** a short animation plays ([0.35 s]) and input waits.
- **Progress shows on the obstacle** in five stages (0 to 4):
  - the notch in the tree gets deeper;
  - there are fewer rocks;
  - the water gets lower;
  - fewer animals are left.
- **Optional:** while tuning, the testing tab can show each swing's work (see section 5).

### Chop Tree (Forest)
- **The bar:** green zones at both ends, with a marker sliding back and forth. Click, tap or press Space to swing.
- **Strength:** the closer to the outer edge, the stronger the swing. Outside the green, the swing misses ("THUNK").

| | Tier I | Tier II | Tier III |
| --- | --- | --- | --- |
| One pass across the bar | [1.2 s] | [1.0 s] | [0.8 s] |
| Each green zone | [16%] | [12%] | [9%] |

- **Art:**
  - `axe-ready`, `axe-raised` and `axe-strike`: a swing goes ready → raised → strike → ready;
  - `tree-0` to `tree-4`.
- **When it's cleared:**
  - "TIMBER!" appears;
  - the tree tips over to the left;
  - it fades to `tree-cleared.png` (a log and a stump), and the party walks on.

### Mine Rockslide (Mountain)
- **The power bar:** a tall bar on the left. Hold to fill it: it rises to the top, then drops back down while you keep holding. Let go to swing.
- **The green zone:** it sits at a random height and moves after every swing. The closer to its middle you let go, the stronger the swing.

| | Tier I | Tier II | Tier III |
| --- | --- | --- | --- |
| Fill to the top | [1.0 s] | [0.85 s] | [0.7 s] |
| Green zone | [24%] | [18%] | [13%] |

- **Art:** `pickaxe-*`, `rocks-0` to `rocks-4` (fewer boulders at each stage), and `rock-chips.png` flying off on a hit.

### River Flood (River)
- **The bar:** several green spots, with a marker sliding back and forth. Click to scoop.
- **Hitting a spot:** scoops water (the closer to the spot's middle, the more), and that spot disappears. When every spot is gone, a new set appears in new places.
- **Outside a spot:** a miss.

| | Tier I | Tier II | Tier III |
| --- | --- | --- | --- |
| Spots | [4] | [4] | [5] |
| Each spot | [10%] | [8%] | [6%] |
| One pass across the bar | [1.3 s] | [1.1 s] | [0.9 s] |

- **Art:**
  - the bucket goes ready → scoop → toss, and `splash.png` flies off to the left on a toss;
  - the water is drawn in code: a G5 fill with `water-surface.png` tiled along its top;
  - the top of the water goes from y [128] when full down to y [196] when it's clear.

### Clearing Animals (Wildlife)
- **The ring:** a ring sits in the sky at (160, 64), radius [26].
- **The circle:** starts [2.2] times the ring's size and shrinks toward the center. Click when its edge is in the ring.
- **Scoring:**
  - **in the ring:** a full hit, stronger the closer to the ring's middle line;
  - **just outside it** (within [5] units): a weak hit, [4] work;
  - **anything else:** a miss;
  - **if the circle shrinks past the ring:** a miss, and a new circle starts.

| | Tier I | Tier II | Tier III |
| --- | --- | --- | --- |
| Shrink time | [1.5 s] | [1.2 s] | [1.0 s] |
| Ring thickness | [10] | [8] | [6] |

- **The crowd:** the animals left match the work left. Each hit whistles [1–2] away: they flip around and run off to the sides.
- **Art:** `whistle-hold`, `whistle-blow` (with `whistle-waves.png`), and `animal-deer`, `-raccoon`, `-turkey` and `-rabbit` (facing you; mirror them to run).

### Tinting the sleeves
- Each tool frame has a matching `-sleeve.png` layer, drawn on top of the tool.
- **The rule:**
  - white → the hiker's color;
  - gray (#9A9A9A) → the hiker's color at [70%] brightness;
  - the dark outline stays.

---

## 3. Sleeping Bear
Red light, green light past a sleeping bear, in side view. See `mockups/5-sleeping-bear.png` and `5b-sleeping-bear-awake.png`.

### Play
- **One hiker at a time,** in line order, walks from the start post on the left to the flag on the right.
- **Walking:** hold Space, the mouse button, or a finger anywhere on the screen. Let go to stop.
- **The bear's cycle:** asleep → stirs (the warning) → awake, looking around → back to sleep.
- **Caught:** moving while he's awake. You get a grace of [0.12 s] after his eyes open.
- **Fake-outs** (Tiers II and III): sometimes he stirs, then goes back to sleep without waking.

| | Tier I | Tier II | Tier III |
| --- | --- | --- | --- |
| Asleep for | [2.5–4.5 s] | [2–4 s] | [1.5–3.5 s] |
| Stir warning | [0.9 s] | [0.7 s] | [0.5 s] |
| Awake for | [1.5–2.5 s] | [1.5–2.5 s] | [1.5–2.5 s] |
| Fake-outs | none | [30%] of stirs | [40%] of stirs |
| Time each hiker adds to the clock | [9 s] | [8 s] | [7 s] |

- **Walking:** [45] units/s. The path is [272] units long (about 6 s of walking).
- **The clock:** one shared clock for the party. It starts at the time per hiker × the number of hikers. When it runs out, everyone who hasn't crossed fails.

### Results (a passing challenge)
- **Caught:**
  - the bear roars;
  - the hiker is out, [loses 1 random resource and gains Bleeding];
  - the next hiker starts from the post.
- **Out of time:** hikers who haven't crossed lose [1] energy.
- **Crossed:** those hikers pass and move on.
- **Failed hikers** stay back.
- **If anyone crosses,** the challenge is gone.

### Art
- **The bear:**
  - `bear-sleep-1` and `bear-sleep-2` (breathing, swapping every [1.2 s]), with `zzz.png` floating up;
  - `bear-stir` (an ear up, an eye cracking), with a "?";
  - `bear-awake` (head up), with a "!";
  - `bear-roar` when he catches someone.
- **Hikers:** `hiker-stand`, `hiker-walk-1` and `hiker-walk-2`. Swap the walk frames every [0.15 s]. The white parts are tinted with the hiker's color, like Dodge.
- **The scene:** `bg.png`, with the bear at (104, 92) and hikers walking at y 157.
- **The bottom bar:** each hiker with WAITING, SNEAKING, ACROSS or CAUGHT.

---

## 4. Whackoon
Whack-a-mole with raccoons popping out of trash cans. See `mockups/6-whackoon.png`.

### Play
- **Turns:** hikers take turns of [10 s] each, in line order.
- **Whacking:** click or tap a raccoon to whack it. The cursor is a frying pan (`pan-ready`, swinging to `pan-whack` on a click).
- **The target:** the team's whacks add up. Reach the target and everyone passes; miss it and everyone fails, losing [1] energy each. Whackoon isn't a passing challenge.
- **Skunks** are the decoys:
  - sometimes a skunk pops up instead of a raccoon;
  - whacking it sprays you: a green cloud (`spray.png`) covers the cans for [1 s], and the turn loses [2 s].

| | Tier I | Tier II | Tier III |
| --- | --- | --- | --- |
| Cans | 3 × 3 | 3 × 3 | 4 × 3 |
| Up for | [1.0 s] | [0.8 s] | [0.6 s] |
| A new one every | [0.7 s] | [0.55 s] | [0.45 s] |
| Most up at once | [2] | [3] | [3] |
| Skunks | none | [15%] | [25%] |
| Target per hiker | [8] | [9] | [10] |

### Art
- **Cans:** `can.png` and `can-open.png` (lid knocked up).
- **Raccoons:** `raccoon-peek` for [0.15 s], then `raccoon-up`. When whacked, `raccoon-bonk` with `stars.png`, then it drops back down.
- **Skunks:** `skunk-peek` and `skunk-up`.
- **The scene:** `bg.png` (a campsite at dusk), with cans in rows at y 62, 110 and 158 and columns at x 95, 160 and 225.
- **The bottom bar:** the team total and each hiker's whacks.

---

## 5. Testing tab
Add the three games under **Reaction and timing**, with these settings:
- **Trail Blocks:**
  - Version (Chop Tree, Mine Rockslide, River Flood, Clearing Animals);
  - tier and hikers;
  - **Show hit quality**, which floats each swing's work number for tuning.
- **Sleeping Bear:** tier, hikers, and Fake-outs (on or off).
- **Whackoon:** tier, hikers, and Skunks (on or off).

**Results screen:** in test mode it lists the passing-challenge result (section 1). Nothing is applied.

---

## 6. Tests
- **Energy:**
  - chunks drain in line order;
  - a hiker whose chunk empties is out, and the next hiker takes over with the work kept;
  - the costs and the perfect refund are right.
- **Trail Block results:**
  - clearing the block moves everyone on, and only hikers who ran out pay;
  - when everyone runs out, they all go back, lose [1] or [2] energy by tier, and the challenge stays revealed.
- **Zones:**
  - Chop Tree is strongest at the outer edges;
  - Mine Rockslide and River Flood are strongest in the middle;
  - perfect hits refund energy.
- **River Flood:** a spot that's hit disappears, and a new set appears once all are gone.
- **The ring:**
  - full hits inside, weak hits within [5] units, misses beyond;
  - a miss when the circle passes the ring.
- **Sleeping Bear:**
  - moving after the grace while he's awake is caught, and moving during a stir is fine;
  - the clock is time per hiker × hikers;
  - fake-outs never wake him.
- **Whackoon:**
  - turns go in order;
  - the team total adds up;
  - a skunk costs [2 s] and fogs the screen.
