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
- **The animal** sits above the box: `bee-1.png` at 3× for Bees, `bear-head.png` for the bear.
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

## 4. Numbers by tier

| | Tier I | Tier II | Tier III |
| --- | --- | --- | --- |
| Length **(setting)** | [20 s] | [25 s] | [30 s] |
| Lives per hiker **(setting)** | [2] | [2] | [2] |
| Switch every **(setting)** | [5 s] | [5 s] | [5 s] |
| Attack speed | ×[1.0] | ×[1.2] | ×[1.4] |
| Time between attacks | [0.8 s] | [0.6 s] | [0.4 s] |
| Chance the next attack overlaps the current one | [30%] | [50%] | [70%] |
| Most attacks at once | [2] | [2] | [3] |

The testing tab can override the length (10 to 60 s), lives (1 to 3) and switch time (3 to 10 s). "Auto" uses the tier's value.

## 5. Bees

- **Box:** square, [120 × 120], centered.
- **A bee:** `bee-1.png` and `bee-2.png` alternate every [0.1 s]. Mirror them to face the way the bee flies. Hitbox: a circle of radius [2.5]. Base speed: [80] units/s.
- **Patterns.** Pick one at random each time, not the same one twice in a row. Higher tiers mix in the later ones.
  1. **Lane:** [4–6] bees enter from one side and cross in parallel lanes, leaving one gap lane. **Staggered:** each bee in the row starts at its own random delay of [0–0.45 s], so the row comes in ragged and there's room to weave between them.
  2. **Cross:** a lane from the left and a lane from the top at the same time, each with a gap and staggered the same way.
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

### Pacing and overlaps
Wyatt wants more going on at once, with shorter gaps.
- **Gaps:** the next attack starts [0.8 s], [0.6 s] or [0.4 s] after the last one ends, by tier (section 4).
- **Overlaps:** with the tier's chance, the next attack starts while the current one is still running, [0.3–0.8 s] into it. The tier also caps how many run at once.
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
- Pinecones (`pinecone.png`) drop from the top in [3–5] columns, each warned at the top edge.
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
- **Box:** [140 × 110]. Head: `bear-head.png`.
- **Tier I:** Claws (2 curved rows at once), Bite.
- **Tier II adds:** 3 rows of 4 claws, plus Shout and Bear hug *(Claude's ideas; the hug lasts 3 s and other attacks run during it)*.
- **Tier III adds:** 4 rows of claws, double Bite, plus Honey drips *(Claude's idea)*.
- See `mockups/4-bear.png`, `5-bear-claudes-ideas.png` and `10-bear-shout-claws-hug.png`. (Mockup 5 still shows the old Roar rings.)

## 8. Bear with a Sword
- **Box:** [180 × 80]. Head: `bear-head.png`. The sword turns around the same pivot as before.
- **Tier I:** Sword sweep, Claws, Sword jab (straight), Poke-up slide (from below), Wave.
- **More claws during the sword attacks:** while any sword attack is running, a Claws row comes in on top of it with a [40%] chance (Tier I), [60%] (Tier II) or [80%] (Tier III). These extra claws are missiles, so they don't break the "one area attack" rule.
- **Tier II adds:** double swings, more claw rows, 2 jabs and diagonal jabs, poke-ups from the top as well, and waves along either wall.
- **Tier III adds:**
  - the shrinking box, a jab fan, poke-ups from both sides at once;
  - X slash and Thrown sword *(Claude's ideas)*.
- See `mockups/6-bear-with-a-sword.png` and `11-sword-wave-thrown.png`.

## 9. Bobcat
- **Box:** [150 × 110]. Head: `bobcat-head.png`.
- **Tier I:** Pounce (on a random third of the box), fast Claws, Stalk.
- **Tier II adds:** pounces aimed at the sprite and 2 in a row, more fast claw rows, 4 Stalk hops, plus Zigzag dash *(Claude's idea)*.
- **Tier III adds:** the feint pounce and double Claws, plus Landing swipe *(Claude's idea)*.
- See `mockups/7-bobcat.png` and `12-bobcat-stalk-zigzag.png`.

## 10. Squirrel Army
- **Box:** [130 × 120]. Head: `squirrel-head.png`.
- **Tier I:** Rolling acorns (2), Acorn bombs (they sit still), plus Pinecone rain *(Claude's idea)*.
- **Tier II adds:** 3 acorns at once, bombs that roll, plus Wall scurry *(Claude's idea)*.
- **Tier III adds:** 4 acorns, shrapnel from acorns and bombs, and 2–3 bombs at once.
- See `mockups/8-squirrel-army.png` and `13-squirrel-scurry-nuts.png`.

## 11. Wild Predator Stampede
- **Every attack** from every animal (not the Woods Monster), limited to the ones unlocked at this tier, plus Herd rush *(Claude's idea)*.
- **The head** above the box switches to whichever animal is attacking, and the box changes to that animal's shape over [0.4 s]. The sprite is pushed back inside if the box shrinks.
- **Variety:** no attack twice in a row, and no animal more than twice in a row.
- **Overlaps:** follow the pacing rules in section 6. On Tier III the overlapping attacks often come from two different animals.
- **Length:** the tier's length plus [10 s] by default. The Length setting still overrides it.
- See `mockups/9-stampede.png`.

## 12. The Woods Monster (boss)
The monster from the night events, with the cultists as his helpers. **He's meant to be really hard.** See `mockups/14-woods-monster-fire.png` and `15-woods-monster-ritual.png`.

- **The look:**
  - **Head:** `monster-head.png`, a dark shape with antlers and glowing eyes.
  - **Cultists:** two hooded cultists (`cultist.png`) stand beside the box holding candles (`candle.png`). Some attacks come from them.
- **Box:** [170 × 110].
- **Harder than his tier:** he always plays one step up.
  - On Tier I he uses Tier II numbers.
  - On Tier II, Tier III numbers.
  - On Tier III, Tier III numbers plus [20%] speed, a [+20] point overlap chance and one more attack allowed at once.
- **Length:** [40 s] by default. The Length setting still overrides it.
- **Second half (Tier III):** at half time "the woods close in". The box shrinks to [140 × 90] over [1 s], and Darkness can start.

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
6. **The Eye** *(Claude's idea; area)*.
   - A big eye (`eye.png`) opens at the top of the box. Its gaze, a pale cone, sweeps slowly across.
   - Staying in the gaze for [0.3 s] counts as a hit.
7. **Darkness** *(Claude's idea; changer, Tier III second half)*.
   - The box goes dark except for a small light around the sprite, for [4 s].
   - Other attacks keep coming, and warnings still show in the dark.

## 13. Testing tab

- Add **Dodge** to the game list. Settings:
  - **Animal** (Bees, Bear, Bear with a Sword, Bobcat, Squirrel Army, Wild Predator Stampede, Woods Monster);
  - **Attack** (All, or any one attack that animal uses), to practice or tune one attack at a time. With one attack picked, attacks don't overlap;
  - **Overlaps** (Auto, Off, or On), to compare pacing;
  - **Include Claude's ideas** (On or Off, default On);
  - **Show hitboxes** (Off or On), which outlines every hit shape;
  - **Tier**;
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
  - gaps between attacks follow the tier;
  - overlaps happen at about the tier's chance, never with two area attacks or two changers at once, and never beyond the cap.
- **Warnings:** for every bee pattern and every side (including the bottom), the markers show and aren't hidden by the HUD or the screen edge. If they'd be covered, they move inside the box edge.
- **Bees:** bees in one row start at different times, within the stagger window.
- **Claws:** never drawn upside down, whatever the direction or arc.
- **Bear hug:** lasts 3 s, and other attacks run during it.
- **Bobcat:** Stalk aims each hop at the sprite's position at that moment. The Zigzag dash bounces off the wall the right number of times.
- **Woods Monster:** plays one tier up, and the Tier III second half shrinks the box with the sprite pushed inside.
- **Claude's ideas:** switching them off removes every attack marked *(Claude's idea)*.
- **Tiers:** each animal only uses the attacks and variants unlocked at the chosen tier.
- **Squirrel Army:** acorns crack on each bounce and break on the 3rd. Shrapnel only appears on Tier III.
- **Bear hug and the shrinking box:** the sprite is never left outside the box.
- **Honey:** puddles slow the sprite and never count as a hit.
- **Stampede:** the head and the box follow whichever animal is attacking. On Tier III, two attacks overlap sometimes. The Woods Monster's attacks aren't in the Stampede; he stays a boss of his own.
- **Controls:**
  - the sprite never leaves the box, even when the box shrinks (push it back inside);
  - the joystick appears where the finger lands and stops on release;
  - WASD and the arrow keys both work.
