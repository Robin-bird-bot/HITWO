# Minigame: Dodge (animal encounters)

An Undertale-style dodging game. The animal sits above a box. One small sprite for the whole party moves inside the box and dodges attacks that come in from outside.

**Animals:**
- **Bees** and **Bear with a Sword**, built first;
- **Bear**, **Bobcat**, **Squirrel Army** and **Wild Predator Stampede**, added in the second batch;
- later, maybe: mountain lion, rattlesnake, skunk, hawk.

**Revised November 24 (second batch).** What changed:
- Attacks are now a shared **attack library** (section 6) that any animal can use.
- Four new animals (sections 7 to 11; section 8 is the updated Bear with a Sword).
- Bear with a Sword gains bear claws, sword jabs and poke-ups.
- The testing tab gets an **Attack** picker, a **Show hitboxes** switch and an **Include Claude's ideas** switch.

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
- **The animal** sits above the box: `bee-1.png` at 3× for Bees, `bear-head.png` for the bear.
- **The box:** dark inside (G1) with a light border (G8 and G9). Its size and shape depend on the animal, and it can change between attack patterns, growing or shrinking over [0.4 s].
- **Bottom HUD:** the line of hikers in order, each with:
  - their tinted person icon and name;
  - hearts for lives (lit or dim);
  - a light outline on the active hiker;
  - grey with a red slash once out.
- **Warnings:** attacks always warn first. A small "!" marker sits at the edge they come from, or the area they'll hit is hatched. The warning comes **[0.6 s]** before the attack, so it's fair.
- **Reduced motion:** no screen shake, and a softer red flash.

## 4. Numbers by tier

| | Tier I | Tier II | Tier III |
| --- | --- | --- | --- |
| Length **(setting)** | [20 s] | [25 s] | [30 s] |
| Lives per hiker **(setting)** | [2] | [2] | [2] |
| Switch every **(setting)** | [5 s] | [5 s] | [5 s] |
| Attack speed | ×[1.0] | ×[1.2] | ×[1.4] |
| Time between attacks | [1.6 s] | [1.3 s] | [1.0 s] |

The testing tab can override the length (10 to 60 s), lives (1 to 3) and switch time (3 to 10 s). "Auto" uses the tier's value.

## 5. Bees

- **Box:** square, [120 × 120], centered.
- **A bee:** `bee-1.png` and `bee-2.png` alternate every [0.1 s]. Mirror them to face the way the bee flies. Hitbox: a circle of radius [2.5]. Base speed: [80] units/s.
- **Patterns.** Pick one at random each time, not the same one twice in a row. Higher tiers mix in the later ones.
  1. **Lane:** [4–6] bees enter from one side and cross in parallel lanes, leaving one gap lane.
  2. **Cross:** a lane from the left and a lane from the top at the same time, each with a gap.
  3. **Diagonal:** bees fly corner to corner in a staggered line. *(Tier II and up)*
  4. **Zigzag:** [2] bees weave across in a wave. *(Tier II and up)*
  5. **Aimed:** bees fly in from random edge points, aimed at where the sprite is when they launch. *(Tier III)*
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

**Hit shapes:** circles, line segments with a thickness, rectangles, ellipses, and ring bands with a gap. "Show hitboxes" in the testing tab outlines them.

### Claws (Bear, Bear with a Sword, Bobcat)
- **The row:** [3] claw marks (`claw.png`) on Tier I, [4] from Tier II. They're [9] units apart and move together.
- **Straight:** the row crosses the box from the left, right, top or bottom at [90] units/s.
- **Curved swipe (Tier II and up):**
  - the row swings along an arc around a pivot outside the box, like a paw swiping;
  - each claw keeps its own radius, and is turned to face along the arc.
- **Double (Tier III):** a second row comes from the opposite side [0.5 s] later.
- **Warning:** faint claw lines and an arrow at the edge where they'll come in.
- **Hit shape:** each claw is a segment, [14] units long and [1] thick.
- **Bobcat claws:** speed ×[1.25] and a [0.5 s] warning.

### Bite (Bear)
- **The zone:** jaws (`jaw.png` on top, the same flipped below) open around a zone [40 × 26], centered on where the sprite is when the warning starts.
- **Timing:** the jaws slowly open with a "!" for [0.7 s], then snap shut in [0.12 s]. The sprite is hit if it's inside the zone at the snap.
- **Tier III:** two bites in a row. The second aims at where the sprite is when the first snaps.

### Sword sweep (Bear with a Sword, unchanged)
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
- **At once:** Tier I [2], Tier II [3], Tier III [4].
- **Tier III:** a breaking acorn throws [4] pieces of shrapnel away from the wall.
- **Hit shape:** a circle of radius [3].

### Acorn bombs (Squirrel Army)
- **Landing:** a bomb is lobbed in over the top edge to a spot, which is marked [0.6 s] before.
- **Then:** it sits still (Tier I), or rolls slowly at [15] units/s and bounces off the walls (Tier II and up).
- **The fuse:** `bomb` and `bomb-lit` alternate faster and faster for [1.6 s]. The blast radius, [26] units, shows as a pulsing ring the whole time.
- **The blast:** anything inside the radius during the [0.2 s] blast is hit.
- **Tier III:** [8] pieces of shrapnel fly out at [100] units/s.
- **At once:** Tier I [1], Tier II [2], Tier III [2–3].
- **Shrapnel:** `shrapnel.png` flies in straight lines and is removed at the walls. Hit shape: a circle of radius [1.5].

### Roar *(Claude's idea; Bear, Tier II and up)*
- [2–3] rings spread from the bear's mouth (the top middle of the box) at [60] units/s.
- Each ring has one gap, [26] units wide, in a different place, so the player slips through.
- **Hit shape:** the ring band, [2] thick, minus the gap.

### Bear hug *(Claude's idea; Bear, Tier II and up)*
- The side walls squeeze in to [55%] of the width over [0.5 s], hold for [1 s], then go back.
- The sprite is pushed inward. The warning is arrows on both sides.
- It can overlap with Claws.

### Honey drips *(Claude's idea; Bear, Tier III)*
- **Drops:** they fall from the top in [2–3] columns, each column warned with a drip mark. A drop that hits the sprite counts as a hit.
- **Puddles:** each drop leaves a sticky puddle [30 × 10] for [3 s]. Puddles do no damage, but the sprite moves at [50%] speed inside them.

### X slash *(Claude's idea; Bear with a Sword, Tier III)*
Two diagonal slashes cross the whole box, [0.3 s] apart. Each is warned as a line first.

### Thrown sword *(Claude's idea; Bear with a Sword, Tier III)*
The sword spins across the box like a boomerang and comes back on a lower line. Its path is shown as a dotted line first.

### Zigzag dash *(Claude's idea; Bobcat, Tier II and up)*
- The bobcat dashes across the box along a zigzag path, shown as a dotted line [0.7 s] before.
- **Hit shape:** a circle of radius [8] moving along the path.

### Landing swipe *(Claude's idea; Bobcat, Tier III)*
Right after a pounce lands, a row of claws bursts out from the landing spot in one direction.

### Pinecone rain *(Claude's idea; Squirrel Army, Tier I and up)*
- Pinecones (`pinecone.png`) drop from the top in [3–5] columns, each warned at the top edge.
- They bounce once on the floor, then roll off toward the nearer side wall.

### Wall scurry *(Claude's idea; Squirrel Army, Tier II and up)*
A line of [4] squirrels runs all the way around the box, just inside the walls, at [110] units/s. The edges aren't safe while they run.

### Herd rush *(Claude's idea; Stampede)*
- A wall of moose (`moose.png`) charges across from one side. Tiers I and II leave [2] gaps, Tier III [1].
- Warned with arrows at the edge they'll come from.

## 7. Bear
- **Box:** [140 × 110]. Head: `bear-head.png`.
- **Tier I:** Claws (straight, 3), Bite.
- **Tier II adds:** curved swipes and 4 claws, plus Roar and Bear hug *(Claude's ideas)*.
- **Tier III adds:** double Claws, double Bite, plus Honey drips *(Claude's idea)*.
- See `mockups/4-bear.png` and `5-bear-claudes-ideas.png`.

## 8. Bear with a Sword
- **Box:** [180 × 80]. Head: `bear-head.png`. The sword turns around the same pivot as before.
- **Tier I:** Sword sweep, Claws (straight), Sword jab (straight), Poke-up slide (from below).
- **Tier II adds:** double swings, curved Claws, 2 jabs and diagonal jabs, poke-ups from the top as well.
- **Tier III adds:**
  - the shrinking box, a jab fan, poke-ups from both sides at once;
  - X slash and Thrown sword *(Claude's ideas)*.
- See `mockups/6-bear-with-a-sword.png`.

## 9. Bobcat
- **Box:** [150 × 110]. Head: `bobcat-head.png`.
- **Tier I:** Pounce (on a random third of the box), fast Claws.
- **Tier II adds:** pounces aimed at the sprite and 2 in a row, curved fast Claws, plus Zigzag dash *(Claude's idea)*.
- **Tier III adds:** the feint pounce and double Claws, plus Landing swipe *(Claude's idea)*.
- See `mockups/7-bobcat.png`.

## 10. Squirrel Army
- **Box:** [130 × 120]. Head: `squirrel-head.png`.
- **Tier I:** Rolling acorns (2), Acorn bombs (they sit still), plus Pinecone rain *(Claude's idea)*.
- **Tier II adds:** 3 acorns at once, bombs that roll, plus Wall scurry *(Claude's idea)*.
- **Tier III adds:** 4 acorns, shrapnel from acorns and bombs, and 2–3 bombs at once.
- See `mockups/8-squirrel-army.png`.

## 11. Wild Predator Stampede
- **Every attack** from every animal, limited to the ones unlocked at this tier, plus Herd rush *(Claude's idea)*.
- **The head** above the box switches to whichever animal is attacking, and the box changes to that animal's shape over [0.4 s]. The sprite is pushed back inside if the box shrinks.
- **Variety:** no attack twice in a row, and no animal more than twice in a row.
- **Tier III:** sometimes two attacks from two different animals overlap. The second starts [0.8 s] into the first.
- **Length:** the tier's length plus [10 s] by default. The Length setting still overrides it.
- See `mockups/9-stampede.png`.

## 12. Testing tab

- Add **Dodge** to the game list. Settings:
  - **Animal** (Bees, Bear, Bear with a Sword, Bobcat, Squirrel Army, Wild Predator Stampede);
  - **Attack** (All, or any one attack that animal uses), to practice or tune one attack at a time;
  - **Include Claude's ideas** (On or Off, default On);
  - **Show hitboxes** (Off or On), which outlines every hit shape;
  - **Tier**;
  - **Hikers** (1 to 4);
  - **Lives per hiker** (Auto, 1, 2, 3);
  - **Length** (Auto, or 10 to 60 s);
  - **Switch every** (Auto, or 3 to 10 s).
- Same flow as the others: pop-up in test mode, Start, the GPS turns and zooms, Line up, Dodge, results.
- Test mode never touches the save.

## 13. Tests

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
- **Claude's ideas:** switching them off removes every attack marked *(Claude's idea)*.
- **Tiers:** each animal only uses the attacks and variants unlocked at the chosen tier.
- **Squirrel Army:** acorns crack on each bounce and break on the 3rd. Shrapnel only appears on Tier III.
- **Bear hug and the shrinking box:** the sprite is never left outside the box.
- **Honey:** puddles slow the sprite and never count as a hit.
- **Stampede:** the head and the box follow whichever animal is attacking. On Tier III, two attacks overlap sometimes.
- **Controls:**
  - the sprite never leaves the box, even when the box shrinks (push it back inside);
  - the joystick appears where the finger lands and stops on release;
  - WASD and the arrow keys both work.
