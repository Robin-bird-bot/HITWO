# UI mockups

These files are the source of the design canvas Wyatt and Claude made ("Hike in the Woods — UI Concept"). They are written in a canvas markup format, not React. Treat them as a detailed spec for layout, sizes and colors, not as code to copy.

- **Images won't load.** The `/_blob/...` URLs pointed to the canvas's private storage. The constant names next to each URL say what it is: `BG.forest`, `R.wood`, `POR.ellie`, `BACK.tool` and so on. The matching files are in `/assets`; see `docs/ASSETS.md`.
- **Reading the markup:**
  - Data and computed layout values are in each file's `renderVals()` script at the bottom.
  - `{{name}}` in the markup reads one of those values.
  - `<sc-for>` is a loop.
  - `<sc-if>` is a conditional.
  - `<dc-import name="X">` embeds another file as a component.
- **Screenshots:** ask Wyatt for PNGs of each board, and save them next to these files as `Main.png`, `Scavenge.png` and so on.

| File | Board |
| --- | --- |
| `Main.dc.html` | The game screen, landscape 1600×1000: collapsible panels (trail log shown minimized), Backpack-expanded bag |
| `Scavenge.dc.html` | The scavenge pop-up: translucent, blurred, bonuses hidden behind a pill |
| `ScavengeMods.dc.html` | The same pop-up with the bonuses pop-over open |
| `Backdrops.dc.html` / `Backdrop.dc.html` | Land layers for each biome with the phase skies (morning, afternoon, night), and the backdrop component used by `Main` |
| `NightLandscape.dc.html` | A full-size night landscape: stars, moon, dimmed land |
| `ItemCard.dc.html` | The item card component, with the final front layout (Nov 7) |
| `ItemCardAnatomy.dc.html` / `ItemCardAnatomy.png` | The labeled reference for tool, clothes and food cards: art, title, type, effect, tier numeral, Quality diamonds and the uses, durability or bites counter |
| `ItemCardsArt.dc.html` / `ItemCardArt.png` | 12 real item cards with their art |
| `ItemCards.dc.html` | Item card backs built from layers |
| `ScavTypes.dc.html` | Gallery of every scavenge card type and rarity |
| `ScavCard.dc.html` | The reusable square scavenge card |
| `Challenge.dc.html` / `ChallengeParty.dc.html` / `ChallengeOpportunity.dc.html` | Challenge pop-up: each-hiker and whole-party versions (red), and an opportunity (blue) |
| `Wonder.dc.html` / `WonderRewards.dc.html` / `Wonder.png` | The Wonder pop-up (purple, 1400×956): goals and rewards before the goals are met, and the reward picking after |
| `NightEvent.dc.html` | The night event side window (Phase 6): midnight-blue ribbon, creature art, one line per hiker hit |
| `Weather.dc.html` / `WeatherIcons.dc.html` | The weather change screen (Phase 6, Snow shown), and the 5 animated weather icons plus the 3 new nodes. Copy the icons' SVG and keyframes from `WeatherIcons.dc.html` |
| `Station.dc.html` / `StationAhead.dc.html` | The ranger station (Phase 9): the room, the shopkeeper, the counter and the hikers' packs; and the same screen with "What's ahead?" open |
| `Kit.dc.html` | Visual kit: tile states, tokens, special icons, bars, condition icons, palette |
| `Ic.dc.html` | Stroke icon set (SVG paths), including binoculars, chat, trendUp and trendDown for the station |
| `Px.dc.html` | Old pixel icon component (unused) |
| `illustrated-map/` (Phase 10.5) | JPEG boards for the illustrated map: `MapTopDown.jpg` (the chosen look, mid-run), `MapTrailLines.jpg` (path types, walked colors, the route view), `MapTileLooks.jpg` (look **A, dark glass**, is chosen), `MapLayers.jpg` (the land layer by layer, and the stamp kit), `MapIdeas.jpg` (night, rain, snow) and `MapTilted.jpg` (not built). `look/` has full-size renders of the land on its own to match. Made by the prototype in `docs/design/illustrated-map/reference/` |

**Geometry from `Main.dc.html`**
- Hexes are 112×128.
- The left party panel is 288 px wide, from y 120 to 984.
- Map coordinates use `PX(x)=760+(x-460)*1.6` and `PY(y)=760+(y-545)*1.6`, which map a design grid onto the stage.
| `TraitBadges.dc.html` / `TraitBadges.png` | Trait badges (Phase 10a; icons in the type's ring color since the 10b polish update): diamonds for always-on traits, circles for usable ones, their states, the hiker panel's badge row and hover window, the Abilities panel, and the trait warnings |
| `HikerCards.dc.html` / `HikerCards.png` | The hiker card (Phase 10b), front and back, 300 × 420 |
| `HikerPortraits.dc.html` / `HikerPortraits.png` | Every portrait in its card window, with the forest and pixel-pattern background (Phase 10b) |
| `HikerSelect.dc.html` / `HikerSelect.png` / `HikerSelect-background.png` | The hiker selection screen (Phase 10b): spots, the list, and the darker animated background (family update) |
| `HikerSort.dc.html` / `HikerSort.png` | The selection list sorted, with group ribbons (Phase 10b) |
| `SortRibbons.dc.html` / `SortRibbons.png` | Every sort's ribbons, the FAMILY sort's included (Phase 10b family update) |
| `LevelUp.dc.html` / `LevelUp.png` | The level-up screen (Phase 10b), replacing the 10a placeholder window |
