# Assets

Wyatt made all of the art. Wyatt keeps the full-resolution masters (the original MomGame card images and his export zips), so ask him for a bigger version if something looks soft.

| Folder | Contents | Notes |
| --- | --- | --- |
| `fonts/` | Edit Undo, Edit Undo Dot, Edit Undo Line (Brian Kent), Game Quotes (Typia Nesia) | See "Licensing" below |
| `resources/` | all 16: clay, fish, fur, grass, meat, metal, moss, mushroom, oil, seaweed, shell, stone, wood, bones, flint, salt | Transparent PNGs. mushroom is only 128px |
| `nodes/` | forest, river, wildlife, mountain; fire, frozen, flooded | Hex node badges for tiles and card backs. Fire, Frozen and Flooded (750×750) are the weather node states (Phase 6). The game uses copies cropped to the hex (104×120) in `public/assets/nodes/<state>.png` on tiles, and 128 px squares (`<state>-square.png`) on the weather change screen |
| `scavenge/backdrops/` | forest, river, wildlife, mountain, any-node, caps (brown redwoods), items (rainbow mountain lake) | **Blank** 750×750 card backgrounds with no rays. The game layers rays and icons on top |
| `scavenge/rays/` | forest, river, wildlife, mountain, caps, any-node-cream, items-white | Full-opacity sunburst rays, one color per backdrop. See "Scavenge card layers" below |
| `scavenge/backs/` | caps-back-icon, item-back-icon | Transparent hex icons laid over the caps and items backdrops to make those card backs. Node backs use `nodes/` |
| `scavenge/examples/` | wood, wood-and-moss, wild-forest, choice-forest, wild-any-node | Finished faces Wyatt made, for reference only |
| `textures/pixel-halftone.png` | Pixel halftone pattern (black on transparent, 750×1500) | Card backs at about 55%, large backgrounds at about 10% |
| `backgrounds/` | 15 layers, 3200×2000 WebP, numbered as Wyatt's originals | See "Backdrop layers" below |
| `sky/` | sun (soft glow), moon | 1500×1500 transparent PNGs |
| `icons/acorn-caps.png` | Acorn caps icon | Stand-in drawn in code to match the resource style. Wyatt may repaint it |
| `item-cards/` | `gradients/`, `type-icons/`, `rays/` (one per type), `front-background.png`, `palette-reference.png` | Layers the game builds item cards from. See "Item card layers" below |
| `item-card-front-background.png` | The card front background (Nov 7), cropped to square corners (1422×1982) | Round it in CSS to match the card: `border-radius` 7.5% of the card's width, `overflow: hidden`. Supersedes `item-cards/front-background.png` for the card front. The game loads a 717×1000 JPEG copy, `public/assets/item-cards/front.jpg` |
| `items/` | 141 item images, one per item, named after it (`fishing-rod.png`, `din-tai-fung.png`…) | Trimmed and evened out on a 1024×1024 transparent square. The game loads 384 px copies from `public/assets/items/<art>.png`, via `ASSETS.itemArt(art)` |
| `items/presents/` (holiday hikers) | The Present's 5 wrappings: `present-1-candy-cane`, `-2-holly`, `-3-lilac`, `-4-midnight`, `-5-berry` | Wyatt's files were on the 1500×2100 item-card canvas; trimmed and evened out on a 1024×1024 square like the other items. The game loads 384 px copies from `public/assets/items/presents/`, picked by the Present's colorway. The top 41% is the lid and bow (the opening animation lifts it off) |
| `item-cards/samples/` | bandages, hatchet, jerky, net, rain jacket, shovel, trail mix, trail shoes | Old flat card art from the card game, for reference only |
| `portraits/` | placeholder, placeholder-character-card | The old stand-ins. Since Phase 10b the real portraits are in `public/assets/portraits/` (see below) |
| `shopkeepers/` | The 8 ranger station shopkeepers (Nov 13): fancy-finn, chef-bear-ellie, sleepy-wink, serious-businessman (+ `-arm`), rocco-raccoon, doctor-sckhunk, bear-e-i, bearnes-and-nobles; `lineup.png` is a reference only | 465×800 transparent PNGs, all at one scale and anchored at the bottom, so they stand behind the counter as they are (don't trim or rescale them). `serious-businessman-arm.png` is a second layer that goes in front of the counter. The game loads copies from `public/assets/shopkeepers/` (not the lineup). See `design/06-ranger-stations.md` |
| `art/` | challenge-bear, challenge-fallen-tree | Early challenge pop-up art (superseded by `challenges/`) |
| `challenges/` | One 1920×1080 JPEG per challenge and Trial (96), named after it (`flies.jpg`, `the-grim-sleeper.jpg`…) | Challenge and Trial pop-up art at 16:9. The game loads shrunk copies (960×540 JPEG) from `public/assets/challenges/<id>.jpg`, via `cardArt(card)` |
| `opportunities/` | One 1920×1080 JPEG per opportunity (17): `snake-slots.jpg`, `citro-tub.jpg`… | Opportunity pop-up art. Shrunk copies (960×540) in `public/assets/opportunities/`, via `cardArt(card)` |
| `wonders/` | One 1920×1080 JPEG per Wonder (7): `crater-lake.jpg`, `multnomah-falls.jpg`… | The Wonder pop-up's full-width banner. Shrunk copies (1600×900) in `public/assets/wonders/`, via `wonderArt(id)` |
| `night-events/` | One 1920×1080 JPEG per night event creature (15): `raccoons.jpg`, `cultists.jpg`… | The night event window's banner. Shrunk copies (960×540) in `public/assets/night-events/<id>.jpg`, via `ASSETS.nightEvent(id)` |
| `public/assets/traits/` (Phase 10b) | 161 trait icons, white on transparent, cut with almost no margin | Named by the trait's **name** in lowercase with dashes (`dog-mom.png`). Shared ones: `puller`, `glutton`, `node-finder`, `node-hound`, `node-thumb`, `location`, `action`, `conservationist`; `thrill-seeker` and `thrill-seeker-morale`; `tag-team`. Drawn through a CSS mask in the type's ring color, filling and clipped to the badge |
| `public/assets/portraits/` (Phase 10b; holiday hikers) | 42 portraits (750 × 620, already framed for the card's portrait window) and `portraits.json` | Draw each at the full window from the top-left, never cropped one by one. `portraits.json` gives each one's `faceY` (0 top, 1 bottom) for wherever only part shows. Humans share one head size and pets another; Gdog and Leah are short on purpose. The holiday update added the 7 variants (Follower Finn, Agility Finn, Ellie the Devourer, Nosework Ellie, Prepared Wink, Graduate Mom, Showqueen Gdog) and the 4 holiday hikers (Grammy Clause, Lelf, Grinch, Redolf). Costume art fits the whole costume, so it isn't on the others' head scale, on purpose: never rescale it |
| `public/assets/cards/` (Phase 10b) | `forest.png` and `pixel-pattern.png` (the portrait background, 1600 × 930 since the holiday update, so they stay sharp), and `family/` (human, dog, cat, plush, duo and the variant star) | The family icons are white on transparent, drawn in `#1A1A1A` through a mask |
| `public/assets/map/` (Phase 10.5) | `stamps/` (12 placeholder stamps: conifer, leafy-tree, autumn-tree, bush, rock, peak, cabin, fire-lookout, bridge, tent, deer, waterfall), `palettes.json` (the land colors for meadow, rainforest and alpine) and `oregon-names.json` (place names) | The illustrated map. Stamps are side-on with the base at the bottom center; Wyatt's painted ones will replace them with the same names, and a missing one is skipped. The mockups are in `docs/mockups/illustrated-map/` |
| `src/shaders/hiker-select-bg.frag` (Phase 10b) | The selection screen's animated background, a WebGL2 fragment shader | Colors from the family update: `#0C1411`, `#1D3129`, `#476055`, `#E9B44C`; without WebGL2, plain `#0C1411` |

**Game copies.** The game loads smaller copies from `public/assets/`. The scavenge backdrops are 400 px JPEGs (they have no transparency), and the rays and back icons are 400 px PNGs. The item card type icons and rays are 300×420 PNGs. The masters in `/assets` stay full size.

## Scavenge card layers

From back to front:

1. **Blank backdrop** for the card's node (or caps, items, any-node).
2. **Rays**, in the matching color, rotating slowly:
   - Draw the rays at about 145% of the card size, centered, so the corners stay covered while it turns.
   - Opacity:

| Backdrop | Rays file | Opacity |
| --- | --- | --- |
| forest | forest | ~35% |
| river | river | ~35% |
| wildlife | wildlife | ~35% |
| mountain | mountain | ~35% |
| caps | caps | ~32% |
| any-node | any-node-cream | ~22% |
| items | items-white | ~22% |

3. **Content:**
   - the resource icon(s) and ×2/×3 badge;
   - or the Game Quotes `?` / `!` glyph;
   - or the caps icon;
   - or an item card back.
4. **Card backs only:** the hex icon, plus the pixel texture at about 55%.

## Item card layers

All item cards are 5:7 (Wyatt's files are 1500×2100). The game builds every card from these layers, so new items only need an icon. See the "Item cards" board (`ItemCards.dc.html` / `ItemCard.dc.html`).

**Back**, from back to front:
1. The type's gradient, animated: a CSS `linear-gradient(155deg, …)` of the type's colors, with `background-size` about 260% and a slow position shift (about 9 s, alternating). `gradients/<type>.png` is the reference for how it should look.
2. `rays/<type>.png` at about 28%, drawn at 150% of the card height, centered, rotating slowly.
3. The pixel texture at about 18%.
4. `type-icons/<type>.png`, a white icon already positioned on a full-size canvas.

**Front**, from back to front:
1. The same animated gradient.
2. `front-background.png`: the brown card with the cloud. Its transparent margin (about 2.4% at the sides and 2.7% at the top and bottom) lets the gradient show through as the border.
3. The type's rays, masked to the cloud area at about 40%, rotating slowly.
4. The item's art from `items/` (141 of them). The Pumpkin Pie, Energy Drink and Ring have none yet, so they show their type icon.
5. Text below the cloud, in the game fonts:
   - name (Edit Undo) and tier;
   - type and slot;
   - effect (DM Sans), with Quality-scaled values marked (X);
   - Quality pips (tools, food and clothes only) and uses or days.

**Type colors** (sampled from Wyatt's palette page; dark to light):

| Type | Colors |
| --- | --- |
| Tool | `#ed642b` `#f08c35` `#f0ab35` `#ecf035` |
| Clothes | `#5e3023` `#895637` `#c18553` `#e6b389` |
| Food | `#3a7752` `#45a86c` `#c7da7b` `#dced9a` |
| Shelter | `#83c4ed` `#545c8e` |
| Trinket | `#e2a9f1` `#d675ef` `#9a3f64` `#cd1f66` |

The palette page's labels for the second clothes swatch, the second food swatch and the fourth food swatch were copied from other rows. The values above are the swatches' real colors.

## Backdrop layers

The sky is a CSS gradient that changes with the phase (see "UI patterns" in the build plan), so no cloud layers are used. `sky/sun.png` and `sky/moon.png` sit on the sky, and stars are Edit Undo `*` characters. Stack the land layers back to front:

| Biome | Land layers |
| --- | --- |
| Meadow | 241 mountains-blue → 240 ridge-green-with-trees → 247 grass-hills-foreground |
| Temperate Rainforest | 242 hills-teal → 239 forest-misty → 247 grass-hills-foreground |
| Alpine | 241 mountains-blue → 250 snowy-pines-watercolor |
| Ranger station window wall (Phase 9) | 241 mountains-blue → 271 pine-row-navy → 266 pine-forest-dense → 265 pine-row-bright, darkened to about 42–60% brightness behind wooden window frames |

**Using the backdrop in the game**
- Behind the map, add a light cream wash (about 25–35%) by day so tiles and lines stay readable. At night, use almost none.
- The cloud and sky layers (243, 244, 245, 248, 249) and 246, 251, 252 and 253 are spare. The watercolor ones could suit the title, station or end screens.
- **Layers 260–271** (originals 6400×4000; here 3200×2000) give the biomes more variety:
  - snow and ice peaks: 260, 261, 263;
  - purple and gold peaks with a meadow: 262;
  - green forests and pine rows: 264, 265, 266;
  - a bushes frame: 267;
  - snow drifts and snowy pines: 268, 269;
  - navy pine rows: 270, 271.
- The ranger station uses 265, 266 and 271 (game copies in `public/assets/backgrounds/`). Ask Wyatt which others to use. For example, Alpine could be 263 → 261 → 269 → 268, and the Rainforest could add 266 or 264.

## Minigames (Phase 10.8)

- **Bearrels in the GPS greens** (`public/assets/minigames/bearrels/gps-pixel/` and `gps-drawn/`, originals in `assets/minigames/bearrels/`): Detailed pixel (1 px per scene unit) and Drawn 2D (4 px per unit) versions of the same 320 × 240 scene: the background, the foreground grass, the log, the bear (hidden, aiming middle, aiming to the side), barrels and shadows in three sizes, the crosshair, the muzzle flash, and each hiker from behind at three sizes (100, 80, 62). `layout.json` (in `bearrels/`) has every position for both, plus the ten LCD greens. The `_reference-*.png` frames show the expected result; they're kept in `assets/` only and never loaded.
- **Puzzle minigames, placeholder art** (`public/assets/minigames/`, originals in `assets/minigames/`; Phase 10.8 step 2), all in the LCD greens: `traildle/` (the wooden sign and its arrows), `find-object/snacks/` (12 trail snacks at 16 × 16; `_snacks-sheet-8x.png` is a reference sheet, kept in `assets/` only), `remember-path/` (the ranger facing down, up and sideways, and footprints) and `forest-tiles/` (hidden, trees, trail, lit and trailhead tiles, shared by Remember the Path and Find the Path). Real art comes later.
- **Dodge, placeholder art** (`public/assets/minigames/dodge/`, originals in `assets/minigames/dodge/`; Phase 10.8 step 3), in the LCD greens: the party sprite (`person.png`, its white pixels tinted in the active hiker's color), two bee frames, the bear's head and the sword. Added in step 3b: the bobcat's and squirrel's heads, a claw mark, the jaw, a honey drop, three acorn stages and their crumbs, the acorn bomb (plain and lit), shrapnel, a running squirrel, a pinecone and a moose. Added in step 3c: a nut for Wall scurry, and the Woods Monster's art (his head, a hooded cultist, a candle, two flame frames, a wisp, a rune, the eye and a grasping hand). Real art comes later.
- **Trail Map, Memory Puzzle, Picture Puzzle and Thin Ice, placeholder art** (`public/assets/minigames/trail-map/`, `memory/`, `picture-puzzle/` and `thin-ice/`, originals in `assets/minigames/`; Phase 10.8 step 4), in the LCD greens: five trail pieces (dead end, straight, corner, tee, cross) at 16 × 16, each with a lit version; a card back and face at 22 × 26 (the snacks come from `find-object/snacks/`); four 120 × 120 pictures cut from the Bearrels scenes (bear, peaks, oak, camp; replaced by Wyatt's photos in step 6 and deleted); and the lake's ice, open ice, hole and flag at 12 × 12. Real art comes later.
- **Trail Blocks, Sleeping Bear and Whackoon, placeholder art** (`public/assets/minigames/trail-blocks/`, `sleeping-bear/` and `whackoon/`, originals in `assets/minigames/`; Phase 10.8 step 5), in the LCD greens: the first-person trail backdrop; the axe, pickaxe, bucket and whistle in their frames (160 × 124), each with a `-sleeve` layer tinted in the hiker's color; the tree and rocks in five stages, the felled tree, rock chips, a splash, the water's surface, whistle waves and four animals; the sleeping bear (two sleep frames, stir, awake, roar), the bear's backdrop, Zzz and a walking hiker (tinted); and Whackoon's campsite, trash cans, raccoon and skunk frames, the frying pan, the spray and stars. Real art comes later.
- **After the playtest** (Phase 10.8 step 6): Dodge's solid portraits (`public/assets/minigames/dodge/portraits/solid/` and `solid-red/`: bee, bear, bear-sword, bobcat, squirrel, moose, woods-monster and cultist, each with a `-blink` frame; one dark green with the details cut out, and red accents in `solid-red`); Wyatt's six photos for Picture Puzzle (`picture-lake-island`, `-mountain-lake`, `-green-valley`, `-foggy-forest`, `-canyon-trail` and `-rocky-butte`, 120 × 120, tinted into the GPS greens), which replace the placeholder pictures; Trail Map's trail sign (plain and lit); and Whackoon's raccoon masks (`raccoon-up-mask`, `-peek-mask` and `-bonk-mask`, tinted in a hiker's color).
- **Step 7** (end screens, fixes and the lane games): Dodge's portraits are now only `solid-red/` (the plain `solid/` folder is gone), with `<name>-bob` and `<name>-bob-blink` frames for the idle-bob animals; the Woods Monster's hands (`monster-hand`, `-grab`, and their `-light` versions for inside the box; `eye.png` is gone). Wyatt's reference sprites for the Trail Blocks, recolored into the GPS greens (credited in `assets/minigames/trail-blocks/CREDITS.md`): the tools on their own (`tool-axe`, `-pickaxe`, `-bucket`, `-whistle`) and their swing frames, the pine `tree-0` to `tree-4` with `tree-stump`, the rock pile `rocks-0` to `rocks-4`, `rock-chips` and `splash` (the `-sleeve` layers and `tree-cleared.png` are gone). Whackoon's ribbed `can` and `can-open` (36 × 44) and the mallet (`mallet-ready`, `mallet-whack`; the frying pan is gone). Placeholder art for the lane games in `crossing/` (tiles, vehicles, logs, turtles and critters), `train/` (rail, engine, boxcar, tanker and headlight) and `rafting/` (water, bank, raft, rocks, rapids and dock).
- **The quick games, placeholder art** (Phase 10.8 step 8; `public/assets/minigames/trail-blazes/`, `firefly-catch/`, `size-up/`, `safari/`, `fly-swatter/` and `raccoon-shuffle/`, originals in `assets/minigames/`), in the GPS greens: the woods backdrop, trunk and blazes (plain and lit); the night meadow, the firefly (bright and dim) and the jar with 0 to 3 fireflies; the field-guide page, the ground and six finds, each with a sketch (pinecone, acorn, mushroom, leaf, feather, paw print); the hillside, a bush, a sign and eight animals with two walking frames each (deer, raccoon, turkey, rabbit, fox, bear, bird and Bigfoot); the picnic blanket, the fly, the bee, the swatter (ready and swatting) and a splat; and the trailhead pad, the raccoon's card and the EMPTY tag. Raccoon Shuffle reuses Whackoon's `can`, `can-open` and `raccoon-up`. Real art comes later.
- **Hiker art in minigames:** color-coded hikers seen from behind in Bearrels, and colored circles with an initial in the puzzle games. Wyatt will draw detailed hikers later.
- **Posters** (`public/assets/posters/`, 1200 × 1800): `bear-country.png`. Wyatt is painting the rest; a challenge without one shows a plain cream panel.
- **The party GPS** is drawn in CSS and SVG: no image files.

## Still missing

- **Bigger icon:** a hi-res mushroom.
- **Character art:** portraits for Ben and Mindy (they show their family icon for now).
- **Illustrated map stamps (Phase 10.5):** Wyatt's painted versions of the 12 placeholder stamps in `public/assets/map/stamps/`, with the same file names.
- **Wind (Phase 10.6):** the animated Wind icon is a placeholder drawn in code (three curved gusts, `src/ui/weather/WeatherIcon.tsx`), and so is its small stroke icon. The wood table, the paper sheet and the map's corner pieces are drawn in code too.
- **Holiday trait icons:** the 14 holiday traits (`gift-wrapper.png`, `down-the-chimney.png`, `checking-it-twice.png`, `wreck-the-halls.png` and the rest, named after the trait). Their badges show initials until they arrive.
- **Skill Trails icons (Phase 10.7):** 14 traits have no icon yet. Their badges show a placeholder: the badge shape in the class color with a small class glyph drawn in code (`src/ui/trails/glyphPaths.ts`). Name each file after the trait in lowercase with dashes, and an upgrade uses its first version's file:
  - Finn: Never Alone (`never-alone.png`).
  - Ellie: Garbage Connoisseur (I–III), Furrager (I–II), Fur Trade.
  - Mom: Agility Class (I–II).
  - Gdog: Family Cookbook, Clothing Catalogue, Homemade.
  - Wink: Lead the Way (I–II), Floor Plans, Packed Toolbox, The Proper Way, Prepper.
  - Wyatt: Toy Chest.
  - The rest reuse the old traits' icons: Leash Puller (`puller`), Whatcha Up To? (`follower`), Copydog, Singer, Loud, Dog Mom, MBA, Experienced Traveler (`wanderlust`), Short, Just Around the Next Corner, Rain Lover, Rule Changer, and the Artisan and Master steps (`artisan-cook`/`master-cook` for Chef, `-tailor` for Seamstress, `-architect`, and `-crafter` for Smith).
- **Morale type symbols (Phase 10.7):** the 7 types (Extrovert, Introvert, Ambivert, Foody, Energetic, Wanderlust, Homebody) use placeholder line symbols drawn in code (`src/ui/trails/glyphPaths.ts`), from the legend board.
- **Class glyphs (Phase 10.7):** the 19 small class glyphs in placeholder badges are drawn in code too.
- **Item art:** the Pumpkin Pie, Energy Drink and Ring (they show their type icon for now), and the Phase 10.7 trinkets Field Notebook and Merit Badge (names are placeholders too).
- **Special-space icons:** the mockups use simple stroke icons (`docs/mockups/Ic.dc.html` has the SVG paths).
- **Biome layers:** a rainforest foreground, and alpine snow and rock layers in the flat style.
- **Ranger station (Phase 9):** the stone fireplace (`src/ui/station/fireplace-stones.svg` and CSS flames), the hanging sign, the counter and the brass caps plaque are drawn in code. The specials (Cement Mixer, Scout Report, Taxi Service) and the shop's blueprint squares use stroke icons. Wyatt may want to paint any of them.
- **Merchant and Traveling Trader:** no art yet. Their window and the map use the bag and backpack icons.
- **Empty scavenge card (Phase 9.5):** a placeholder face, drawn in code. It shows the node's backdrop, faded, with "EMPTY" in Edit Undo (`src/ui/scavenge/ScavCard.tsx`). Wyatt may want to paint one.
- **Test hikers (Phase 10a):** no art, on purpose. They're drawn as a colored circle with their initials (`src/ui/hikers/portraitArt.ts`) and never appear in the real roster.

Until real art arrives, use clearly marked placeholders.

## Licensing

- **Edit Undo:** freeware from Brian Kent. See `fonts/edit-undo-README.txt`.
- **Game Quotes:** © Typia Nesia. Wyatt confirmed his license covers use in the game on the web.
- **DM Sans** and **Fraunces** (the illustrated map's place names, italic 600, Phase 10.5): SIL Open Font License, bundled from the `@fontsource` npm packages, so nothing to copy into `public/`.
