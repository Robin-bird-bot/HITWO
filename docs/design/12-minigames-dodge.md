# Minigame: Dodge (animal encounters)

An Undertale-style dodging game. The animal sits above a box. One small sprite for the whole party moves inside the box and dodges attacks that come in from outside. The first two animals are **Bees** and **Bear with a Sword**. More come later: bobcat, mountain lion, rattlesnake, skunk, moose, hawk.

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

## 6. Bear with a Sword

- **Box:** wide, [180 × 80], centered.
- **The bear's head** sits above the box. The **sword** (`sword.png`, drawn at 2×) turns around a pivot above the middle of the box: the hilt at `PIVOT` = (3, 6) in sword pixels. The blade is about [128] units long.
- **Swing:**
  - a warning hatches the half of the box about to be swept, with a "!";
  - then the blade sweeps that half, from pointing straight down to flat sideways (or the mirror for the left side), over [0.35 s];
  - a light trail follows the blade.
  - **A hit** is the player's hitbox touching the blade (a line segment from the pivot) at any frame of the sweep.
  - Sides: left and right at random, but never the same side more than twice in a row.
- **It gets faster:** every swing shortens the warning by [8%], from [0.8 s] down to at least [0.35 s]. The sweep itself also speeds up a little.
- **Tier II and up:** sometimes a **double swing**, one side then straight back across the other, with a [0.3 s] gap.
- **Tier III:** the box sometimes shrinks to [140 × 70] for a few swings.

## 7. Testing tab

- Add **Dodge** to the game list. Settings:
  - **Animal** (Bees, Bear with a Sword);
  - **Tier**;
  - **Hikers** (1 to 4);
  - **Lives per hiker** (Auto, 1, 2, 3);
  - **Length** (Auto, or 10 to 60 s);
  - **Switch every** (Auto, or 3 to 10 s).
- Same flow as the others: pop-up in test mode, Start, the GPS turns and zooms, Line up, Dodge, results.
- Test mode never touches the save.

## 8. Tests

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
- **Controls:**
  - the sprite never leaves the box, even when the box shrinks (push it back inside);
  - the joystick appears where the finger lands and stops on release;
  - WASD and the arrow keys both work.
