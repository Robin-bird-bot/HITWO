# Assets

Wyatt made all of the art. Wyatt keeps the full-resolution masters (the original MomGame card images and his export zips), so ask him for a bigger version if something looks soft.

| Folder | Contents | Notes |
| --- | --- | --- |
| `fonts/` | Edit Undo, Edit Undo Dot, Edit Undo Line (Brian Kent), Game Quotes (Typia Nesia) | See "Licensing" below |
| `resources/` | all 16: clay, fish, fur, grass, meat, metal, moss, mushroom, oil, seaweed, shell, stone, wood, bones, flint, salt | Transparent PNGs. mushroom is only 128px |
| `nodes/` | forest, river, wildlife, mountain; fire, frozen, flooded | Hex node badges for tiles and card backs. Fire, Frozen and Flooded (750×750) are the weather node states (Phase 6) |
| `scavenge/backdrops/` | forest, river, wildlife, mountain, any-node, caps (brown redwoods), items (rainbow mountain lake) | **Blank** 750×750 card backgrounds with no rays. The game layers rays and icons on top |
| `scavenge/rays/` | forest, river, wildlife, mountain, caps, any-node-cream, items-white | Full-opacity sunburst rays, one color per backdrop. See "Scavenge card layers" below |
| `scavenge/backs/` | caps-back-icon, item-back-icon | Transparent hex icons laid over the caps and items backdrops to make those card backs. Node backs use `nodes/` |
| `scavenge/examples/` | wood, wood-and-moss, wild-forest, choice-forest, wild-any-node | Finished faces Wyatt made, for reference only |
| `textures/pixel-halftone.png` | Pixel halftone pattern (black on transparent, 750×1500) | Card backs at about 55%, large backgrounds at about 10% |
| `backgrounds/` | 15 layers, 3200×2000 WebP, numbered as Wyatt's originals | See "Backdrop layers" below |
| `sky/` | sun (soft glow), moon | 1500×1500 transparent PNGs |
| `icons/acorn-caps.png` | Acorn caps icon | Stand-in drawn in code to match the resource style. Wyatt may repaint it |
| `item-cards/` | `gradients/`, `type-icons/`, `rays/` (one per type), `front-background.png`, `palette-reference.png` | Layers the game builds item cards from. See "Item card layers" below |
| `item-cards/samples/` | bandages, hatchet, jerky, net, rain jacket, shovel, trail mix, trail shoes | Old flat card art from the card game, for reference only |
| `portraits/` | placeholder, placeholder-character-card | **Use the placeholder for every hiker for now.** Real character art comes later |
| `art/` | challenge-bear, challenge-fallen-tree | Early challenge pop-up art (superseded by `challenges/`) |
| `challenges/` | One 1920×1080 JPEG per challenge and Trial (96), named after it (`flies.jpg`, `the-grim-sleeper.jpg`…) | Challenge and Trial pop-up art at 16:9. The game loads shrunk copies (960×540 JPEG) from `public/assets/challenges/<id>.jpg`, via `cardArt(card)` |
| `opportunities/` | One 1920×1080 JPEG per opportunity (17): `snake-slots.jpg`, `citro-tub.jpg`… | Opportunity pop-up art. Shrunk copies (960×540) in `public/assets/opportunities/`, via `cardArt(card)` |
| `wonders/` | One 1920×1080 JPEG per Wonder (7): `crater-lake.jpg`, `multnomah-falls.jpg`… | The Wonder pop-up's full-width banner. Shrunk copies (1600×900) in `public/assets/wonders/`, via `wonderArt(id)` |
| `night-events/` | One 1920×1080 JPEG per night event (15): `raccoons.jpg`, `cultists.jpg`… | Phase 6 night events. Not copied into `public/` until then |

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
4. The item icon. These are to come from Wyatt; use the type icon as a stand-in.
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
- Ask Wyatt which ones to use. For example, Alpine could be 263 → 261 → 269 → 268, and the Rainforest could add 266 or 264.

## Still missing

- **Bigger icon:** a hi-res mushroom.
- **Character art:** real portraits, once characters are final.
- **Item card art:** most items.
- **Special-space icons:** the mockups use simple stroke icons (`docs/mockups/Ic.dc.html` has the SVG paths).
- **Biome layers:** a rainforest foreground, and alpine snow and rock layers in the flat style.
- **Item icons:** one per item, a transparent white or colored icon on a 1500×2100 canvas, sized to sit in the cloud area of the front background.
- **Challenge art:** for everything except the bear and the fallen tree.

Until real art arrives, use clearly marked placeholders.

## Licensing

- **Edit Undo:** freeware from Brian Kent. See `fonts/edit-undo-README.txt`.
- **Game Quotes:** © Typia Nesia. Wyatt confirmed his license covers use in the game on the web.
