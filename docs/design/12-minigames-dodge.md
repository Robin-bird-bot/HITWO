# Minigame: Dodge (animal encounters)

An Undertale-style dodging game. The animal sits above a box. One small sprite for the whole party moves inside the box and dodges attacks that come in from outside.

**Animals:**
- **Bees** and **Bear with a Sword**, built first;
- **Bear**, **Bobcat**, **Squirrel Army** and **Wild Predator Stampede**, added in the second batch;
- the **Woods Monster**, a hard boss, added in the third pass;
- later, maybe: mountain lion, rattlesnake, skunk, hawk.

**Revised November 24 (second batch).** What changed:
- Attacks are now a shared **attack library** (section 6) that any animal can use.
- Four new animals (sections 7 to 11; section 8 is the updated Bear with a Sword).
- Bear with a Sword gains bear claws, sword jabs and poke-ups.
- The testing tab gets an **Attack** picker, a **Show hitboxes** switch and an **Include Claude's ideas** switch.

**Revised November 25, later (Wyatt picked the look).** What changed:
- **Portraits:** Solid + red is the look. The style setting and the P key go away.
- **Portrait motion:** the bee and the Woods Monster float smoothly. The others do a classic idle bob: two rows of pixels drop out every other step, so the top of the head dips. Each head still blinks.
- **Woods Monster:** a new **Long arms** attack (Wyatt's idea), and The Eye becomes **Glare**, fired from his own eyes.

**Revised November 25 (after Wyatt played the tuning update).** What changed:
- **Five challenge tiers.** Animals now play at a **level** (Easy, 1, 2 or 3), and each challenge tier picks which animals show up and at what level (section 4).
- **No overlapping attacks** below Tier V. At Tier V every animal overlaps attacks.
- **Bees:** much easier at first. On Tier I they come one at a time; full rows only at the top level.
- **Squirrel Army:** a new Easy level (one acorn at a time), so it can be a Tier I animal too.
- **Woods Monster:** always at full strength (Level 3), from Tier III up.
- **Portraits, round 3:** one dark color with no outline, like Sans in Undertale (section 3, "Portraits").

**Revised November 25 (portraits, round 2).** Wyatt looked at references and picked a new look for the heads above the box: front-facing, in the style of Undertale and Game Boy Pokémon, two inks with dark outlines, an optional red accent, and a blink and a small bob (section 3, "Portraits"). This replaces the first round from earlier today (flat greens, glow and silhouette).

**Revised November 24 (third pass, after Wyatt played the second batch).** What changed:
- **Pacing:** shorter gaps between attacks, and attacks that overlap (section 6, "Pacing and overlaps").
- **Warnings:** a fix for warnings that didn't show below the box.
- **Bees:** bees in a row come in staggered.
- **Claws:** every claw attack is curved, more rows come at once, and claws are never drawn upside down.
- **Bear:** the Roar is now a directional Shout of small waves, and the Bear hug lasts long enough to combine with other attacks.
- **Bear with a Sword:** more claws during its other attacks, a clearer Thrown sword, and a new **Wave** attack.
- **Bobcat:** a new **Stalk**, faster claws, and a sharper Zigzag dash that bounces off the wall.
- **Squirrel Army:** Wall scurry squirrels now flick nuts at you.
- **New boss: the Woods Monster** (section 12): very hard, with cultist-themed attacks.

**Claude's ideas:** attacks marked *(Claude's idea)* are suggestions added on top of Wyatt's list. They can all be switched off together in the testing tab. Wyatt will keep or cut them after playing.

It plugs into the same framework as the other minigames (`10-minigames.md`, `11-minigames-puzzles.md`): the pop-up, the GPS, the shared **Line up** step, per-hiker results and the testing tab.

**Test version:**
- simple placeholder art in the GPS greens (`art/dodge/`, plus shapes drawn in code);
- no Prepare options yet;
- no choices or menus: it's only the dodging.

Numbers in [brackets] are first guesses. Put them in `balance.ts` with `TODO(wyatt)`. The ones marked **(setting)** are also in the testing tab.

## 1. The party sprite and switching hikers

- **One sprite** stands for the party: a plain person icon (`person.png`, 10 × 12). Its white pixels are tinted in the **active hiker's color**, and the outline stays dark.
- **The active hiker:** the first in the line-up starts. Every **[5 s] (setting)** the next hiker in line still in the game takes over. The order wraps around.
  - For the last [1 s] before a switch, the sprite blinks between the two hikers' colors.
  - The HUD shows a countdown ("NEXT SWITCH IN 2S").
  - The sprite keeps its position when the hiker changes.
- **Hits:** whoever is active when the sprite is hit takes it, and loses 1 life.
  - The sprite flashes red, with a red ring and "FINN −1".
  - Then it blinks safe (no more hits) for [1 s].
- **Lives:** each hiker starts with **[2] lives (setting: 1 to 3)**.
  - A hiker with no lives left is **out** for the rest of the encounter and never switches in again.
  - If the active hiker goes out, the next hiker in line takes over at once, and the switch timer starts over.
  - With one hiker left, there's no switching.
- **End:**
  - Survive until the clock runs out: **[20–30 s] (setting)**, see section 4.
  - If every hiker is out, it ends early.
- **Results:**
  - a hiker with lives left **passes**, and the card shows their hits ("Mom: 1 hit");
  - a hiker who ran out **fails**.
  - Every hit counts for the challenge's effect later. Stakes aren't applied yet.

## 2. Moving

- **Keyboard:** WASD or the arrow keys. Diagonals are normalized.
- **Touch:** a **floating joystick** appears wherever the finger goes down, outside the HUD.
  - The knob follows the finger up to [24 px] from where it started, and the speed scales with the distance.
  - Lifting the finger stops the sprite and hides the joystick.
- **Mouse:** pressing and dragging works like touch.
- **Speed:** [80] units/s. The sprite can't leave the box.
- **Hitbox:** forgiving, a circle of radius [3] units at the center of the sprite's body. Bees, swords and other attacks use simple shapes too: circles, line segments or rectangles.

## 3. The screen

320 × 240 scene units in the GPS greens, like the other minigames. See `mockups/1-bees.png` to `3-hit-switch-joystick.png`.

- **Top HUD:**
  - the animal's name (left);
  - a **SURVIVE** bar that empties as time runs down (middle);
  - the tier (right).
- **The animal** sits above the box as a **portrait** (see "Portraits" below).

### Portraits (revised November 25, round 3)
Same drawings as round 2, drawn the way Undertale draws Sans, but turned around for our light screen:
- **One color:** each head is a solid shape in the screen's dark green (G1). There's no outline.
- **The details are holes:** eyes, mouths, muzzles, inner ears and the lines between parts show the background through them, like the black details on Sans's white head.
- **Pupils and teeth** are bits of the dark green inside those holes.
- **Front-facing**, cute but ferocious: angry brows, fangs.

**The look Wyatt picked: Solid + red** (`art/dodge/portraits/solid-red/`). A few details are red (#C8423A): open mouths, the Woods Monster's and cultists' eyes, the sword bear's headband, the squirrel's helmet band, the bee's stinger and the moose's nostrils. The plain `solid/` folder and the style setting are no longer needed.

**Frames, per portrait** (all the same size, bottoms lined up):
- `<name>.png` and `<name>-blink.png`;
- for the idle-bob animals, also `<name>-bob.png` and `<name>-bob-blink.png`: the same head with two quiet rows of pixels removed and the top padded, so the head dips 2 units while its chin stays put.

- **Size:** 1 px per unit. They're about 40 to 56 units tall.
- **Placement:**
  - Centered at x 160. The images are padded so the face is always in the middle (the sword's hilt and the squirrel's tail stick out to one side).
  - The bottom sits [6] units above the box's top border. Use the box's size at the start of the fight, so the portrait doesn't jump when the box changes size.
  - If that would put the top above y [24], move the box down instead.
- **Blink:** every [3–5 s], at random, show the blink frame for [0.15 s] (the `-bob-blink` one while bobbed). A cultist's blink turns its eyes off.
- **Two kinds of motion,** on top of the blink:
  - **Flying (bee, Woods Monster):** a smooth float, moving up and down along a sine wave and drawn at whole units. Bee: [2] units each way, every [0.8 s]. Woods Monster: [3] units each way, every [1.6 s].
  - **Idle bob (bear, bear with a sword, bobcat, squirrel, moose, cultists):** swap between `<name>` and `<name>-bob` every [0.4 s]. No smooth movement: it's the old-school pixel bob.
  - The two cultists bob out of step with each other.
- **Motion can be turned off** with the Portrait motion setting in the testing tab.
- See `mockups/20-portrait-motion.gif`.
- **Which portrait goes with which animal:**

| Animal | Portrait | What it shows |
| --- | --- | --- |
| Bees | `bee.png` | Big bug eyes, wings out to the sides, a frown with fangs |
| Bear | `bear.png` | Angry brows, an open snarl with fangs |
| Bear with a Sword | `bear-sword.png` | A headband, biting a sword |
| Bobcat | `bobcat.png` | Ear tufts, cheek ruffs, cat eyes |
| Squirrel Army | `squirrel.png` | An acorn-cap helmet and a bushy tail |
| Woods Monster | `woods-monster.png` | Branch antlers, dark eye holes, a jagged grin |
| Woods Monster's helpers | `cultist.png` | One on each side of the monster, their bottoms lined up with his |
| Stampede, during a Herd rush | `moose.png` | Big antlers, snorting |

- **The Stampede** shows the portrait of whichever animal is attacking.
- **Sprites that stay:** the sprites that move inside the box stay as they are (`bee-1` and `bee-2`, `squirrel-run`, `moose`, the claws and so on). The Bobcat's Stalk keeps using its old head sprite.
- See `mockups/16-portraits.png` and `17-in-game-*.png`.
- **The box:** dark inside (G1) with a light border (G8 and G9). Its size and shape depend on the animal, and it can change between attack patterns, growing or shrinking over [0.4 s].
- **Bottom HUD:** the line of hikers in order, each with:
  - their tinted person icon and name;
  - hearts for lives (lit or dim);
  - a light outline on the active hiker;
  - grey with a red slash once out.
- **Warnings:** attacks always warn first. A small "!" marker sits at the edge they come from, or the area they'll hit is hatched. The warning comes **[0.6 s]** before the attack, so it's fair.
  - **Fix:** some warnings below the box didn't show (Wyatt saw it with Bees). They were probably hidden under the bottom HUD or cut off at the screen edge.
  - Draw warnings on their own layer, above the scene and the box.
  - Keep at least [12] units between the box and both HUDs, so markers fit outside it.
  - If a marker would still overlap a HUD or leave the screen, draw it just inside the box edge on a light background.
  - Every group of incoming things gets its marker, on every side it comes from. In a Cross, that's both sides.
- **Reduced motion:** no screen shake, and a softer red flash.

## 4. Tiers and levels (revised November 25)
Challenges now go up to **Tier V**. New animals show up through Tier III, and Tiers IV and V are harder versions of them. Wyatt's call, with Mom in mind: **attacks don't overlap, except at Tier V.**

### Levels
Each animal plays at a **level**, which sets its attacks and numbers:
- **Easy** (new, Bees and Squirrel Army only): see their sections.
- **Levels 1, 2 and 3:** what used to be Tiers I, II and III. In the attack and animal sections below, "Tier I", "Tier II" and "Tier III" now mean **Levels 1, 2 and 3**.

### Who shows up, and at what level
| Animal | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Bees | Easy | 1 | 2 | 3 | 3 + overlaps |
| Squirrel Army | Easy | 1 | 2 | 3 | 3 + overlaps |
| Bobcat | — | 1 | 2 | 3 | 3 + overlaps |
| Bear | — | 1 | 2 | 3 | 3 + overlaps |
| Bear with a Sword | — | — | 2 | 3 | 3 + overlaps |
| Stampede | — | — | 2 | 3 | 3 + overlaps |
| Ants (Nov 26, `21`) | — | 1 | 2 | 3 | 3 + overlaps |
| Bear with a Gun (Nov 26, `21`) | — | — | 2 | 3 | 3 + overlaps |
| Woods Monster | — | — | 3 | 3 | 3 + overlaps + boss boost |

**How common:** when a Dodge animal is picked at random for a tier, use these weights. The Woods Monster isn't in this pool: he comes from the night monster event, at Tier III and up.

| Animal | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Bees | [60] | [20] | [5] | [5] | [5] |
| Squirrel Army | [40] | [25] | [10] | [10] | [10] |
| Bobcat | — | [30] | [25] | [20] | [20] |
| Bear | — | [25] | [25] | [25] | [25] |
| Bear with a Sword | — | — | [20] | [20] | [20] |
| Stampede | — | — | [15] | [20] | [20] |
| Ants (Nov 26) | — | [25] | [20] | [20] | [20] |
| Bear with a Gun (Nov 26) | — | — | [20] | [20] | [20] |

### Numbers by tier
| | Tier I | Tier II | Tier III | Tier IV | Tier V |
| --- | --- | --- | --- | --- | --- |
| Length **(setting)** | [20 s] | [25 s] | [30 s] | [30 s] | [35 s] |
| Lives per hiker **(setting)** | [2] | [2] | [2] | [2] | [2] |
| Switch every **(setting)** | [5 s] | [5 s] | [5 s] | [5 s] | [5 s] |
| Overlaps | none | none | none | none | [60%] chance, up to [3] at once |

### Numbers by level
| | Easy | Level 1 | Level 2 | Level 3 |
| --- | --- | --- | --- | --- |
| Attack speed | ×[0.85] | ×[1.0] | ×[1.2] | ×[1.4] |
| Time between attacks | [1.0 s] | [0.8 s] | [0.6 s] | [0.5 s] |

- **The Stampede** plays every attack at its own level. Bee and Squirrel attacks in it use the numbered levels, never Easy.
- **The testing tab** can override the length (10 to 60 s), lives (1 to 3), switch time (3 to 10 s) and the level. "Auto" uses the tier's value.

## 5. Bees

- **Box:** square, [120 × 120], centered.
- **A bee:** `bee-1.png` and `bee-2.png` alternate every [0.1 s]. Mirror them to face the way the bee flies. Hitbox: a circle of radius [2.5]. Base speed: [80] units/s.
- **Patterns by level.** Pick one at random each time, never the same one twice in a row. Wyatt: bees are the Tier I animal, so they have to be the easiest.
  - **Easy:**
    - **One at a time:** [6–8] bees fly in one by one from random edge points, each aimed at where the sprite is when it launches, [0.8 s] apart, at [55] units/s;
    - **Pairs:** [2] bees cross side by side in lanes, with a wide gap, [0.6 s] apart.
  - **Level 1:** One at a time ([0.6 s] apart), and **Lane** with [3–4] bees, staggered over [0–0.6 s].
  - **Level 2:** **Lane** ([4–6] bees, staggered over [0–0.45 s]), **Cross** (a lane from the left and one from the top), and **Zigzag** ([2] bees weaving across).
  - **Level 3:** **full rows**, every bee in a lane at once with one gap lane, plus Cross with full rows, **Diagonal** (corner to corner), and **Aimed swarm** ([4] bees at once from random edges, aimed at the sprite).
- Each pattern's bees show "!" markers at their entry edge [0.6 s] before they appear. Bees leave the box on the far side and are removed.

## 6. The attack library

Build attacks as reusable pieces. Each one has:
- an id and a name (shown in the testing tab);
- the tier it starts on;
- its numbers for each tier;
- its warning;
- its moving parts and their hit shapes.

**Defining an animal:** its box size, its head sprite, and the list of attacks it uses. Each round of the encounter picks an attack from that list at random:
- never the same attack twice in a row;
- only attacks unlocked at this tier;
- skipping Claude's ideas when they're switched off.

**Every attack warns first.** The warning time is [0.6 s] unless the attack says otherwise, and never under [0.35 s]. Faster tiers multiply speeds, not warning times.

### Pacing and overlaps
Wyatt wants more going on at once, with shorter gaps.
- **Gaps:** the next attack starts after the level's gap (section 4).
- **Overlaps (Tier V only):** with the tier's chance, the next attack starts while the current one is still running, [0.3–0.8 s] into it, up to the cap. Below Tier V, one attack at a time.
- **Kinds of attack.** Tag every attack as one of these:
  - **area:** it covers a big part of the box (Sword sweep, Shout, Fire tongues, Rune beams, Ritual circle, The Eye, Herd rush);
  - **missile:** things that fly or poke (claws, bees, acorns, nuts, jabs, poke-ups, Wave, pinecones, wisps, hands, pounces);
  - **changer:** it changes the box for a while (Bear hug, the shrinking box, Darkness).
- **Rules that keep it fair:**
  - only one **area** attack at a time, and it always leaves at least [30%] of the box safe;
  - only one **changer** at a time, and other attacks keep coming while it lasts;
  - **missiles** can stack on anything, up to the cap.
- **The Attack picker** in the testing tab turns overlaps off, so a single attack can be studied alone.

**Hit shapes:** circles, line segments with a thickness, rectangles, ellipses, and ring bands with a gap. "Show hitboxes" in the testing tab outlines them.

### Claws (Bear, Bear with a Sword, Bobcat)
- **Always curved (change):** no more straight rows. Each row of [3] claws (Tier I) or [4] (Tier II and up), [9] units apart, swings along an arc around a pivot outside the box, like a paw swiping. Each claw keeps its own radius.
- **More at once (change):** one Claws attack sends [2] rows on Tier I, [3] on Tier II and [4] on Tier III. They come [0.25 s] apart, from different sides, and their arcs cross.
- **Facing (fix):** sometimes a claw was drawn upside down. Turn each claw to point along its direction of travel, with the curved tip leading. Never flip it vertically, and recompute the facing every frame as it swings.
- **Warning:** faint claw lines and an arrow at the edge where they'll come in.
- **Hit shape:** each claw is a segment, [14] units long and [1] thick.
- **Bobcat claws:** speed ×[1.5] (was ×1.25) and a [0.5 s] warning.

### Bite (Bear)
- **The zone:** jaws (`jaw.png` on top, the same flipped below) open around a zone [40 × 26], centered on where the sprite is when the warning starts.
- **Timing:** the jaws slowly open with a "!" for [0.7 s], then snap shut in [0.12 s]. The sprite is hit if it's inside the zone at the snap.
- **Tier III:** two bites in a row. The second aims at where the sprite is when the first snaps.

### Sword sweep (Bear with a Sword, unchanged)
**Removed November 26: replaced by Sword Volley (`22-minigame-revisions.md`, section 5).**

- **The sword** (`sword.png`, drawn at 2×) turns around a pivot above the middle of the box: the hilt at `PIVOT` = (3, 6) in sword pixels. The blade is about [128] units long.
- **Warning:** the half of the box about to be swept is hatched, with a "!".
- **The sweep:** the blade sweeps that half over [0.35 s], from pointing straight down to flat sideways (mirrored for the left side). A light trail follows the blade.
- **Hit shape:** the blade, as a segment from the pivot, at any frame of the sweep.
- **Sides:** left or right at random, never the same side more than twice in a row.
- **Faster each time:** every swing shortens the warning by [8%], from [0.8 s] down to at least [0.35 s], and the sweep speeds up a little.
- **Tier II and up:** sometimes a double swing, one side then straight back across the other, with a [0.3 s] gap.
- **Tier III:** the box sometimes shrinks to [140 × 70] for a few swings.

### Sword jab (Bear with a Sword)
- **The lane:** a thin outlined lane [5] units wide crosses the box from one wall: straight on Tier I, and also diagonal from Tier II.
- **The thrust:** after [0.5 s], the blade thrusts in along the lane to the far wall in [0.12 s], stays [0.15 s], then pulls back.
- **Tier II:** [2] jabs in a row, on different lanes.
- **Tier III:** a fan of [3] jabs from one point on the wall.
- **Hit shape:** the blade, as a segment.

### Poke-up slide (Bear with a Sword)
- **The slide:** the sword slides along just outside one wall, shown by a moving arrow there:
  - Tier I: under the bottom wall;
  - Tier II: under the bottom or over the top;
  - Tier III: both at once, offset.
- **The stabs:** every [28] units along, its tip stabs into the box, up to [45%] of the box's depth, for [0.25 s]. Each stab spot shows a "!" [0.4 s] before.
- **Hit shape:** the tip, as a segment, while it's in the box.

### Pounce (Bobcat)
- **The shadow:** an ellipse [60 × 40] grows from small to full over [0.7 s].
  - Tier I: it lands on a random third of the box.
  - Tier II and up: it's centered on the sprite.
- **Landing:** the bobcat lands, and the sprite is hit if it's inside the shadow at that moment. A small dust ring follows.
- **Tier II:** [2] pounces in a row.
- **Tier III:** a feint. The first shadow fades, and the real one appears [0.4 s] before landing.

### Rolling acorns (Squirrel Army)
- **The throw:** a squirrel (`squirrel-run.png`) pops up at a random point on the edge of the box, with a "!" for [0.6 s]. Then it throws an acorn in at [70] units/s, at least [25°] away from the wall.
- **Bouncing:** acorns bounce off the walls like a mirror.
  - Each bounce cracks them one stage: `acorn-0`, `acorn-1`, `acorn-2`.
  - On the [3rd] wall hit they break into `acorn-crumbs`, which can't hurt and fade over [0.3 s].
- **At once:** Easy [1], Tier I [2], Tier II [3], Tier III [4].
- **Easy:** a single acorn at a time, at [55] units/s, and it breaks on the [2nd] wall hit.
- **Tier III:** a breaking acorn throws [4] pieces of shrapnel away from the wall.
- **Hit shape:** a circle of radius [3].

### Acorn bombs (Squirrel Army)
- **Landing:** a bomb is lobbed in over the top edge to a spot, which is marked [0.6 s] before.
- **Then:** it sits still (Tier I), or rolls slowly at [15] units/s and bounces off the walls (Tier II and up).
- **The fuse:** `bomb` and `bomb-lit` alternate faster and faster for [1.6 s]. The blast radius, [26] units, shows as a pulsing ring the whole time.
- **The blast:** anything inside the radius during the [0.2 s] blast is hit.
- **Tier III:** [8] pieces of shrapnel fly out at [100] units/s.
- **At once:** Easy [1], Tier I [1], Tier II [2], Tier III [2–3].
- **Easy:** the bomb sits still, with a longer fuse ([2.2 s]) and a smaller blast ([20] units).
- **Shrapnel:** `shrapnel.png` flies in straight lines and is removed at the walls. Hit shape: a circle of radius [1.5].

### Shout *(Claude's idea, reworked; Bear, Tier II and up)*
The old Roar's full rings were far too strong. Now it's a directional shout.
- **The waves:** the bear shouts toward where the sprite is, sending a burst of [3–4] small arc waves, each only [40°] wide, [0.2 s] apart.
- **Moving:** the waves spread out as they travel ([60] units/s), like sound.
- **Dodging:** step sideways out of the shout's direction. Tier III sometimes sends two shouts at slightly different angles.
- **Warning:** the bear's mouth glows and a short arrow shows the direction [0.6 s] before.
- **Hit shape:** each wave is an arc band, [2] thick.

### Bear hug *(Claude's idea; Bear, Tier II and up)*
- The side walls squeeze in to [55%] of the width over [0.5 s], hold for **[3 s]** (was 1 s), then go back.
- It's a **changer**: other attacks keep coming while the walls are in. That's the point of it.
- The sprite is pushed inward. The warning is arrows on both sides.

### Honey drips *(Claude's idea; Bear, Tier III)*
- **Drops:** they fall from the top in [2–3] columns, each column warned with a drip mark. A drop that hits the sprite counts as a hit.
- **Puddles:** each drop leaves a sticky puddle [30 × 10] for [3 s]. Puddles do no damage, but the sprite moves at [50%] speed inside them.

### X slash *(Claude's idea; Bear with a Sword, Tier III)*
Two diagonal slashes cross the whole box, [0.3 s] apart. Each is warned as a line first.

### Thrown sword *(Claude's idea; Bear with a Sword, Tier III)*
The sword spins across the box like a boomerang and comes back on a lower line. Wyatt found it hard to read what was happening, so it should be clearer:
- **Before:** the whole path shows first as a dotted line, out along one line and back along the other, with arrowheads at both ends and a curved arrow where it turns.
- **The sword:** draw the full sword sprite spinning (about [2] turns a second). Two fading copies trail behind it, at [50%] and [25%] opacity, with a light arc around it while it spins.
- **The bear:** make him do a throwing pose (his paw sweeps forward) when he throws, and a catching pose when it comes back.
- **Hit shape:** the blade segment, turning with the sprite.

### Wave (Bear with a Sword, Tier I and up)
- **The slide:** the sword slides across the box along the top or the bottom wall. The blade points into the box and dips in and out in a smooth wave, from [0] to [45%] of the box depth.
- **Warning:** the wave's path shows as a dotted curve [0.6 s] ahead of the sword.
- **By tier:** speed [80] units/s on Tier I. On Tier II it can come along either wall. On Tier III two waves come along the top and bottom at once, out of step, so there's a winding safe path between them.
- **Hit shape:** the part of the blade inside the box, as a segment.

### Zigzag dash *(Claude's idea; Bobcat, Tier II and up)*
Wyatt likes this one.
- **Sharper:** the bobcat dashes across the box along a zigzag with sharp turns (about [70°]) and short legs ([18] units).
- **Bouncing:** when it reaches a wall it bounces off and zigzags back. That's [2] passes on Tier II and [3] on Tier III.
- **Warning:** the first pass shows as a dotted line [0.7 s] before. Each bounce shows the next pass [0.4 s] before.
- **Hit shape:** a circle of radius [8] moving along the path.

### Stalk (Bobcat, Tier I and up)
- **Coming in:** the bobcat (its head sprite at half size, or a small body sprite later) comes in at an edge.
- **Hopping:** it dashes toward where the sprite is and lands, [3] times on Tier I and [4] on Tiers II and III.
  - Before each hop, an aim line and the landing ellipse show for [0.45 s] (shorter on higher tiers, never under 0.35 s).
  - Each hop takes [0.25 s], then it crouches for [0.35 s].
- **Leaving:** after the last landing it leaves through the nearest wall.
- **Hit shape:** a circle of radius [7] on the bobcat during each hop and landing.

### Landing swipe *(Claude's idea; Bobcat, Tier III)*
Right after a pounce lands, a row of claws bursts out from the landing spot in one direction.

### Pinecone rain *(Claude's idea; Squirrel Army, Tier I and up)*
- Pinecones (`pinecone.png`) drop from the top in [3–5] columns ([2–3] on Easy), each warned at the top edge.
- They bounce once on the floor, then roll off toward the nearer side wall.

### Wall scurry *(Claude's idea; Squirrel Army, Tier II and up)*
- **Running:** a line of [4] squirrels runs all the way around the box, just inside the walls, at [110] units/s. The edges aren't safe while they run.
- **Nuts (new):** it wasn't doing much, so now each squirrel flicks a nut (`nut.png`) at where the sprite is every [1.2 s] (Tier II) or [0.9 s] (Tier III).
  - The squirrel blinks [0.35 s] before it throws.
  - Nuts fly straight at [90] units/s and are removed at the walls.
  - Hit shape: a circle of radius [2].

### Herd rush *(Claude's idea; Stampede)*
- A wall of moose (`moose.png`) charges across from one side. Tiers I and II leave [2] gaps, Tier III [1].
- Warned with arrows at the edge they'll come from.

## 7. Bear
- **Box:** [140 × 110]. Portrait: `bear.png`.
- **Tier I:** Claws (2 curved rows at once), Bite.
- **Tier II adds:** 3 rows of 4 claws, plus Shout and Bear hug *(Claude's ideas; the hug lasts 3 s and other attacks run during it)*.
- **Tier III adds:** 4 rows of claws, double Bite, plus Honey drips *(Claude's idea)*.
- See `mockups/4-bear.png`, `5-bear-claudes-ideas.png` and `10-bear-shout-claws-hug.png`. (Mockup 5 still shows the old Roar rings.)

## 8. Bear with a Sword
- **Box:** [180 × 80]. Portrait: `bear-sword.png`. The sword turns around the same pivot as before.
- **Tier I:** Sword sweep, Claws, Sword jab (straight), Poke-up slide (from below), Wave.
- **More claws during the sword attacks:** while any sword attack is running, a Claws row comes in on top of it with a [40%] chance (Tier I), [60%] (Tier II) or [80%] (Tier III). These extra claws are missiles, so they don't break the "one area attack" rule.
- **Tier II adds:** double swings, more claw rows, 2 jabs and diagonal jabs, poke-ups from the top as well, and waves along either wall.
- **Tier III adds:**
  - the shrinking box, a jab fan, poke-ups from both sides at once;
  - X slash and Thrown sword *(Claude's ideas)*.
- See `mockups/6-bear-with-a-sword.png` and `11-sword-wave-thrown.png`.

## 9. Bobcat
- **Box:** [150 × 110]. Portrait: `bobcat.png`.
- **Tier I:** Pounce (on a random third of the box), fast Claws, Stalk.
- **Tier II adds:** pounces aimed at the sprite and 2 in a row, more fast claw rows, 4 Stalk hops, plus Zigzag dash *(Claude's idea)*.
- **Tier III adds:** the feint pounce and double Claws, plus Landing swipe *(Claude's idea)*.
- See `mockups/7-bobcat.png` and `12-bobcat-stalk-zigzag.png`.

## 10. Squirrel Army
- **Box:** [130 × 120]. Portrait: `squirrel.png`.
- **Easy (new, Tier I):** Rolling acorns (1 at a time), Acorn bombs (1, sitting still), Pinecone rain (2–3 columns). No Wall scurry.
- **Tier I:** Rolling acorns (2), Acorn bombs (they sit still), plus Pinecone rain *(Claude's idea)*.
- **Tier II adds:** 3 acorns at once, bombs that roll, plus Wall scurry *(Claude's idea)*.
- **Tier III adds:** 4 acorns, shrapnel from acorns and bombs, and 2–3 bombs at once.
- See `mockups/8-squirrel-army.png` and `13-squirrel-scurry-nuts.png`.

## 11. Wild Predator Stampede
- **Every attack** from every animal (not the Woods Monster), limited to the ones unlocked at this tier, plus Herd rush *(Claude's idea)*.
- **The head** above the box switches to whichever animal is attacking, and the box changes to that animal's shape over [0.4 s]. The sprite is pushed back inside if the box shrinks.
- **Variety:** no attack twice in a row, and no animal more than twice in a row.
- **Overlaps:** only at Tier V (section 6), where the overlapping attacks often come from two different animals.
- **Length:** the tier's length plus [10 s] by default. The Length setting still overrides it.
- See `mockups/9-stampede.png`.

## 12. The Woods Monster (boss)
The monster from the night events, with the cultists as his helpers. **He's meant to be really hard.** See `mockups/14-woods-monster-fire.png` and `15-woods-monster-ritual.png`.

- **The look:**
  - **Portrait:** `woods-monster.png`, a tree spirit with branch antlers, dark eye holes with glowing eyes, and a jagged grin.
  - **Cultists:** two hooded cultist portraits (`portraits/<style>/cultist.png`) stand on each side, as before. Some attacks come from them.
- **Box:** [170 × 110].
- **Always at full strength:** he only shows up from Tier III (the night monster event), and always plays Level 3.
  - Tiers III and IV: Level 3, no overlaps.
  - Tier V: Level 3 with overlaps, plus his boss boost: [20%] more speed, a [+20] point overlap chance and one more attack allowed at once.
- **Length:** [40 s] by default. The Length setting still overrides it.
- **Second half (always):** at half time "the woods close in". The box shrinks to [140 × 90] over [1 s], and Darkness can start.

### His attacks
1. **Fire tongues** (Wyatt's idea; area).
   - Tongues of flame (`flame-1.png` and `flame-2.png`, alternating every [0.12 s]) rise from the floor in [5–7] columns with gaps between them.
   - Each column first shows embers on the floor and a "!" below the box, [0.6 s] before.
   - Flames rise to [40–70%] of the box height, flicker for [1.2 s], then sink.
   - **Tier II:** a second set follows at once, in the gaps of the first, so the player has to move across between them.
   - **Tier III:** flames also come down from the ceiling, out of step, leaving a winding path.
   - **Hit shape:** each flame as a tall triangle.
2. **Grasping hands** *(Claude's idea; missile)*.
   - Hands (`hand.png`) burst up from the floor right under the sprite: a chain of [4–6], [0.35 s] apart, each following where the sprite is now.
   - Each is warned by a crack mark [0.4 s] before.
   - They grab for [0.3 s], then sink.
3. **Candle wisps** *(Claude's idea; missile)*.
   - The cultists' candles let loose [3–5] wisps (`wisp.png`) that drift toward the sprite at [35] units/s. They can only turn slowly, so they can be outrun.
   - They fade after [3 s].
4. **Rune beams** *(Claude's idea; area)*.
   - [2–3] lines between points on the walls flash as thin warnings for [0.6 s], then burn as solid beams for [0.4 s].
   - **Tier III:** a 5-line star through the middle, with safe pockets between its points.
5. **Ritual circle** *(Claude's idea; area)*.
   - A ring of runes (`rune.png`) draws itself around where the sprite is, radius [24], over [1.2 s]. When it closes, the inside erupts.
   - Get out before it closes.
6. **Glare** *(was The Eye; now fired from his own eyes; area)*.
   - **Warning:** his eyes flash red for [0.6 s] (a red ring around each eye on the portrait).
   - **The beams:** two pale cones shine from his eyes down into the box, one from each eye. Each cone is [28] units wide at the floor, with thin red edges.
   - **The sweep:** they sweep across the box in opposite directions over [2.4 s], crossing in the middle, so there's a safe gap to slip through.
   - **Hits:** staying in a cone for [0.3 s] counts as a hit.
   - **Drawing:** outside the box, the beams are only their red edges, so the portrait stays clear. Inside the box, each cone is a G4 fill on the dark floor.
   - `eye.png` is no longer used.
   - See `mockups/19-woods-monster-glare.png`.
7. **Long arms** *(Wyatt's idea; missile)*.
   - **The arms:** two long, thin arms in the portrait's style reach out from behind his head.
     - Outside the box they're the dark green, [4] units thick, with a knob at the elbow.
     - Inside the box they turn light (G9), like every attack.
     - The hands are `monster-hand.png` (open) and `monster-hand-grab.png` (closing), with red claw tips. Both point down: turn them to face the way the arm reaches. Inside the box use `monster-hand-light.png` and `monster-hand-grab-light.png`.
   - **Wind-up (the warning):** an arm rises and arches out above and beside him, with the hand hanging toward the box.
     - It aims at where the sprite is; a dotted line in the box shows the aim, and a "!" shows at the box edge.
     - This lasts [0.7 s].
   - **The thrust:** the arm shoots straight down along the aim line into the box over [0.2 s], the hand closes for [0.3 s], then the arm pulls back over [0.4 s].
   - **Rhythm:** [4] thrusts per attack, alternating arms. Each new arm winds up while the other one thrusts.
   - **Hits:** the part of the arm inside the box (a line [4] units thick) and the hand (a circle of radius [6]).
   - See `mockups/18-woods-monster-long-arms.png`.
8. **Darkness** *(Claude's idea; changer, Tier III second half)*.
   - The box goes dark except for a small light around the sprite, for [4 s].
   - Other attacks keep coming, and warnings still show in the dark.

## 13. Testing tab

- Add **Dodge** to the game list. Settings:
  - **Animal** (Bees, Bear, Bear with a Sword, Bobcat, Squirrel Army, Wild Predator Stampede, Woods Monster);
  - **Attack** (All, or any one attack that animal uses), to practice or tune one attack at a time. With one attack picked, attacks don't overlap;
  - **Overlaps** (Auto, Off, or On). Auto means on at Tier V only;
  - **Level** (Auto, Easy, 1, 2, 3). Auto uses the table in section 4;
  - **Include Claude's ideas** (On or Off, default On);
  - **Show hitboxes** (Off or On), which outlines every hit shape;
  - **Portrait motion** (On or Off), for the blink, float and bob;
  - **Tier** (I to V);
  - **Hikers** (1 to 4);
  - **Lives per hiker** (Auto, 1, 2, 3);
  - **Length** (Auto, or 10 to 60 s);
  - **Switch every** (Auto, or 3 to 10 s).
- Same flow as the others: pop-up in test mode, Start, the GPS turns and zooms, Line up, Dodge, results.
- Test mode never touches the save.

## 14. Tests

- **Switching:**
  - the active hiker switches every N seconds in line-up order, skipping hikers who are out;
  - one hiker left means no switching;
  - the sprite's color always matches the active hiker.
- **Hits and lives:**
  - a hit costs the active hiker 1 life, followed by 1 s of safety;
  - a hiker at 0 lives is out and never comes back;
  - if the active hiker goes out, the next one takes over at once.
- **Ending:** it ends when time runs out, or early if everyone is out. Each hiker's pass or fail and hit count are right.
- **Warnings:** every attack shows its warning first.
- **Bear with a Sword:** the warning time never drops below the minimum.
- **Attack picker:** choosing one attack plays only that attack, and it still follows the tier.
- **Pacing:**
  - gaps between attacks follow the level;
  - below Tier V, attacks never overlap;
  - at Tier V, overlaps happen at about the tier's chance, never with two area attacks or two changers at once, and never beyond the cap.
- **Tiers and levels:** each tier only offers the animals in the table, at their level. The Woods Monster is always Level 3.
- **Warnings:** for every bee pattern and every side (including the bottom), the markers show and aren't hidden by the HUD or the screen edge. If they'd be covered, they move inside the box edge.
- **Bees:** on Easy, bees come one at a time. Bees in a staggered row start at different times, within the stagger window; full rows only at Level 3.
- **Claws:** never drawn upside down, whatever the direction or arc.
- **Bear hug:** lasts 3 s, and other attacks run during it.
- **Bobcat:** Stalk aims each hop at the sprite's position at that moment. The Zigzag dash bounces off the wall the right number of times.
- **Woods Monster:** always Level 3, with the boss boost only at Tier V. The second half shrinks the box with the sprite pushed inside.
- **Claude's ideas:** switching them off removes every attack marked *(Claude's idea)*.
- **Tiers:** each animal only uses the attacks and variants unlocked at the chosen tier.
- **Squirrel Army:** acorns crack on each bounce and break on the 3rd. Shrapnel only appears on Tier III.
- **Bear hug and the shrinking box:** the sprite is never left outside the box.
- **Honey:** puddles slow the sprite and never count as a hit.
- **Stampede:** the head and the box follow whichever animal is attacking. At Tier V, two attacks overlap sometimes. The Woods Monster's attacks aren't in the Stampede; he stays a boss of his own.
- **Controls:**
  - the sprite never leaves the box, even when the box shrinks (push it back inside);
  - the joystick appears where the finger lands and stops on release;
  - WASD and the arrow keys both work.
