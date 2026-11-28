# Phase 12: the UI overhaul

Wyatt (November 27 and 28): Phase 12 makes the main screen, scavenging and crafting feel like the slots while taking up less of the map. Paper tags pinned on the trail map, an action wheel over the hiker, poster windows for scavenging, a workbench over a recipe book, a nightly camp recap with the party level-up, a new title screen, loading screens and spotlight transitions. The sound half is `32-audio-system.md`; every sound named here is in `33-sound-list.md`.

- **Play it first:** the prototype, https://claude.ai/artifact/7Qd1vr2PzS7YCtZaNLusvD (also in `mockups/ui-overhaul/prototype/`; open `index.html` from a local server). The bar along its top switches screens and settings. It's plain JavaScript with sample numbers: **copy the look, the motion and the order of things, not the code or the data.**
- **Pictures:** `mockups/ui-overhaul/*.png` (the table at the end).
- **Art:** `art/ui-overhaul/` (the logo, the workbench top, the station doors, and Wyatt's stone square for the Mountain brush cover).
- **Design doc:** the UI tab has the same decisions, with Wyatt's answers.

Numbers in [brackets] are first guesses: put them in `balance.ts` (a `ui.overhaul` block) with `TODO(wyatt)`. Sizes are at the prototype's 1440 × 900 stage; scale them with the game screen. Ideas marked *(Claude's idea)* are mine.

**Mom will most likely play on a trackpad or touch** (Wyatt plays with a mouse). So every button is at least [44 px], nothing needs hovering to work (hovering only adds hints; a long-press shows the same hint on touch), and drags have a click fallback.

**Reduced motion** (`useReducedMotion`): every animation here turns into an instant change or a [0.2 s] fade. The sounds still play.

---

## 1. Settings
Four new choices in the ☰ menu's settings, saved per device with `deviceSetting` (like the packing look):

| Setting | Choices | Default | Section |
| --- | --- | --- | --- |
| Actions | Wheel, Side grid | **Wheel** | 4 |
| Scavenge reveal | Deal and flip, Brush | **Deal and flip** | 5 |
| Crafting look | Paper, TrailMate | **Paper** | 6 |
| Loading screen | Runner, Node wheel | **Runner** *(Claude's idea: Wyatt likes both)* | 9 |

All four were Wyatt's calls (the Runner as the default is mine). Changing one takes effect the next time that screen opens.

## 2. The look
- **Paper tags.** Panels are cream paper with an ink border and a thin inner rule, like the map's MEADOW plaque, pinned over the map. Labels in Edit Undo (`--font-pixel`), everything else in DM Sans (`--font-body`).
- **Poster windows.** Scavenging gets a poster header (section 5): big lettering, a sunburst and flat two-tone shapes, drawn as SVG so they stay sharp.
- **Colors.** The map's parchment and ink, the party colors, Energy green, Appetite orange, Morale purple, and the rarity colors as now.
- **Less on screen.** The top-left biome pill goes (the map's plaque already says it). The Party LV pill stays.
- **Everything moves a little.** Numbers float up, bars drain with a ghost, things pop in with a small overshoot, cards are dealt and flipped like the slots.

## 3. Party frames (`PartyPanel`)
Each hiker is a small paper tag down the left. Clicking one selects the hiker and opens the rest of their tag. The parts:

| Part | What it shows |
| --- | --- |
| Portrait | The hiker on their party color with a faint sunburst. Goes grey with a small ACTED stamp once they've acted. |
| Banner | A ribbon in the party color with the name. The 3 injury diamonds sit on its right end and fill in with a pop (`injury`). |
| Bars | Energy, Appetite and Morale as thin bars with the number, and a notch at each threshold (Fatigued, Hungry, Luck). Plush hikers show Stuffing, as now. |
| Condition dot | On the portrait's corner, colored by the worst condition (red bad, yellow threshold, green good), with how many. Pointing at it (or a long-press) lists them. |
| Selected | The tag slides out [8 px] with a party-color outline. |
| Opened | The numbers with thresholds, condition chips with days left, trait badges (names on hover), level and XP, and what they're wearing. |

- **Several can be open at once** (Wyatt). Clicking an open tag's header closes it. The column scrolls when they don't all fit.
- **Sounds:** `ui.frameOpen`, `ui.frameClose`.
- **No level-up star on a hiker** (Wyatt): level-ups are party-wide. The Party LV pill shows waiting points instead (section 7).
- **When a stat changes:** the bar jumps, a pale ghost of the old amount drains after it over [0.35 s], the change floats up (−1 red, +1 green, [1.1 s]), and the tag nudges on a loss. Crossing a threshold plays `stat.low`.

## 4. Actions: the wheel or the side grid (`TurnPanel`)
- **The wheel (default).** Selecting a hiker who can still act (their tag or their token) pops 6 round buttons in an arc above the token: Move, Move all, Scavenge, Craft, Tend, Abilities.
  - Arc radius [122 px], buttons [54 px], popping out [28 ms] apart with an overshoot; `ui.wheelOpen` and `ui.wheelClose`.
  - Each has its cost on a small badge. Pointing at one (or a long-press) shows its name, cost and what it does, or why it can't be done. Blocked ones are hatched and faded.
  - Keys 1 to 6 press them *(Claude's idea)*.
  - It follows the token when the map pans or zooms, and opens below the token near the top edge *(Claude's idea)*.
  - It closes on clicking the map, Esc, or picking an action.
  - At night, Sleep, Watch and Sit by the fire take the place of the day actions.
- **The side grid (setting).** The same buttons in a grid on the right under the tile card, with the explanation line below, like today.
- **Moving.** Move closes the wheel and the connected tiles glow with their cost; click one to walk there. Move all does the same for the group.
- **No Eat and use action** (Wyatt). Items are used from the pack: clicking an item in the pack pops a small card beside it with the item's TrailMate card (`31`) and its button: Eat (food), Use (tools and trinkets), Wear (clothes) or Set up (shelters), plus Give. An item with nothing to do now shows the card and Give only. Eating and using still don't take the hiker's action. Sounds: `item.eat`, `item.use`, `item.equip`, `item.give`.
- **The right side keeps only** the tile card (its nodes with Abundance, who's here), the selected hiker's pack (bag and resources), and End phase.

## 5. Scavenging (`ScavengeWindow`)
The window is a poster of the tile, and the cards come in like a dealer passing them across a table.
1. **The poster.** A header [208 px] tall: the tile's node name in big poster letters over a scene drawn for that node: pines for Forest, a river valley for River, hills with a deer for Wildlife, snowy peaks for Mountain. A two-node tile splits it on a diagonal. The table under the cards takes the node's color. Port `sceneSVG` from the prototype's `app.js` as a component, seeded by the tile's id so a tile's poster doesn't change between visits *(Claude's idea)*.
2. **The deal.** Cards slide in from above one at a time, [0.16 s] apart (`card.deal`), and land with a small random tilt [±4°] and height [±8 px]. Rare face-down cards glow, as now.
3. **The flip.** A quick 3D flip and pop [0.38 s]. The sounds stack like a slot machine: Common just snaps; each step of rarity adds one more chime (`card.reveal.*`, `32` section 6); Rare and up burst confetti in the rarity color. Flip all flips them one after another, [0.3 s] apart.
4. **Needed ribbons.** A card that a starred recipe still needs gets a gold NEEDED · SACK ribbon and `card.wanted`; a starred resource gets STARRED. "Still needs" counts what the hiker and the others on the tile already hold, like crafting does.
5. **Take.** Pick a card (it lifts, the rest dim), then Take: it flies into the hiker's tag [0.7 s], the tag bumps, the bars and pack update, and the other cards fall away. Not now stays free until the first flip, as now.
- **Looking for.** A panel on the right lists the starred recipes with what each still needs (filled = have it, dashed red = missing), the starred resources, and a button that opens the recipe book, read only (`book.page`).
- **The brush reveal (setting).** Each card is hidden under its node's cover, drawn with depth and shadows: piles of autumn leaves and twigs (Forest), wet pebbles over ripples (River), tall grass with seed heads and little flowers (Wildlife), and chipped stone slabs with light edges and gravel, after Wyatt's stone square (`art/ui-overhaul/stone-square-wyatt.png`) (Mountain).
  - Drag across a cover to brush it away with a wide round brush ([64 px] in the prototype's canvas); bits of leaf, water, grass or gravel flick off as you go; `scav.brush.<node>` plays while brushing.
  - Once [50%] is clear, the rest blows away (`scav.uncover`) and the card pops, with its reveal chimes.
  - Flip all becomes Brush all. Touch dragging works the same; a click on a cover brushes a patch.
  - Port `paintCover` and `brushBits` from `app.js`. Paint each cover once per card into an offscreen canvas.

## 6. Crafting (`CraftWindow`)
A workbench on top, the resources in the middle, and a recipe book underneath that shows every cost up front. The pick step (the 3 × 3 deal) and Teach stay as they are, restyled.
- **The workbench.** A plank top that looks like something you'd craft on (Wyatt): wood grain, knots, nails, a saw mark and a burn ring, a few curly shavings, and a ruler along the front edge (`art/ui-overhaul/workbench.svg`, or port `benchSVG`). Slots are sunk into the wood, as many as the recipe needs (up to 10), then an arrow, the result slot, and Craft and Clear. The cost line says what crafting takes (−1 Energy, the hiker's action).
- **The tray.** The crafter's pack and the resources pooled on the tile; a colored dot shows whose.
- **Stars.** A star on each recipe and each resource marks it as a favorite (`ui.star`, `ui.unstar`). Stars are the party's, saved with the hike (a `starred: { recipes, resources }` field on the game state; UI only, no rules) *(Claude's idea: per hike, not per device)*.
- **The recipe book.** Tabs: Starred, Tools, Clothes, Foods, Shelters, Trinkets (`book.page`).
  - The left page has the basic recipes, Tier I to III, with locked tiers faded; the right page has the blueprints this hiker knows.
  - Each row is laid out like Catan's building costs: star, icon, name and effect, then the cost as small cards in a row. Missing cards are dashed red, and the row ends in READY or NEEDS 2.
  - The Starred tab lists starred recipes, ready ones first, then starred resources with which node they come from.
- **Click a recipe** and it fills itself: the resources fly from the tray into the slots one by one ([0.08 s] apart), each `craft.slot` a step higher. Missing ones show as ghost slots (`craft.ghost`). When the bench is full, Craft pulses (`craft.ready`).
- **Or fill it by hand** by clicking resources; the bench names the recipe it matches, Minecraft style. Clicking a slot takes that resource back. Clear empties it (`craft.clear`).
- **Auto-fill spends spare resources first** (Wyatt agreed). For each slot, prefer, in order: resources that aren't starred and that no other starred recipe needs; then ones another starred recipe needs; then starred ones. Inside each group, keep today's order (the crafter's own first, then the others on the tile). This replaces `autoPay`'s ordering; the rules for what can pay a slot don't change.
- **Crafting.** The resources hop into the middle, three hammer hits [0.25 s] apart with sparks and a shake (with `act.craft.<type>`), then:
  - **a blueprint:** the TrailMate item card flips into the result slot with a NEW stamp (`item.new`), then flies to the bag;
  - **a basic recipe:** the 3 × 3 deal, as now: 9 face-down cards, flip 3, keep 1. Quality 4 and 5 cards play `card.rare` *(Claude's idea)*.
- **Teach** stays as the window's second tab.
- **The TrailMate look (setting).** The window becomes the yellow handheld: the bench and the book become LCD screens with scanlines, resources and items show as green-screen icons (the item cards' green conversion, `31`), the book's tabs get colored LEDs, and Craft is the big round yellow button. Same layout and controls. In the prototype it's the `#cw.tm` class in `index.html`.

## 7. Night camp and level-ups
Wyatt: every night shows the XP the party earned since the last one, plays the level-up when the bar reaches the end, then goes into the skill trails, starting with a hiker picker. It plays **at the end of each night, before morning**, over the map.
1. **The scene.** The map dims to a night tint with a campfire glow on the party's tile and fireflies; `amb.fire` fades in.
2. **TONIGHT AT CAMP.** The XP since the last recap, one line at a time ([0.42 s] apart, `ui.tab`): each line an icon, what happened and +XP. Build the lines from the `xp` log events since the last recap, grouped by what caused them (scavenges, crafts, challenges passed, Wonders, checkpoints, the fire). Add a `source` to the `xp` event if `cause` isn't enough to group by. Then a total: TODAY +15 XP.
3. **The bar fills.** The party XP bar fills one XP at a time ([70 ms] each, `xp.gain` rising in pitch). If that would take longer than [3 s], fill several XP per tick *(Claude's idea)*.
4. **Level up.** When it reaches the end: PARTY LEVEL 3! stamps on with a shake, rays spin, confetti bursts, `levelUp` plays, and after [1.1 s] the bar starts over with what's left. Chips say what's new (+2 points to spend, Tier II steps open). Several levels in one night play one after another.
5. **The buttons.** SPEND POINTS (when there are points) and LATER (or CONTINUE when there are none). A click or a key skips to the end of the animation first.
6. **The picker.** SPEND POINTS deals every party hiker in as a big portrait card (`card.deal`), each with their trails' progress and how many steps they can learn now. Picking one opens Skill Trails (`SkillTrails`, Phase 10.7) on that hiker. The portraits along its top switch hikers, and PICK SOMEONE ELSE goes back to the picker.
7. **LATER** keeps the points. The Party LV pill shows a "2 POINTS" badge until they're spent *(Claude's idea)*, and clicking the pill opens the picker.
- **The pill during the day** *(Claude's idea)*: it shows the XP as of the last recap, so the level-up is tonight's surprise. The points themselves still arrive when the engine gives them (no engine change).

## 8. Title screen (`TitleScreen`)
- **The logo: Wyatt's mint lettering, grown over** (logo 4), for now. Wyatt will rework it later. Use `art/ui-overhaul/logo-4-mint-grown-over.png` (2200 × 940, transparent) as an image; when Wyatt's version arrives, it just replaces the file.
- **The background:** a parallax sunset forest from the game's backdrop layers (mountains, ridges, pine rows), each layer drifting a little with the pointer ([±6 px] for the farthest to [±30 px] for the nearest), with a sunburst behind and about [16] falling leaves.
- **The logo drops in** [0.5 s] after the screen opens, with `title.logo` (a wooden thunk) and a puff of leaves.
- **Buttons:** New Hike, Continue (with the save's day, biome and party, as `describeSave` does now) and Settings. `amb.title` and the `title` music play.

## 9. Loading screens
- **When:** entering the trail after packing, Continue from the title, and moving into a new biome. They cover preloading that biome's map art, backdrops, ambience and music. They stay at least [1.5 s] so they don't flash, and leave as soon as everything has loaded after that.
- **Both styles share:** the TrailMate's GPS greens with faint scanlines; a tip in Edit Undo near the top, changing every [3.4 s] (a list of tips in `content/`; the prototype has six to start); a segmented bar ([24] segments) under the floor, filled by real loading progress; and "LOADING THE MEADOW" (or the biome's name) under it.
- **The Runner (default).** A deep green floor across the bottom quarter with pixel trees, rocks, logs and bushes. The little hiker runs across and hops over each (`load.jump`). At the edge they sink into the floor, new ones pop up, and he turns and runs back. Port the sprites (`SPR`, drawn at [5×]) and the loop from `screens.js`.
- **The Node wheel (setting).** The four node icons orbit each other in the middle over a topo-map pattern, while Polaroid-style photos of trail scenes fade through on either side ([2.4 s] each).
- **The TrailMate and Jumper styles are set aside** (Wyatt picked these two). They stay in the prototype for reference.

## 10. Transitions
- **The spotlight** (Wyatt's main one): the screen closes to a circle around the click or the thing that matters ([0.52 s] to [90 px]), holds [0.2 s], closes to black [0.2 s], then opens from the middle of the next screen, or the thing that matters there ([0.7 s]). Sounds: `trans.irisIn` closing, `trans.irisOut` opening. Build it as one overlay with a radial mask driven by CSS variables (the prototype's `#iris`).
- **Where:** every full-screen change: title → hiker select, hiker select → packing, packing → loading → map, Continue → loading → map, map ↔ the Ranger Station, map → the summit or game-over screen, and back to the title. Windows over the map (scavenge, craft, challenges) keep their pop-in *(Claude's idea: a spotlight for every action would slow the game down)*.
- **Checking in at a station** *(Claude's idea, from Wyatt's two options)*: the spotlight closes on the party's tile and opens on the station's front doors with its sign (`art/ui-overhaul/station-door-left.svg` and `-right.svg`); [0.35 s] later the doors swing open in 3D ([1.3 s]) with `trans.door` (a creak and the shop bell) into the shop. Leaving the station is a plain spotlight back to the party's tile.
- **Reduced motion:** a [0.2 s] fade instead.

## 11. Not in this phase
These are still being designed; leave them as they are (with the new sounds) until a later package:
- **The Ranger Station** restyle (paper tags for the party bags, the shelf on workbench wood with paper price tags, the new crafting window on its Workbench tab, a paper speech bubble).
- **The challenge pop-up** restyle (a poster card, paper-tag hiker columns, cost slots that work like bench slots, a spotlight onto the TrailMate to start).
- **Night on the main screen** beyond the camp recap (a SLEEPING stamp on frames and a Zzz on tokens, night events as dealt poster cards, a sunrise sweep at dawn).
- **Hiker select, the packing screen's frame, and the settings window's look.**

## 12. Tests
- **Settings:** each of the four reads its stored value, falls back to its default on a bad one, and the screens follow it.
- **Wheel:** shows the six actions by day and the three by night; blocked actions say why; keys 1 to 6 press the right one.
- **Item pop:** each item type gets the right button; an item with nothing to do gets only Give; using one doesn't use the action.
- **Auto-fill order:** with a spare, a needed-by-another-starred and a starred resource that can all pay a slot, it picks them in that order; within a group the crafter's own goes first.
- **Stars:** saved with the hike and restored on Continue.
- **Needed:** a card is NEEDED only while a starred recipe still lacks it.
- **Night recap:** the lines add up to the day's XP; one level and two levels in a night each play the level-up the right number of times; the points match the engine's.
- **Brush:** a cover uncovers at [50%] and not before.
- **Reduced motion:** the recap, the deal, the craft and the transitions skip their animations.

## 13. Things to flag to Wyatt
My ideas in this doc, to keep or drop:
- the Runner as the default loading screen;
- keys 1 to 6 for the wheel, and the wheel opening below the token near the top edge;
- each tile's poster staying the same between visits;
- stars saved per hike, not per device;
- the rare chime for Quality 4 and 5 crafts;
- the recap filling faster when there's lots of XP, and the pill waiting for the recap;
- the POINTS badge on the pill, opening the picker;
- no spotlight on windows over the map;
- check-in as the spotlight onto the doors, then the doors opening.

---

## The pictures (`mockups/ui-overhaul/`)

| File | What it shows |
| --- | --- |
| `prototype/` | The playable prototype (serve the folder and open `index.html`). Hash links jump to a screen: `#main`, `#main-side`, `#scav`, `#scav-brush-mountain`, `#craft`, `#craft-tm`, `#night`, `#title`, `#load`, `#load-wheel`, `#trans`. |
| `01-main-wheel.png` | The main screen with the wheel over Wyatt. |
| `02-main-side-grid.png` | The side grid setting, with two tags open. |
| `03-main-frames-open.png` | Two tags open, and the hint on the wheel's Scavenge. |
| `04-item-pop.png` | Clicking an item in the pack. |
| `05-scavenge-dealt.png`, `06-scavenge-flipped.png` | The poster, the deal, the flip with the NEEDED ribbons, and Looking for. |
| `07` to `10-brush-*.png` | The brush covers, one card brushed: Forest, River, Wildlife, Mountain. |
| `11-craft-paper.png` | Crafting in the Paper look: the Sack filled, missing 1 Grass (a ghost slot). |
| `12-craft-trailmate.png`, `13-craft-trailmate-starred.png` | The TrailMate look, and its Starred tab. |
| `14-craft-basic-ready.png`, `15-craft-basic-deal.png` | A basic recipe filled, then its 3 × 3 deal. |
| `16-night-rows.png`, `17-night-levelup.png`, `18-night-done.png` | The camp recap: the lines, the level-up, the buttons. |
| `19-picker.png`, `20-trails.png` | The hiker picker, then Skill Trails on Wyatt. |
| `21-title-mint.png` | The title screen with logo 4. |
| `22-load-runner.png`, `23-load-node-wheel.png` | The two loading screens. |
| `24-spotlight-closing.png` | The spotlight closing on a tile. |
| `25-doors-closed.png`, `26-doors-opening.png`, `27-doors-open.png` | Checking in: the doors, opening, the shop. |
