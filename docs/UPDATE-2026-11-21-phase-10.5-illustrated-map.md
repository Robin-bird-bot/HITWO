# Update: November 21, 2026 (Phase 10.5: the illustrated map)

**This is the next thing to build.** Finish the change you're in the middle of, and the `update-2026-11-20-holiday-hikers-2` update if it isn't done yet. Then build this, **before Phase 11** or anything else in `BUILD_PLAN.md`.

**What this is:** a second look for the trail map, picked in Settings (**Map style: Classic or Illustrated**). The land is painted around each section's trail tree like a colorful illustrated trail map. Land nobody has explored is a pencil sketch, and it fills in with paint as tiles are revealed. Tiles become dark see-through hexes, paths wind and show who walked them, and places get Oregon names.

**It changes only how the map looks.** Tiles, connections, costs, triggers and every rule stay the same, and Classic keeps working exactly as it does now.

Numbers in [brackets] are first guesses: put them in `balance.ts` (or a new `mapStyle.ts` beside it) with `TODO(wyatt)`. Nothing here needs Wyatt's answer before building.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `01-design-doc-illustrated-map.md`: insert its contents into `docs/design/01-design-doc.md`, in "The trail map", right after the **Checkpoints** list (just before "Biomes, tiers and weather"). Then delete this file.
- `mockups/*.jpg` → `docs/mockups/illustrated-map/`. **These show what it should look like:**
  - `MapTopDown.jpg`: the chosen look, in the middle of a run;
  - `MapTrailLines.jpg`: path types, walked colors and the route view;
  - `MapTileLooks.jpg`: the four tile looks Wyatt compared; **A (dark glass) is the chosen one**;
  - `MapLayers.jpg`: how the land is built, layer by layer, and the stamp kit;
  - `MapIdeas.jpg`: night, rain and snow;
  - `MapTilted.jpg`: the tilted view. **Not built in this phase**; reference only.
- `mockups/look/*.jpg` → `docs/mockups/illustrated-map/look/`. Full-size renders of the land on its own: painted, sketch, the two mixed, three of the build layers, and the night, rain and snow grades. Match these.
- `reference/*` → `docs/design/illustrated-map/reference/`. The Python prototype that made every image above. **Read its README first.** Port the ideas and numbers, not the code.
- `assets/map/stamps/*.png` → `public/assets/map/stamps/`. Placeholder stamps, which Wyatt will replace with painted ones using the same file names.
- `assets/map/palettes.json` and `oregon-names.json` → `public/assets/map/`.
- Then delete the leftover `update-2026-11-21-phase-10.5-illustrated-map/` folder.

---

## 1. Plan changes (update `BUILD_PLAN.md` first, and commit)
- **Add Phase 10.5: Illustrated map**, with sections 2–12 below, marked as **next**.
- **Phase 11 (Biomes) stays as it is**, including Fog. (Redolf's `TODO(phase-11)` Fog hook keeps its name.) When Phase 11 adds biomes, the illustrated map just needs the section's biome passed in (section 9).
- **Phase 12 (UI overhaul)**, the "trail map's look" item becomes: "Classic look stays; the Illustrated look is done in 10.5. Left for later: Wyatt's painted stamps, tuning the Rainforest and Alpine palettes, and maybe a tilted intro shot when a section starts."

## 2. The setting
- **Settings → Map style:** `Classic` or `Illustrated`. Saved with the other settings (per device, not per run). Default **Illustrated** [first guess].
- It can be switched at any time, mid-run included. Switching regenerates the illustrated land if needed (section 8) and keeps the camera where it is.
- Everything below applies to **Illustrated only**, unless it says otherwise.

## 3. Layout: jitter and winding paths
- **Jitter:** in Illustrated, each tile is moved a little off the grid so the map doesn't look rigid:
  - x moves by up to ±[24], y by ±[16] (prototype units; see the scale note at the end of this section);
  - the size is scaled by [0.90–1.07];
  - the trailhead and the checkpoint never move.

  Use a seeded random, so the same run always looks the same. Clicks, drags and hover use the moved positions.
- **Spacing:** the land has to show between tiles. In the prototype, rows are 134 apart and the hex radius is 54, so tiles take up about 40% of a row. If Classic's tiles are bigger than that, spread the rows and columns out in Illustrated, rather than shrinking the hexes below a comfortable click size.
- **Winding paths:** each connection is drawn as a gentle curve, not a straight line. The formula is `wind()` in `reference/topo_layout.py`. For a point at `t` from 0 to 1 along the straight line, push it sideways by:

  `(a1·sin(π·t·bends + phase) + a2·sin(π·t·(2·bends + 1))) · sin(π·t)`

  where:
  - `a1` is a random [0.5–1] × amp, and `a2` a random [0.2–0.6] × amp;
  - amp is [24] between rows and [16] within a row;
  - `bends` alternates between 1 and 2.

  The curve is only for looks: the connection is the same.
- **Scale note:** all numbers in this update are in prototype units (rows 134 apart). Multiply them by `yourRowSpacing / 134`.

## 4. Generating the land
When a section starts, generate the land from the section's tiles, nodes, connections and biome. **Follow `reference/topo.py`**, which has every number. In short:

1. **Fields** on a grid (one cell per world unit, or half that on phones), all seeded:
   - **Noise:** fbm noise at 3 scales: [260], [90] and [30].
   - **Mountain influence:** a soft blob around each tile, scaled by its Mountain node count.
   - **Peaks:** a sharper blob per Mountain node, set off to one side of the tile so the tile itself stays walkable.
   - **Forest influence:** from Forest node counts.
   - **Meadow influence:** from Wildlife node counts, plus the trailhead.
   - **Off-map land:** a few extra ranges and woods outside the tree, so the edges aren't empty.
2. **Water:**
   - **The main river** enters at the top edge and leaves at the bottom. On the way it passes through every River tile in order from top to bottom, smoothed and given a natural wander.
   - **Creeks:** a River tile far from the main river gets a creek from the nearest side edge that joins the river.
   - **Ponds:** each River ×2 tile gets one, offset a little so it peeks out from under the hex.
3. **Height:**
   - It rises toward the checkpoint, with bumps from mountains and peaks, plus noise.
   - It dips along rivers.
4. **Light:**
   - Hillshade with the light from the top left.
   - Cut into **4 flat tones** at the [12%, 42%, 84%] quantiles, then smoothed so the shapes look painted rather than noisy.
5. **Land types:**
   - **rock** where the peaks are strong;
   - **forest** where the forest field wins, but never on rock, near water, or in a small clearing under each tile;
   - **bank** next to water;
   - **meadow** everywhere else, using two meadow palettes mixed in large patches.
   - Each type gets its 4 tones from `palettes.json`. Higher land is tinted [10%] toward the haze color.
6. **Contours:** about [26] levels, every 5th one heavier, in the palette's contour color at [30%].
7. **Details:**
   - flowers and grass ticks in meadows;
   - cracks on rock;
   - on the water, a sand edge, shallows, water and a deep center, with a few short ripples (not a center line, or it looks like a road).
8. **Tree crowns:** small top-down crowns on a jittered grid inside the forest, drawn lowest last so they overlap like a slight angle.
   - [42%] are conifers (spiky);
   - the rest are round, and in clustered patches [16%] are autumn-colored;
   - each crown has a shadow offset to the lower right, a base, and a highlight at the upper left.
9. **Paper:**
   - fine grain plus faint horizontal brush streaks over everything;
   - a warm wash at the top left and a slight cool shade at the bottom right.

**The pencil sketch** is a second image of the same land:
- paper color with grain;
- graphite contours;
- rivers as two ink lines;
- about [28%] of the trees as little tree symbols (an arch and a stem);
- diagonal hatching in the shadow tones and on rock.

**Size:** the land extends [300] units past the tree's bounding box on every side. Past that is plain paper, so panning never finds an edge.

## 5. Stamps
Placeholder PNGs are in `public/assets/map/stamps/`: `conifer`, `leafy-tree`, `autumn-tree`, `bush`, `rock`, `peak`, `cabin`, `fire-lookout`, `bridge`, `tent`, `deer` and `waterfall`. They're drawn side-on, with the base at the bottom center. Scatter them into the painted land (not the sketch), seeded:
- side-on trees and bushes along forest edges, about [1 per 40 units] of edge;
- a `rock` or `peak` on the strongest peaks;
- a `cabin` near the trailhead;
- a `fire-lookout` beside each Overlook tile (outside the hex);
- a `tent` beside each Campsite tile;
- [1–2] `deer` in the largest meadow;
- a `waterfall` where the river crosses its steepest drop, if the drop is big enough [height change over 40 units > 0.12].

Each stamp gets a soft oval ground shadow. Sizes: trees and peaks about [26 units] tall, small things about [14]. Keep stamps out of tile hexes and off paths. Wyatt's painted versions will drop in with the same names. If one is missing, skip it.

## 6. Painted as you explore
- **Unrevealed land is the sketch; revealed land is the painted map.**
  - "Revealed" means any tile whose nodes are revealed by the game's existing reveal rules (entering, Scout, Overlook and so on), plus the trailhead area at the start.
  - **Fog** (when Phase 11 adds it) hides nodes but doesn't un-paint the land.
- **Mask:**
  - Each revealed tile adds a soft disc of radius [150], fading over [70], with its edge broken up by noise. See the reveal mask code in `topo.py`.
  - Where the mask is about half, darken the paint by up to [16%] in a thin band. It looks like watercolor pigment pooling at the edge.
- **Animation:**
  - When a tile is revealed, its disc grows from 0 to full over [1.2 s] (ease-out), like paint soaking into paper.
  - Only redraw the part of the mask that changed.
  - Several reveals at once animate together.
  - With reduced motion, the area just appears.
- **On load:** the mask is rebuilt from the saved reveal state with no animation.

## 7. Drawing the map
Stack three layers inside the existing map viewport, all moving with the same pan, zoom and scroll as Classic:
1. the sketch canvas;
2. the painted canvas, shown through the reveal mask;
3. the overlay: paths, bridges, badges, tiles, hiker tokens and labels. SVG or canvas, whichever is faster in your setup.

**Paths** (in Illustrated; the numbers are in `gen11.py` → `path_svg`):
- **Under every path:** a soft cream track, `#F4EDDA` at [42%], [8] wide.
- **Unwalked paths are gray** (`#77736A`):
  - **normal:** dashed [10 on, 7 off], [3.6] wide;
  - **steep, muddy, rough:** dotted (round dots [8.5] apart), [5.6] wide, with the existing cost badge at the middle;
  - **paved:** solid, with a wider cream track and the existing FREE badge.
- **Walked paths** take the walker's party color and get [15%] wider, with a thin dark outline (`#1D2220` at [50%]) so they read on any land:
  - a walked **normal** path turns **solid**;
  - walked steep, muddy and rough paths **stay dotted**, so their cost still shows;
  - paved stays solid.
- **Bridges:** where a path crosses a river or creek, draw a small plank bridge across it, rotated to the path. Skip it inside a tile hex, and draw only one for crossings close together.

**Tiles** (the chosen look, **dark glass**; see `gen11.py` → `tile_svg`):
- **Revealed tile:**
  - a hex with fill `#0F1A16` at [50%] ([36%] once visited);
  - a cream edge (`#F7F1E4`, [2.2] wide);
  - a faint inner line at 90% size;
  - the land shows through, with no blur.
- **Unrevealed tile:** pencil.
  - paper fill (`#EEE5CB` at [45%]) and a dashed graphite edge (`#5E5648`);
  - node chips as pencil hexes with "?";
  - its special icon in pencil colors.
- **Node chips:** small hexes along the bottom of the tile, using the existing node icons.
- **The special space icon:** in the center until a hiker has landed on the tile, then it moves to the top-right corner, as in Classic.
- **Hiker tokens:** round portraits with a ring in the hiker's party color, side by side in the tile.

**Labels** (section 10):
- Fraunces italic, weight 600, about [14–17] px, with a soft cream halo. Add the font locally, for example with `@fontsource/fraunces`.
- Colors: water `#1F5E6E`, lookouts and peaks `#5A3F66`, woods and meadows `#2A4A3A`.

**Map furniture**, fixed to the screen, not the map:
- a small compass rose;
- a title box ("MEADOW", "SECTION I · TIER I · DAY 3") with a scale bar;
- a **Legend** button that opens the line legend from `MapTopDown.jpg`.

Place them so they don't sit under the existing HUD panels.

## 8. Performance and caching
- **Determinism:** the land depends only on the run seed, the section index, the biome and the tiles. Don't save any images. Regenerate on load: the same seed gives the same map.
- **Where it runs:** in a Web Worker with `OffscreenCanvas` where available. Otherwise, run it on the main thread behind a short "Drawing the map…" overlay.
- **Resolution:** the canvas scale is `min(devicePixelRatio, 2)`, and **1 on phones**. Field grids are at 1 cell per unit (2 per cell on phones).
- **Budget:** under [1.5 s] on a laptop for a full section. Show the time in the debug panel.
- **Cache:** keep the current section's canvases in memory. Throw away the previous section's once the next one starts.
- **If generation fails or takes over [6 s]:** fall back to Classic for that section, log it, and show a small toast: "Using the classic map for this section."

## 9. Biomes and time of day
- **Palettes:** `palettes.json` has one each for `meadow`, `rainforest` and `alpine`.
  - Until Phase 11 assigns biomes, use `meadow` for every section.
  - Alpine has no autumn trees, and turns rock white above `snowAbove` (as a fraction of the height range).
- **Night, applied to the land layers only (tiles and paths stay as they are):**
  - colors become `lum·[0.36, 0.44, 0.72]·0.8 + rgb·[0.22, 0.30, 0.42] + [0.03, 0.04, 0.11]`;
  - add a warm glow (`[0.55, 0.32, 0.12]`, radius [60]) around tiles where hikers sleep in a shelter or Sit by the Fire, and around Campsites with hikers on them.
  - Do it as a grade (a shader, or a filter plus overlay), not a regeneration.
- **Weather**, as grades on the land:
  - **Rain:** 78% color + 22% gray, slightly cool and darker, with slanted streaks drifting down (animated, off under reduced motion).
  - **Snow:** open ground above [45%] brightness fades to white over a [0.2] ramp; trees stay dark.
  - **Heatwave:** a warm wash.
  - **Storm:** rain, a bit darker.

## 10. Oregon place names
- **Features to name**, found while generating:
  - the main river (`river`) and each creek (`creek`);
  - each pond (`pond`);
  - each Overlook tile (`lookout`);
  - each forest patch bigger than [6 tiles' area] (`woods`);
  - each meadow patch bigger than [4 tiles' area] (`meadow`);
  - each peak strong enough to get a `peak` stamp (`peak`);
  - each waterfall (`falls`).
- **Names:** from `oregon-names.json`. Shuffle each list once per run with the run seed, and take names in order, section after section, so **nothing repeats in a run** and a reload gives the same names. Nothing extra to save.
- **Placement:**
  - rivers and creeks along a calm stretch of the line, rotated to it;
  - ponds beside the water;
  - lookouts beside the tile;
  - woods, meadows and peaks at the patch's center.
  - Never under a tile, and never overlapping another label.
- **A label appears only once the paint covers its spot.** It fades in with the paint.
- **Trail log:** the first time a named place appears, add a line like "Found Tumalo Pond."

## 11. Walked paths and the route view (both map styles)
- **Data:**
  - Each connection gets `walkedBy: hikerId | null`, set the **first** time any hiker crosses it, in either direction, and never changed after.
  - For a **Move All**, it's the hiker who did the move.
  - Saved with the run.
  - Old saves start with every connection unwalked.
- **Classic:** color walked lines in the walker's party color too, keeping Classic's own line styles. The dashed-to-solid change is Illustrated only.
- **Route view:** a **Routes** button on the map toolbar, also on hold of `Tab`. It's a toggle on phones.
  - The land fades (`saturate(0.35) brightness(0.72) contrast(0.9)`, or the same as a grade).
  - Tiles shrink to faint outlines (fill `#0F1A16` at [25%], edge at [35%]); tokens and labels hide.
  - Unwalked paths drop to [25%].
  - Walked paths stay bright, with a small legend of hiker colors.
  - Classic uses the same toggle: dim everything except walked lines.
  - It never blocks input: releasing Tab or pressing the button again returns to normal.

## 12. Debug panel and tests
**Debug panel:**
- switch the map style;
- regenerate with a new seed;
- reveal all or hide all (to see the sketch);
- replay the reveal animation on a chosen tile;
- show the land-type mask, the height map and the reveal mask;
- the generation time;
- force night, rain or snow;
- toggle the route view;
- show the stamp placement boxes.

**Tests:**
- **Deterministic:** the same seed, section and tiles give identical fields (compare a hash) and identical names, and a different seed gives different ones.
- **Built from the nodes:**
  - the river passes within a tile radius of every River tile's center;
  - every River ×2 tile has a pond;
  - peaks sit near Mountain tiles;
  - no forest or stamps inside any tile hex;
  - no stamps on paths.
- **Jitter:** within the limits; the trailhead and checkpoint don't move; clicks land on the moved hexes.
- **Paths:**
  - `walkedBy` is set by the first crosser only;
  - a Move All uses the mover;
  - a walked normal path is solid, and walked dotted paths stay dotted;
  - old saves load with nothing walked.
- **Reveal:**
  - revealing a tile adds paint around it;
  - a reload rebuilds the same mask;
  - reduced motion skips the animation.
- **Names:** no repeats across a 3-section run; a label stays hidden until its spot is painted; the "Found …" log line appears once.
- **Setting:** switching styles mid-run keeps the game state and camera; Classic is unchanged apart from colored walked lines and the route view.
- **Fallback:** a forced generation error falls back to Classic with the toast.
- **Performance:** generation under the budget on the test machine (log it, don't fail CI on it).
