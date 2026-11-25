# Minigames, batch 4, step 1: passing challenges, Trail Blocks, Sleeping Bear, Whackoon

**Revised November 25, after Wyatt played step 1:**
- **The marker freezes** for [1 s] where you stopped it, in every Trail Block.
- **Chop Tree is harder:** the marker's speed changes at random every time it turns around. The axe switches hands to the side the marker is heading.
- **River Flood is easier:** bigger spots.
- **Clearing Animals:** the shrinking circle is solid and sits under the ring, and they show up in a new spot each time.
- **New art:**
  - the axe, pickaxe, bucket, whistle, pine tree and rock pile are Wyatt's reference sprites, cut out and recolored into the GPS greens. They're credited in `art/trail-blocks/CREDITS.md`;
  - the pickaxe is mirrored across its handle so its long point faces forward (it looked backwards);
  - there's no arm: the tool swings by itself, with a light wash of the active hiker's color over the whole tool;
  - the rock pile gets lower stage by stage, cut along the cracks between stones;
  - ribbed trash cans and a mallet.
- **Sleeping Bear fixes:**
  - the clock counts down smoothly;
  - it stops while the bear is awake;
  - moving while he stirs earns time back.
- **Whackoon:** Claude Code already fixed the colors and everyone-at-once play. This round only adds the new can and mallet art, and the table below to check the numbers against.

**Revised November 25 (same day):** every table runs to Tier V, and Whackoon gets a **Colors** mode (section 4).

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
  - everyone goes back and loses energy: [1] at Tiers I and II, [2] at Tiers III to V;
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
See `mockups/1-chop-tree.png` (and `1b-chop-tree-strike.png`) to `4-clear-animals.png`.
- **First-person view:**
  - the obstacle sits on the trail ahead (`bg-trail.png`);
  - the tool sits at the bottom right on its own, with no arm, and swings by itself;
  - the whole tool has a light wash of the active hiker's color, so you can see whose energy is being spent.
- **Top:** the challenge name, the **work bar** (TREE, ROCKS, WATER or ANIMALS: how much is done) and the tier.
- **Bottom:** the energy bar.
- **The timing control:**
  - Chop Tree and River Flood: a dark strip just above the energy bar (y 178–196);
  - Mine Rockslide: a tall bar on the left;
  - Clearing Animals: a ring in the sky.
- **Starting positions** (scene units):
  - tool frames (160 × 124) at (160, 72); for the axe on the left, the same frames mirrored at (0, 72);
  - the tree (105 × 237) centered at x 160 with its base at y 197. Its top runs up behind the HUD;
  - the rocks (228 × 168) centered at x 160 with their base at y 190.
- **The tools (new):**
  - each tool is a sprite at its own pixel size (`tool-axe` 51 × 44, `tool-pickaxe` 32 × 31, `tool-bucket` 49 × 46, `tool-whistle` 46 × 61);
  - the swing frames (`axe-ready`, `-raised`, `-strike`, `pickaxe-*`, `bucket-*`, `whistle-*`) show them 2× big, turned around the end of the handle (or the rim, or the ring);
  - `bucket-scoop` has water in it.

### Energy
- **The bar:** each hiker adds the same amount, [24]. It's split into one chunk per hiker, in their colors, in line order.
- **Spending:** energy comes out of the first hiker's chunk.
- **Running out:** when a hiker's chunk is empty, that hiker is out and loses [1] real energy. The next hiker takes over: the tool's handle changes color, and the work done so far stays.
- **Costs:**
  - each swing costs [2];
  - a miss costs [4] (missing costs more);
  - a perfect swing gives back [1].
- **If every chunk runs out** before the work is done, everyone fails (section 1).

### Work
| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Work to clear | [50] + [25] per hiker | [60] + [30] per hiker | [70] + [35] per hiker | [80] + [40] per hiker | [90] + [45] per hiker |

- **A good swing** does [8] to [14] work, depending on how accurate it is.
- **A perfect swing** (the best [15%] of the zone) does [16] and gives back energy.
- **A miss** does nothing.
- **After each swing,** a short animation plays ([0.35 s]).
- **The marker freezes (new):** when you click (or let go, in Mine Rockslide), the marker stays exactly where it stopped for [1 s], with a small light frame around it. That way you can see where you landed. Input waits until it moves again.
- **Progress shows on the obstacle** in five stages (0 to 4):
  - the notch in the tree gets deeper;
  - there are fewer rocks;
  - the water gets lower;
  - fewer animals are left.
- **Optional:** while tuning, the testing tab can show each swing's work (see section 5).

### Chop Tree (Forest)
- **The bar:** green zones at both ends, with a marker sliding back and forth. Click, tap or press Space to swing.
- **Strength:** the closer to the outer edge, the stronger the swing. Outside the green, the swing misses ("THUNK").
- **Harder (new):** every time the marker turns around, the speed of its next pass is picked at random from the tier's range, so you can't settle into a rhythm.
- **The axe switches sides (new):**
  - the axe is in the hand on the side the marker is heading toward;
  - heading right: the right hand (the frames as drawn);
  - heading left: the left side (the same frames mirrored, at the left edge);
  - it swaps when the marker turns, sliding out and in over [0.1 s];
  - a swing hits that side of the trunk.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| One pass across the bar (random each pass) | [0.8–1.4 s] | [0.7–1.2 s] | [0.6–1.0 s] | [0.55–0.9 s] | [0.5–0.8 s] |
| Each green zone | [14%] | [11%] | [9%] | [8%] | [7%] |

- **Art:**
  - `axe-ready`, `axe-raised` and `axe-strike`: a swing goes ready → raised → strike → ready;
  - the tree is the pine from Wyatt's reference, `tree-0` to `tree-4` (3× big);
  - notches deepen on both sides of the trunk.
- **When it's cleared:**
  - "TIMBER!" appears;
  - the tree tips over to the left: turn `tree-4` up to 90° around its base over [0.6 s], then let it drop out of view;
  - `tree-stump.png` stays at the base, and the party walks on.

### Mine Rockslide (Mountain)
- **The power bar:** a tall bar on the left. Hold to fill it: it rises to the top, then drops back down while you keep holding. Let go to swing.
- **The green zone:** it sits at a random height and moves after every swing. The closer to its middle you let go, the stronger the swing.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Fill to the top | [1.0 s] | [0.85 s] | [0.7 s] | [0.6 s] | [0.55 s] |
| Green zone | [24%] | [18%] | [13%] | [11%] | [10%] |

- **Art:** `pickaxe-*`, `rocks-0` to `rocks-4` (Wyatt's rock pile, lower at each stage), and `rock-chips.png` flying off on a hit.

### River Flood (River)
- **The bar:** several green spots, with a marker sliding back and forth. Click to scoop.
- **Hitting a spot:** scoops water (the closer to the spot's middle, the more), and that spot disappears. When every spot is gone, a new set appears in new places.
- **Outside a spot:** a miss.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Spots | [4] | [4] | [5] | [5] | [6] |
| Each spot (bigger: it was too hard) | [15%] | [12%] | [10%] | [9%] | [8%] |
| One pass across the bar | [1.3 s] | [1.1 s] | [0.9 s] | [0.8 s] | [0.7 s] |

- **Art:**
  - the bucket goes ready → scoop → toss, and `splash.png` flies off to the left on a toss;
  - the water is drawn in code: a G5 fill with `water-surface.png` tiled along its top;
  - the top of the water goes from y [128] when full down to y [196] when it's clear.

### Clearing Animals (Wildlife)
- **The ring:** a green zone ring, radius [26], drawn in G7 with light edges.
- **A new spot each time (new):** the ring and its circle appear somewhere new for every try, anywhere in x [50–270], y [44–150]. They never cover the tool or the HUD.
- **The circle (changed):** a **solid** dark circle (G2), drawn **under** the ring. It starts [2.2] times the ring's size and shrinks toward the center. Click when its edge is in the ring.
- **Scoring:**
  - **in the ring:** a full hit, stronger the closer to the ring's middle line;
  - **just outside it** (within [5] units): a weak hit, [4] work;
  - **anything else:** a miss;
  - **if the circle shrinks past the ring:** a miss, and a new circle starts.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Shrink time | [1.5 s] | [1.2 s] | [1.0 s] | [0.9 s] | [0.8 s] |
| Ring thickness | [10] | [8] | [6] | [5] | [4] |

- **The crowd:** the animals left match the work left. Each hit whistles [1–2] away: they flip around and run off to the sides.
- **Art:** `whistle-hold`, `whistle-blow` (with `whistle-waves.png`), and `animal-deer`, `-raccoon`, `-turkey` and `-rabbit` (facing you; mirror them to run).

### The hiker's color on the tools
- **The wash (Wyatt):** after drawing a tool frame, lay the active hiker's color over the whole tool at [30%], only where the tool is (its own pixels). No extra files are needed.
- **A new hiker** takes over: the wash changes color.
- **Raccoon masks** (Whackoon) still use the white → color tint.

---

## 3. Sleeping Bear
Red light, green light past a sleeping bear, in side view. See `mockups/5-sleeping-bear.png` and `5b-sleeping-bear-awake.png`.

### Play
- **One hiker at a time,** in line order, walks from the start post on the left to the flag on the right.
- **Walking:** hold Space, the mouse button, or a finger anywhere on the screen. Let go to stop.
- **The bear's cycle:** asleep → stirs (the warning) → awake, looking around → back to sleep.
- **Caught:** moving while he's awake. You get a grace of [0.12 s] after his eyes open.
- **Fake-outs** (Tiers II and III): sometimes he stirs, then goes back to sleep without waking.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Asleep for | [2.5–4.5 s] | [2–4 s] | [1.5–3.5 s] | [1.2–3 s] | [1–2.5 s] |
| Stir warning | [0.9 s] | [0.7 s] | [0.5 s] | [0.45 s] | [0.4 s] |
| Awake for | [1.5–2.5 s] | [1.5–2.5 s] | [1.5–2.5 s] | [1.5–2.5 s] | [1.5–2.5 s] |
| Fake-outs | none | [30%] of stirs | [40%] of stirs | [45%] of stirs | [50%] of stirs |
| Time each hiker adds to the clock | [10 s] | [9 s] | [8 s] | [7.5 s] | [7 s] |

- **Walking:** [55] units/s (was 45). The path is [272] units long (about 5 s of walking).
- **The clock:** one shared clock for the party. It starts at the time per hiker × the number of hikers. When it runs out, everyone who hasn't crossed fails.
- **Clock fixes (Wyatt found it jumping, and it seemed impossible):**
  - **Smooth:** it counts down with real time, by the frame's elapsed time, every frame. It never jumps.
  - **Paused while the bear is awake,** and while a caught hiker is being sent off. You can't lose time standing still while he looks around.
  - **Moving during a stir earns time back:** while the bear is stirring and the hiker is moving, the clock goes **up** at [1] second per second instead of down. It's a risk, because he might wake.
- **It must be beatable:** a test plays a hiker who walks every time the bear sleeps and stops the moment he stirs. On every tier, that hiker crosses with time left.

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

### Play (everyone at once, in colors)
Claude Code already fixed this after Wyatt's playtest. It's written here so the rules stay in one place; check the numbers against the table.
- **Everyone at once:** one shared clock for the party, [8 s] per hiker. The Turns mode and the Mode setting are gone.
- **Colored raccoons:**
  - every raccoon wears a bandit mask in one hiker's color: draw `raccoon-*-mask.png` over the raccoon, with white turned into the hiker's color;
  - colors are dealt out evenly among the hikers;
- **Each hiker** needs a number of whacks on raccoons of their own color (the table below). The bottom bar fills their squares.
- **Done hikers:** when a hiker reaches their number, they pass, but **their raccoons keep popping up**. Whacking one does nothing, and the mallet needs [0.5 s] to swing again. Be choosy.
- **Several up at once:** keep at least the tier's minimum up at all times (the table). When one goes down, another pops up within [0.2 s].
- **When the clock runs out,** hikers who reached their number pass. The rest fail and lose [1] energy each.
- **Whacking:** click or tap a raccoon. The cursor is a mallet (`mallet-ready`, swinging to `mallet-whack` on a click).
- **Not a passing challenge.**
- **Skunks** are the decoys:
  - sometimes a skunk pops up instead of a raccoon;
  - whacking it sprays you: a green cloud (`spray.png`) covers the cans for [1 s], and the clock loses [2 s].
- See `mockups/6-whackoon.png`.

| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Cans | 3 × 3 | 3 × 3 | 4 × 3 | 4 × 3 | 4 × 3 |
| Up for | [1.2 s] | [1.0 s] | [0.8 s] | [0.7 s] | [0.6 s] |
| Fewest up at once | [2] | [2] | [3] | [3] | [3] |
| Most up at once | [3] | [4] | [4] | [5] | [5] |
| Skunks | none | [15%] | [25%] | [30%] | [35%] |
| Whacks needed per hiker | [5] | [6] | [7] | [8] | [9] |

### Art
- **Cans (new art):** `can.png` (a ribbed metal can with a lid and handle) and `can-open.png` (lid knocked up). They're 36 × 44 now: draw them [4] units higher than before.
- **Raccoons:** `raccoon-peek` for [0.15 s], then `raccoon-up`. When whacked, `raccoon-bonk` with `stars.png`, then it drops back down.
- **Skunks:** `skunk-peek` and `skunk-up`.
- **The scene:** `bg.png` (a campsite at dusk), with cans in rows at y 62, 110 and 158 and columns at x 95, 160 and 225.
- **The bottom bar:** each hiker's token, name and squares (DONE when finished).
- **The frying pan** (`pan-*.png`) is replaced by the mallet and can be deleted.

---

## 5. Testing tab
Add the three games under **Reaction and timing**, with these settings:
- **Trail Blocks:**
  - Version (Chop Tree, Mine Rockslide, River Flood, Clearing Animals);
  - tier and hikers;
  - **Show hit quality**, which floats each swing's work number for tuning.
- **Sleeping Bear:** tier, hikers, and Fake-outs (on or off).
- **Whackoon:** tier, hikers, and Skunks (on or off). The Mode setting is gone.

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
  - a miss when the circle passes the ring;
  - a new spot every try, never over the tool or the HUD.
- **The marker freeze:** after a click or release, the marker holds for [1 s] and input waits.
- **Chop Tree:**
  - each pass picks a new speed within the tier's range;
  - the axe is always on the side the marker is heading.
- **Sleeping Bear:**
  - moving after the grace while he's awake is caught, and moving during a stir is fine and earns time back;
  - the clock is time per hiker × hikers, goes down smoothly, and stops while he's awake;
  - the "walk only while he sleeps" player always crosses in time, on every tier;
  - fake-outs never wake him.
- **Whackoon:**
  - raccoons show their hiker's color in the game;
  - each hiker only counts their own color, and a done hiker's raccoons do nothing when whacked and cost the [0.5 s] pause;
  - the number of raccoons up never drops below the tier's minimum;
  - a skunk costs [2 s] and fogs the screen.
