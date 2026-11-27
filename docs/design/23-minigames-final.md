# The last minigame batch: Sketchy Bridge, Falling Rocks, Fly Block, Squirrel Theft, Birdsong, Minefield, Thin Ice (new), Pack It Up, and three Dodge animals

Wyatt's final games run before the games go onto the trail map (November 26). After this, the next phase is hooking challenges up to tiles.

Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`. Mockups are in `mockups/final-games/`. Rules marked *(Claude's idea)* are mine; everything else is Wyatt's.

**What's in it:**
- **New games:**
  - Sketchy Bridge (Wyatt; Stardew-style balance; replaces Cracked Bridge);
  - Falling Rocks (a side-view slope crossing);
  - Fly Block (Wyatt; Tempest-style; it was "Block the Flies");
  - Squirrel Theft (Wyatt; a shooting gallery);
  - Birdsong (Wyatt; Simon with colored notes);
  - Pack It Up *(Claude's idea; Wyatt approved)*.
- **Thin Ice becomes Minefield** (Wyatt): today's Minesweeper game is reskinned as the Dog Waste Zone, with doggy bags instead of flags.
- **A new Thin Ice:** cross the ice; every hiker needs their own way across, because the ice cracks behind each one.
- **Dodge:**
  - the Eagle, which changes by tier: Eagle, then Toupeeagle, then Freeagle;
  - the Snow Leopard and the Abominable Snowgirl, on ice.
- **Dropped for now** (Wyatt): Frost Fire, and the Knowledge category (trivia).

**Categories:**

| Game | Category | Passing challenge? | Fits these challenges (for the challenge table later) |
| --- | --- | --- | --- |
| Sketchy Bridge | Movement and dodging | yes | Cracked Bridge (replaced by it) |
| Falling Rocks | Movement and dodging | yes | Rockfall, Mudslide |
| Fly Block | Reaction and timing | no | Flies, Gnats, Mosquito Swarm |
| Squirrel Theft | Reaction and timing | no (all or nothing) | Annoying Squirrel, Crow Collector |
| Birdsong | Memory | no | Warning Bird, Echo Canyon, Rock Band |
| Minefield | Puzzle and logic | no (as Thin Ice is now) | Dog Waste Zone |
| Thin Ice (crossing) | Puzzle and logic | yes | Thin Ice |
| Pack It Up | Puzzle and logic | no | Torn Pack, Cracked Pots |
| Dodge: Eagle | Movement and dodging | as Dodge | Majestic Eagle, Toupee Eagle, Freeagle |
| Dodge: Snow Leopard, Snowgirl | Movement and dodging | as Dodge | Snow Leopard, Abominable Snowgirl |

Passing challenges follow `14-minigames-trail-blocks.md`, section 1. The others follow the quick-game rule: each hiker passes or fails, and failing costs [1] energy unless the game says otherwise. Every game also needs its pop-up content (section 10), a demo bot, and a testing-tab entry (section 12).

---

## 1. Sketchy Bridge (Wyatt; a passing challenge)

**November 26 (evening): a bigger zone at low tiers, a gentler zone and icon, and a steady integrity bar. See `26-fixes-and-wyatt-trees.md`, sections 1 and 4, which win.**

Wyatt: "Stardew fishing minigame. Hikers cross one at a time. Keep the area around the player icon, which sways up and down. When the player is in the area, they slowly move across the bridge. When outside, bridge integrity goes down. If it runs out, the hiker fails, along with all hikers behind. If a hiker crosses, they pass, but the integrity doesn't reset. Easier with fewer hikers." See `40-sketchy-bridge.png`.

- **The screen:**
  - a side view of a rope bridge across a gorge, from the left cliff to the right one (`art/sketchy-bridge/`);
  - the hiker walks left to right; hikers who are across wait on the right, and those waiting stand on the left.
- **The balance bar** (on the right, like Stardew's fishing bar):
  - [150] units tall, with the hiker's icon (their colored token) moving up and down it on its own;
  - **the zone** is yours: hold (Space, the mouse button, or a finger anywhere) and it rises; let go and it falls. It rises at [600] units/s² and falls at [400], and it bounces softly off the bottom (speed × −[0.3]);
  - the zone is [44, 38, 32, 28, 24] units tall by tier.
- **How the icon moves:**
  - every [0.6–1.4 s] it picks a new height and eases toward it, faster by tier ([50, 60, 72, 84, 96] units/s);
  - **from Tier III:** sometimes a dart, a sudden jump of [30–50] units;
  - **from Tier IV:** wind gusts. The ropes flap for [0.5 s], then the icon is pushed one way for [0.6 s].
- **Crossing:**
  - while the icon is inside the zone, the hiker walks: a crossing takes [8, 9, 10, 11, 12] s of in-zone time;
  - outside the zone, the hiker stops and wobbles, and **the bridge's integrity drops** [14, 16, 18, 20, 22] per second, from [100];
  - planks crack and fall into the gorge as it drops (one every [4] points), so it shows on the bridge too.
- **Integrity is shared and never resets (Wyatt).** That's why it's easier with fewer hikers.
- **The bridge breaks** when integrity reaches 0:
  - the hiker on it falls and fails, and is hurt: the challenge's stake (the design doc's note: an injury, Bleeding, or Crippled);
  - **everyone behind them fails too** and stays back, losing only the cost of trying ([1] energy, the passing-challenge rule).
- **Crossing:** the hiker passes and moves on; the next one starts from the left, with the integrity left.
- **The HUD:** BRIDGE (integrity), and who's across, crossing and waiting.
- **Bot:** holds when the icon is above the zone's middle, [0.15 s] late, and sometimes overshoots.

## 2. Falling Rocks (a passing challenge; side view)
The planned Rockslide. Wyatt picked a side-view crossing. See `41-falling-rocks.png`.
- **The screen:**
  - the mountainside above, a ledge trail across the screen, and the drop below (`art/falling-rocks/slope.png`);
  - [2] overhangs along the trail: notches under a lip of rock.
- **One hiker at a time** walks from the left end to the right end ([300] units).
- **Controls:**
  - hold → or D (or the right half of the screen) to walk at [40] units/s;
  - ← or A (or the left half) to back up at [30];
  - let go to stop.
- **Hazards:**
  - **Falling rock** (all tiers):
    - a dust puff at the top marks where it'll fall;
    - its shadow grows on the trail below for [1.0, 0.9, 0.8, 0.7, 0.6] s by tier;
    - then it lands. It hits if the hiker is within the shadow's half-width: [8, 10, 14] for small, medium and large;
    - then it bounces off the ledge and away.
  - **Rock shower** (Tier II and up): [3–5] small rocks spread over [60] units, [0.15 s] apart.
  - **Rolling boulder** (Tier III and up):
    - "<<<" rumbles at one edge for [1.2 s], then a boulder rolls the whole trail at [70] units/s;
    - only an overhang is safe from it, or being past where it starts.
- **Overhangs** are safe from everything.
- **Pacing:**
  - a hazard every [1.4, 1.2, 1.0, 0.9, 0.8] s by tier;
  - mostly aimed at the trail ahead of the hiker, so standing still isn't safe forever.
- **Lives:**
  - each hiker has [2];
  - a hit costs one, then [1 s] of safety (blinking);
  - out of lives: the hiker fails and gets the challenge's stake (Rockfall: an injury chance and lost resources); the next hiker starts at the left.
- **Reaching the right end:** the hiker passes and moves on.
- **Later (from the design doc):** a snow version with falling icicles and slippery ice.
- **Bot:** walks, stops short of a growing shadow, and runs for an overhang when a boulder rumbles. Sometimes it's late.

## 3. Fly Block (Wyatt; Tempest-style)
Wyatt: "like Tempest. There is a circle made of panels around a piece of food in the middle. You play as a shield on the edge of the circle (the end of a fly swatter). Pressing A/D or swiping moves you to the edge next to you. Flies come from the outside in toward the circle. You have to block them by moving to the correct space, which knocks them out when they hit the swatter." See `42-fly-block.png`.
- **The screen:**
  - a pie in the middle (`art/fly-block/pie.png`), with a ring of [8, 10, 12, 12, 16] panels around it by tier;
  - lanes run from each panel out to the edge of the screen.
- **The swatter** sits on one panel, its flat head facing out, with an arc in the active hiker's color.
- **Moving:** one panel per press of A/D or ←/→, or a swipe, or a tap on the left or right half of the screen. Holding repeats every [0.12 s]. D, → and a swipe right go clockwise.
- **Flies:**
  - each appears at the outer end of a random lane and flies in at [30, 36, 42, 48, 54] units/s;
  - reaching the ring at the swatter's panel: **SWAT**, it's knocked out;
  - reaching any other panel: it gets to the pie, and that's **a bite**.
- **Kinds:**
  - **fast flies** (Tier II and up): [1.6×] as fast;
  - **zig-zag flies** (Tier III and up): partway in, they blink, then hop to the next lane, like Tempest's flippers;
  - **horseflies** (Tier IV and up): the first swat only knocks one back [30] units, so it takes two;
  - **bees** (Tier III and up): let them by. A bee that hits the swatter stings, which counts as a bite. A bee that reaches the pie just leaves.
- **A round:**
  - one hiker at a time, in line order;
  - each faces [12, 14, 16, 18, 20] flies, coming every [1.1, 1.0, 0.9, 0.8, 0.7] s, with a few at once later in the round;
  - [3] bites and the hiker fails (the round stops). Finishing with bites to spare passes.
- **Stake:** the challenge decides. The overhaul plan's example for Flies: each fly that gets through takes 1 bite of the party's food.
- **Bot:** moves toward the lane of the fly closest to the ring, sometimes a panel short.

## 4. Squirrel Theft (Wyatt; a shooting gallery)
Wyatt: "Start with an arcade screen showing a squirrel stealing a hiking pack. A landscape with trees and bushes; each player gets a certain amount of nuts to throw. Squirrels pop their head out, and you throw nuts to them to appease them. If you get them above a certain bar, they're happy and return the bag in an end screen. If not, you lose the resources they stole at the start. On higher tiers, bears: feeding them nuts lowers the bar instead." See `43a-squirrel-theft-intro.png` and `43b-squirrel-theft.png`.
- **The intro** ([3 s], or a tap):
  - "SQUIRREL THEFT!" on a dark arcade screen, the thief running off with a pack (`art/squirrel-theft/thief.png`);
  - "IT TOOK:" and the stolen resources: X random single resources from across the party's packs (the challenge sets X: [3–6]);
  - they're taken out of the packs now.
- **The gallery** (`art/squirrel-theft/bg.png`): trees with branches, and three rows of cover: far bushes, a log, and near bushes.
- **Squirrels:**
  - they pop up from behind cover for [1.4, 1.2, 1.0, 0.9, 0.8] s by tier, then duck;
  - from Tier II, some run along a branch instead (moving targets).
- **Throwing:**
  - tap or click anywhere: a nut flies from the thrower's hand at the bottom middle in an arc to that spot, landing [0.35 s] later;
  - it feeds whatever is within [7] units of that spot when it lands, so aim where a squirrel will be;
  - a fed squirrel smiles, chirps and ducks;
  - each throw uses a nut.
- **Turns:** hikers throw in line order, each with their own nuts ([6, 6, 5, 5, 4] by tier). The bar is shared.
- **The HAPPY bar:**
  - each fed squirrel adds 1;
  - the line is [40, 45, 50, 55, 60]% of all the party's nuts.
- **Bears** (Tier III and up):
  - sometimes a bear pops up instead;
  - a nut that lands on one takes [2] off the bar;
  - from Tier IV, a bear sometimes pops up right where a squirrel just ducked.
- **The end,** when every nut is thrown:
  - **at or above the line:** "THEY'RE HAPPY!", the squirrels bring the pack back, and everything stolen is returned. Everyone passes;
  - **below it:** the stolen things are lost, and everyone fails. Nothing else is lost.
- **Bot:** throws at the squirrel nearest the middle, leading moving ones, and misjudges about [30%] of throws. It leaves bears alone, mostly.

## 5. Birdsong (Wyatt; Simon with colored notes)
Wyatt: "notes color-coded, about 4 colors on Tier 1, more around 6–8 on higher tiers. Multiple rounds, starting with 2 notes, then repeating those and adding more next round. On higher tiers, the notes don't repeat, but are whole different sequences each time. The notes cross the screen without color at first; in the middle they flash into the color, then fade out the other way. The player then looks down at a paper with color-coded squares and must get the right order. Getting one wrong adds a strike; each hiker gets 3. A hiker who gets one wrong keeps going to the end of the sequence. At 3 strikes, switch to the next sequence. Switch hikers each sequence." See `44a-birdsong-listen.png` and `44b-birdsong-paper.png`.
- **Colors by tier:** [4, 5, 6, 7, 8]. Each color also has **its own shape** and **its own tone** *(Claude's idea: shapes help color-blind players and the greens)*:

  | Color | Shape |
  | --- | --- |
  | orange | star |
  | blue | ring |
  | yellow | diamond |
  | purple | cross |
  | red | heart |
  | teal | circle |
  | pink | square |
  | white | triangle |

  Use them in this order, so Tier I is orange, blue, yellow and purple. The art is `art/birdsong/note-<shape>.png` (white, so it can be tinted).
- **Rounds:**
  - round 1 has [2] notes, and each round adds 1, up to the tier's longest song: [5, 6, 7, 8, 9];
  - **Tiers I and II:** the same song grows, like Simon. Each round repeats the last and adds a note;
  - **Tier III and up:** a whole new song every round (Wyatt).
- **Listening:**
  - a bird sings on a branch;
  - the notes cross the screen left to right at [70, 80, 90, 100, 110] units/s, [0.55, 0.5, 0.45, 0.4, 0.35] s apart;
  - each note is colorless until the middle line, where it flashes into its color and shape and plays its tone, then fades out on the right.
- **Answering:**
  - the view tilts down to the notebook page: one big square per color, each with its shape;
  - tap them in order, or press 1 to 8;
  - the answer slots at the top fill as you go.
- **Strikes:**
  - a wrong note is a strike: a red X under it, and the right color blinks;
  - **you keep going to the end of the song** (Wyatt);
  - each hiker has [3] strikes for the whole game. At 3, their turn ends at once and they're out.
- **Turns:** hikers switch every song, in line order, skipping anyone who's out.
- **The end:** after the longest song, or when everyone's out. Hikers still in pass.
- **Bot:** gets each note right [92%] of the time, a little less in longer songs.

## 6. Minefield (Wyatt; today's Thin Ice, reskinned)
Wyatt: "Dog Waste Zone as a Minesweeper reskin, named Minefield. Instead of flagging the poop, you're putting a doggy bag on it." See `45-minefield.png`.
- **The game is today's Thin Ice, unchanged in its rules:**
  - holes (now dog poop): a base by tier plus 2 for each hiker;
  - the first check is always safe;
  - numbers count the piles around a square;
  - stepping in one puts the hiker at the front out, and play goes on;
  - the clock on Tiers II and III;
  - the same balance numbers.
- **Rename** `thinIce` to `minefield`: the id, the folder, the balance block, the tests and the catalog entry. Then build the new Thin Ice (section 7) as a new game.
- **The look** (`art/minefield/`, replacing `art/thin-ice/`):
  - tall grass (hidden) and mown grass (checked) tiles;
  - a poop pile, a doggy bag tied at the top, and a picket fence around the field.
- **Words:**
  - BAG IT (right-click or long-press) instead of flag;
  - stepping in one: "EW!", and that hiker is out.
- **Note:** Dog Waste Zone only appears when a Dog is on the tile.

## 7. Thin Ice: cross the ice (new; a passing challenge)
Wyatt: "make it so it's still Minesweeper, but it's about finding a safe way for each hiker to cross the ice field." He picked: the ice cracks behind each hiker. See `46-thin-ice-crossing.png`.
- **The board** (cols × rows by tier): [9 × 7, 10 × 8, 11 × 8, 11 × 9, 12 × 9]. A snowy near shore below and a far shore above, both safe.
- **Holes:**
  - [12, 15, 18, 20, 22]% of the ice;
  - placed so there are **at least as many separate safe routes as hikers**: shore to shore, 8-way steps, sharing no squares;
  - make the routes first, then put the holes elsewhere.
- **Shore numbers:** each near-shore square shows how many holes touch it in the first ice row, so the first step can be worked out.
- **A hiker's turn** (one at a time, in line order):
  - **Start:** tap a near-shore square to stand there.
  - **Step:**
    - tap a square next to the hiker (8 directions) and they step onto it, and it shows its number;
    - a 0 opens the squares around it (they're checked, not walked on);
    - a hole: they fall in.
  - **Pick:**
    - tap a square up to [2] away (but not next to them) to test it with the ice pick, safely;
    - it shows its number, or marks the hole as open water;
    - picks per hiker: [3, 3, 2, 2, 1].
  - **Flag:** right-click or long-press marks a square you think is a hole. It's free.
  - **Reaching the far shore:** the hiker passes and waits there.
- **The ice cracks behind each hiker:**
  - every square a hiker **walked on** cracks, and later hikers can't step on it;
  - it's drawn cracked, and **its number stays**, so later hikers still learn from it;
  - squares that were only checked (by a 0 or a pick) stay usable.
- **Falling in:**
  - the hiker fails and gets the challenge's stake (Thin Ice: Soaked);
  - the hole stays open, and the next hiker starts from the near shore;
  - **Hiking Stick** (Prepare): each hiker's first hole only cracks, and they stay put.
- **No clock** (it's a puzzle). A testing setting can add one per hiker.
- **Easier with fewer hikers:** later hikers have fewer squares left, but more numbers to go on.
- **Bot:**
  - steps to a known-safe square toward the far shore;
  - uses a pick when no neighbor is known to be safe;
  - guesses when stuck.

## 8. Pack It Up *(Claude's idea; Wyatt approved)*
Fit the gear into a torn pack before time runs out. See `47-pack-it-up.png`.
- **The pack:**
  - a grid of [5 × 4, 5 × 5, 6 × 5, 6 × 6, 7 × 6] cells by tier, with [1, 2, 3, 4, 4] torn cells that can't hold anything;
  - at Tiers I and II there are [2] and [1] spare cells. From Tier III the gear fills it exactly.
- **The gear:**
  - pieces of 1 to 4 cells ([5] from Tier IV), each drawn as a piece of gear: sleeping bag, pot, lantern, rope, tent, boots, map, stove (`art/pack-it-up/`);
  - make the puzzle by cutting the free cells into pieces, so it can always be solved;
  - then shuffle them and turn them at random into the tray on the right.
- **Controls:**
  - drag a piece into the pack: it snaps to the grid, and it can't overlap anything or cover a torn cell;
  - turn it with R, a right-click, or the turn button (a finger);
  - drag it back out to take it back.
- **One hiker at a time,** each with their own pack, with [60, 60, 75, 90, 90] s.
- **Results:**
  - everything packed in time: the hiker passes;
  - otherwise they fail and lose [1] energy;
  - the pieces left out are what the challenge's stake uses (Torn Pack: lost resources).
- **Bot:** places pieces with a simple solver, slowly, with a wrong drop now and then.

## 9. Dodge: the Eagle, the Snow Leopard and the Abominable Snowgirl
Portraits (`art/dodge/portraits/solid-red/`, see `53-dodge-portraits.png`), each with a blink frame and a bob frame:
- `eagle.png`: wings up in a V and a side-on head with a hooked beak (Wyatt's Majestic Eagle);
- `toupee-eagle.png`: the same, with a big red toupee;
- `freeagle.png`: an Uncle Sam top hat, and a pistol in one wing;
- `snow-leopard.png`;
- `snowgirl.png`: **Ellie with antlers** (Wyatt's art): a white fluffy dog with branching antlers, growling.

### 9.1 The Eagle (Wyatt: "each tier he goes up is a different version")

**November 26 (evening): Comb-Over and the other attacks that move across the box get red arrows during the warning. See `26-fixes-and-wyatt-trees.md`, section 3.1.**

- **Versions by level:**
  - **Eagle** at Easy (Tier I);
  - **Toupeeagle** at Level 1 (Tier II);
  - **Freeagle** at Levels 2 and 3 (Tiers III to V).
  - The HUD name and the portrait follow the version.
- **Each version keeps the earlier ones' attacks** and adds its own.
- **Roster:** add him to every tier, with weight [20].
- **Eagle's attacks:**
  - **Swoop** (Wyatt): a dotted path across the box and "!" at its entry for [0.8 s]. Then the eagle (`dodge/eagle/eagle.png`) flies along it at [220] units/s. He hits as a circle of radius [7]. [1] swoop at Easy, [2] in a row at Level 1, [3] from Level 2 (the last aimed at the sprite).
  - **Feather Fall** *(Claude's idea)*: [6, 8, 10, 12] feathers (Easy to Level 3) drift down from the top at [30] units/s, swaying ±[12] units every [1.2 s].
  - **Talon Drop** *(Claude's idea; Level 1 and up)*: a shadow follows the sprite for [1 s], stops, and [0.4 s] later the talons strike there (a circle of radius [12]).
  - **Wing Gust** *(Claude's idea; Level 2 and up)*: feathers stream across for [0.4 s], then the sprite is pushed sideways at [40] units/s for [1.2 s].
- **Toupeeagle adds:**
  - **Hair Toss** (Wyatt): he flings [3, 4, 5] curly red hairs (Level 1 to 3), each spinning along a curved arc at [110] units/s toward the sprite.
  - **Comb-Over** *(Claude's idea)*: a wall of hair sweeps across the box from one side, with one gap [20] units wide.
- **Freeagle adds:**
  - **Gunfire** (Wyatt: "a gun"): Bear with a Gun's Aimed Shot and Rapid Fire, with his art (the shots come from the pistol in his portrait).
  - **Oil Barrels** (Wyatt):
    - [2] barrels at Level 2 and [3] at Level 3 are tossed into the box, each landing on its shadow ([0.6 s]);
    - a fuse number counts down for [1.4 s], then the barrel bursts (radius [18], it hits);
    - each leaves **an oil puddle** (radius about [20]) for [6 s]. **Inside a puddle, the sprite slides on ice physics** (section 9.4).

### 9.2 The Snow Leopard (snow; Tier III and up)
- **Where he shows up:** only from the snow challenges and the testing tab. He's not in the random roster.
- **Level by tier:** Level 2 at Tier III, and Level 3 at Tiers IV and V.
- **The whole box is ice** (section 9.4).
- **Attacks** *(all Claude's ideas, apart from the Claws, which are shared)*:
  - **Pounce:** he crouches at the edge nearest the sprite; a red dotted line shows his path to where the sprite is; [0.7 s] later he leaps along it at [260] units/s (a circle of radius [8]). Level 3 sometimes pounces twice.
  - **Prowl:** he pads around the box's edge (outside it, harmless), then pounces from wherever he stops, with a shorter warning ([0.5 s]).
  - **Claws:** the shared Claws attack.
  - **Tail Sweep:** a band along the bottom or one side is warned for [0.8 s], then his tail sweeps through it.
  - **Snow Kick:** a cone of [8–12] snow pellets from one side.

### 9.3 The Abominable Snowgirl (snow; Tier III and up)

**November 26 (evening): Avalanche's gap is [38] units, starts near the sprite, and warns for [1.1 s]; arrows show where things move. See `26-fixes-and-wyatt-trees.md`, section 3.**

- **Where she shows up, and her levels:** the same as the Snow Leopard. The box is ice too.
- **Attacks** *(Claude's ideas)*:
  - **Snowballs:** [3, 5] snowballs lobbed in arcs, each landing on a shadow that grows for [0.8 s]. Each bursts into [4] chunks that slide outward across the ice.
  - **Icicles:** [5–8] icicles along the top edge glint, then drop one after another.
  - **Antler Charge:** a stripe across the box is warned for [1 s], then she charges through it (`dodge/snow/snowgirl.png`). Level 3: two stripes that cross.
  - **Shake Off:** she shakes her fluff: a ring of [16] snowflakes bursts out from the middle, then a second ring turned half a gap.
  - **Avalanche** (Level 3): snow falls down the box in columns, with one gap.

### 9.4 Ice physics (Wyatt: "the box has ice physics for those two")
- **Inputs accelerate** the sprite at [240] units/s², up to the normal top speed.
- **With no input, it slides:** its speed shrinks by [1.2] per second (speed × e^(−1.2 × dt)), so stopping takes about [1.5 s].
- **It stops** at the box's walls.
- **Where it applies:** the snow animals' whole box, and inside Freeagle's oil puddles.
- **On screen:** light streaks on the box floor, and little slide marks behind the sprite.

---

## 10. The pop-up for each game (`20-challenge-popup.md`, version 3)

**November 26 (evening): the Prepare cards' costs move to resource categories. See `24-challenges-reset.md`, section 5, which wins where they differ.**

Same format as `20`, section 7. Cards: **TITLE** (color), cost, slots: effects. *(pick a hiker)* marks a per-hiker effect.

**Sketchy Bridge**
- **How to play:** "Cross the bridge one at a time. Hold to raise the zone and keep your hiker inside it: you only walk while you're in it. **Outside it, the bridge weakens.**"
- **Rules:**
  - "The bridge doesn't recover between hikers."
  - "If it breaks, the hiker on it falls, and everyone still waiting fails."
  - "Your hiker sometimes darts." *(TIER III AND UP)*
  - "Wind gusts push your hiker." *(TIER IV AND UP)*
- **Bars:** BRIDGE, ZONE SIZE, SWAY SPEED.
- **Cards:**
  - **PATCH THE PLANKS** (green), ×2 Wood, [2] slots: +[20] bridge;
  - **FOOD** (green), Food, [2] slots: a bigger zone (+[4]);
  - **HIKING STICK** (red), ×1 Hiking Stick, [1] slot: [25%] less sway;
  - **HARNESS** (green), ×1 Harness, [1] slot: whoever's on it when it breaks isn't hurt.
- **Controls:** HOLD: Space, the mouse button, or a finger anywhere.

**Falling Rocks**
- **How to play:** "Cross the ledge one at a time. Watch for shadows: a rock lands where one grows. Stop, back up, or hide under an overhang. **A hit costs a life.**"
- **Rules:**
  - "Overhangs are safe from everything."
  - "Showers of small rocks fall at once." *(TIER II AND UP)*
  - "Boulders roll the whole trail: get under an overhang." *(TIER III AND UP)*
- **Bars:** WARNING TIME, ROCKS (how often), TRAIL.
- **Per hiker:** LIVES.
- **Cards:**
  - **FOOD** (green), Food, [3] slots: +1 life *(pick a hiker; once each)* / slower rocks ([2] at most);
  - **HARDHAT** (green), ×1 Hardhat, [1] slot: +1 life *(pick a hiker)*;
  - **BINOCULARS** (blue), ×1 Binoculars, [1] slot: +[0.3 s] warning.
- **Controls:** WALK: hold → or D, or the right half; BACK UP: ← or A, or the left half.

**Fly Block**
- **How to play:** "Flies are coming for the pie. Move the swatter around the ring, one panel at a time, and block each fly in its lane. **A fly that gets through takes a bite:** <3> bites and that hiker fails."
- **Rules:**
  - "Some flies are fast." *(TIER II AND UP)*
  - "Some hop to the next lane on the way in." *(TIER III AND UP)*
  - "Let the bees by: blocking one is a sting." *(TIER III AND UP)*
  - "Horseflies take two swats." *(TIER IV AND UP)*
- **Bars:** FLY SPEED, FLIES, PANELS.
- **Per hiker:** BITES.
- **Cards:**
  - **FOOD** (green), Food, [3] slots: +1 bite allowed *(pick a hiker; once each)* / slower flies ([2] at most);
  - **SMOKE** (red), ×2 Forest resources, [1] slot: −[3] flies.
- **Controls:** MOVE: A/D or ←/→, a swipe, or a tap on the left or right side.

**Squirrel Theft**
- **How to play:** "A squirrel stole from your packs! Tap the squirrels to throw them nuts. Nuts take a moment to land, so aim where they'll be. **Fill the HAPPY bar past the line,** or what they took is gone."
- **Rules:**
  - "Each hiker throws their own nuts, in turn."
  - "Some squirrels run along the branches." *(TIER II AND UP)*
  - "Don't feed the bears: it takes 2 off the bar." *(TIER III AND UP)*
- **Bars:** NUTS EACH, HAPPY LINE, POP-UP TIME.
- **Cards:**
  - **FOOD** (green), Food, [3] slots: +1 nut *(pick a hiker; [2] each at most)*;
  - **BAIT** (red), ×2 Forest resources, [1] slot: squirrels stay up [0.3 s] longer;
  - **BEAR SPRAY** (red, Tier III and up), ×1 Bear Spray, [1] slot: no bears.
- **Controls:** THROW: click or tap.

**Birdsong**
- **How to play:** "Listen to the bird: each note takes its color as it crosses the middle. Then tap the colors in the same order. **A wrong note is a strike:** 3 strikes and you're out. Hikers take turns, one song each."
- **Rules:**
  - "Each song is the last one plus one more note." *(TIERS I AND II)*
  - "Every song is new, and one note longer." *(TIER III AND UP)*
  - "After a wrong note, finish the song anyway."
- **Bars:** COLORS, LONGEST SONG, NOTE SPEED.
- **Per hiker:** STRIKES.
- **Cards:**
  - **FOOD** (green), Food, [3] slots: +1 strike *(pick a hiker; once each)* / slower notes ([2] at most);
  - **FIELD NOTEBOOK** (blue), ×1 Field Notebook, [1] slot: each song plays twice;
  - **UKULELE** (blue), ×1 Ukulele, [1] slot: the colors play their tones when you hover them.
- **Controls:** PICK: click or tap a color, or press 1 to 8.

**Minefield**
- **How to play:** "Dog Waste Zone! Mow the grass square by square: each number tells you how many piles touch it. Bag the piles you find. The first square is always safe. **Step in one and the hiker at the front is out.**"
- **Rules:**
  - "Clear every safe square to pass."
  - "There's a clock: when it runs out, everyone still in fails." *(Tiers II and III)*
- **Bars:** PILES, TIME *(when there is one)*.
- **Cards:**
  - **POO BAGS** (blue), ×1 Poo Bag, [3] slots: one pile is bagged before you start;
  - **SCANNER** (blue), ×1 Minesweeper or Scanner, [1] slot: [2] piles bagged before you start.
- **Controls:** MOW: click or tap; BAG IT: right-click or long-press.

**Thin Ice**
- **How to play:** "Get every hiker across the ice, one at a time. Step to the squares next to you: each number tells you how many holes touch it. **Step on a hole and you fall in.** The ice cracks behind you, so each hiker needs a new way across."
- **Rules:**
  - "Your ice pick tests a square 2 away, safely. You have <3>."
  - "Cracked squares can't be used, but their numbers stay."
- **Bars:** HOLES, PICKS, ICE (size).
- **Cards:**
  - **FOOD** (green), Food, [3] slots: +1 pick *(pick a hiker; once each)*;
  - **TEST THE ICE** (blue), ×1 Stone, [3] slots: marks one hole before you start;
  - **HIKING STICK** (green), ×1 Hiking Stick, [1] slot: each hiker's first hole only cracks.
- **Controls:** STEP: click or tap a square next to you; PICK: click or tap a square 2 away; FLAG: right-click or long-press.

**Pack It Up**
- **How to play:** "Your pack is torn! Drag the gear into the pack and turn pieces to fit. Nothing can go on a torn spot. **Pack everything before time runs out.**"
- **Rules:**
  - "There's no room to spare." *(TIER III AND UP)*
- **Bars:** TIME, PIECES, PACK SIZE.
- **Cards:**
  - **FOOD** (green), Food, [2] slots: +10 s;
  - **BACKPACK** (green), ×1 Backpack or Fanny Pack, [1] slot: +1 spare cell;
  - **SACK** (red), ×1 Sack, [1] slot: the biggest piece goes in the sack instead.
- **Controls:** MOVE: drag a piece; TURN: R, a right-click, or the turn button.

**Dodge: the new animals** (the Dodge entry in `20`, section 7; add these lines):
- **Rules:**
  - **Eagle:** "He swoops along the dotted path."
  - **Toupeeagle:** "Curly hairs curve in. Watch for the gap in the comb-over."
  - **Freeagle:**
    - "Oil barrels blow up when their number runs out."
    - "The puddles they leave are slippery."
  - **Snow Leopard:**
    - "The floor is ice: you slide."
    - "He pounces at where you are when he crouches."
  - **Snowgirl:**
    - "The floor is ice: you slide."
    - "Snowballs break into chunks that slide."
- **Cards:** add **GRIP** (red; Freeagle, Snow Leopard and Snowgirl), ×1 Work Boots, Trail Shoes or Lifted Boots, [1] slot: half as slippery (friction ×2).

---

## 11. Art
Everything is in the GPS greens, with red where it's marked. It's 1 px per scene unit, so scale it with nearest-neighbor.
- `art/sketchy-bridge/`: `gorge.png` (320 × 176), `plank.png`, `plank-cracked.png`, `post.png`. The ropes and the bar are drawn in code.
- `art/falling-rocks/`: `slope.png` (320 × 176, with two overhangs), `rock-s.png`, `rock-m.png`, `rock-l.png`, `dust.png`. Shadows are drawn in code.
- `art/fly-block/`: `pie.png`, `swatter.png` (seen from above; turn it to face out), `horsefly.png`.
  - Reuse Fly Swatter's `fly` and `bee`.
  - The ring and the lanes are drawn in code.
- `art/squirrel-theft/`: `bg.png`, `squirrel.png`, `squirrel-happy.png`, `thief.png`, `nut.png`, `bear.png`. The thrower's hand reuses the hiker-tinted sleeve style.
- `art/birdsong/`: `bird.png`, `bird-sing.png`, `note-<shape>.png` (white heads, so they can be tinted). The branch, the page and the squares are drawn in code.
- `art/minefield/`: `grass.png`, `mown.png`, `poop.png`, `bag.png`, `fence.png`.
- `art/thin-ice/`:
  - add `cracked.png`, `shore.png` and `ice-pick.png`;
  - keep `ice.png`, `open.png`, `hole.png` and `flag.png` (the old Thin Ice art moves into the new game).
- `art/pack-it-up/`: one picture per gear piece, `<name>.png`, at 10 px a cell. Draw them in code at the cell size you use, or scale these.
- `art/dodge/eagle/`: `eagle.png` (from above, swooping), `feather.png`, `hair.png`, `oil-barrel.png`, `oil-puddle.png`.
- `art/dodge/snow/`: `leopard.png`, `snowgirl.png`, `snowball.png`, `icicle.png`.
- `art/dodge/portraits/solid-red/`: the five new heads, each with `-blink`, `-bob` and `-bob-blink`.

## 12. Testing tab
Every new game gets an entry with Tier and Hikers, plus:
- **Sketchy Bridge:** Bridge (integrity), Show the icon's target.
- **Falling Rocks:** Lives, Boulders (Auto, On, Off).
- **Fly Block:** Panels (Auto, 8 to 16), Bees (Auto, On, Off).
- **Squirrel Theft:** Stolen (1 to 6), Bears (Auto, On, Off).
- **Birdsong:** Colors (Auto, 4 to 8), Songs (Auto, Grow, New each round).
- **Minefield:** Thin Ice's current settings.
- **Thin Ice:** Picks (Auto, 0 to 5), Time per hiker (Off, or seconds), Show the holes.
- **Pack It Up:** Pack (Auto, or a size), Spare cells (Auto, 0 to 3).
- **Dodge:** add Eagle (with a Version setting: Auto by tier, Eagle, Toupeeagle, Freeagle), Snow Leopard and Snowgirl to the Animal list.

## 13. Tests
- **Sketchy Bridge:**
  - integrity only drops while the icon is outside the zone, and never resets between hikers;
  - a break fails the hiker on it and everyone behind.
- **Falling Rocks:**
  - nothing hits a hiker under an overhang;
  - every shadow shows at least the tier's warning before its rock lands.
- **Fly Block:**
  - a fly is blocked only at the swatter's panel;
  - a zig-zag fly changes lanes once;
  - a bee blocked is a bite, and a bee that gets through isn't.
- **Squirrel Theft:**
  - the stolen things come back exactly when the bar ends at or above the line;
  - a nut feeds what's under it when it lands, not when it was thrown.
- **Birdsong:**
  - Tiers I and II repeat the last song plus one note;
  - Tier III and up make new songs;
  - a wrong note doesn't end the song;
  - 3 strikes end that hiker's game.
- **Minefield:** all of Thin Ice's current tests, renamed.
- **Thin Ice:**
  - every board has at least as many separate safe routes as hikers;
  - walked squares can't be stepped on again, and their numbers stay;
  - picks reach only squares 2 away.
- **Pack It Up:**
  - every puzzle can be solved;
  - pieces can't overlap or cover torn cells.
- **Dodge:**
  - the Eagle's version follows the level;
  - Freeagle's puddles and the snow animals' boxes slide;
  - nothing else does.
