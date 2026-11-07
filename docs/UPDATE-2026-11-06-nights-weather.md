# Update: November 6, 2026 (night events and weather, for Phase 6)

Wyatt's rules for night events and weather, plus a new trait. **This is for Phase 6. Don't build it during Phase 5.** When Phase 6 starts, read this file and fold it into the Phase 6 plan.

**New files in this commit**
- `docs/design/05-nights-and-weather.md`: the full rules for night events, weather, the new nodes and the new conditions. **This is the source of truth for both.** Add it to the "Where things are" table in `CLAUDE.md`.
- `assets/nodes/fire.png`, `frozen.png`, `flooded.png`: the new node icons, 750×750.
- `docs/mockups/NightEvent.dc.html`: the small night event side window.
- `docs/mockups/Weather.dc.html`: the weather change screen (Snow).
- `docs/mockups/WeatherIcons.dc.html`: the 5 animated weather icons (Rain, Storm, Snow, Heatwave, Clear) and the 3 new nodes. **Copy the SVG and keyframes for the icons from this file.** They're already built to the spec.

The night event art is already in `assets/night-events/` (from the Wonders update).

---

## 1. Doc updates (do now, it's small)
Add these to `docs/design/02-traits-and-conditions.md`:
- **Trait, Tier I: Thrill Seeker.** Losing 3 or more Energy in a single phase makes this hiker Energized for 1 day.
- **Condition: Shivering** (stacks, from Snow). At 3 or more, the hiker is Frozen. At 5 or more, they gain 1 injury and Shivering resets to 0. Lasts until the snow ends or it drops to 0.
- **Condition: Burning** (stacks, from Heatwave and Fire nodes). −1 maximum Energy for each stack. At 5, the hiker gains 1 injury and Burning resets to 0. Goes down by 1 in any Night phase where the hiker gains none. Lasts until the heatwave ends or the injury.

Then add sections 2 and 3 below to Phase 6 in `docs/BUILD_PLAN.md` (replacing "a night event chance (50%, from a placeholder deck)"), and commit.

## 2. Night events (Phase 6)
Follow `05-nights-and-weather.md`.
- **Each night:**
  1. Pick a tier using the odds for the current biome.
  2. Pick a creature from that tier.
  3. Roll for each exposed hiker. A hiker is safe on a tile with a shelter, or on a tile where any hiker chose Keep Watch.
  4. Pick a random outcome from the tier's list for each hiker hit, skipping outcomes that can't apply.
- **Data:** creatures, tiers, outcomes, odds and the per-hiker chance formula all go in `src/content/nightEvents.ts` and `balance.ts`. Outcomes run through the same effect engine as challenges.
- **Lines:** each outcome has a generic sentence template with `{creature}`, `{hiker}` and `{X}`. Creatures can override any template with their own version. Write a placeholder set (`placeholder: true`) so Wyatt can replace them.
- **The window** (follow `NightEvent.dc.html`):
  - a small side window styled like the side panels, sitting beside the right-hand panel. It doesn't dim or blur the map. It has a − button to minimize it and is movable like the other windows;
  - a midnight-blue ribbon, the creature art as a banner, and the creature name;
  - one line per hiker hit, with a result chip;
  - an optional "safe" note;
  - an OK button.
  - It only appears if someone was hit.
- **Debug panel:** force a tier and creature, and force a hit on a chosen hiker.

## 3. Weather (Phase 6 engine, Phase 11 schedules)
- **Four weathers:** Rain, Storm, Snow and Heatwave. Each has a hiker effect and a node effect, as in the doc's table. Clear has no effects.
- **Timing:** hiker effects start after the first full day of the weather. Node effects start at once, and roll at the start of each phase.
- **Drizzle:** each phase, every equipped clothing item has a 35% chance to lose 1 durability.
- **Burning** goes down by 1 in any Night phase where the hiker gains none.
- **Sheer Cold** stays at 3 Shivering per phase (Wyatt's call).
- **New node states:** Flooded (counts as River), Frozen (gives no resources) and Fire (not Forest; +1 Luck to the other nodes on the tile; spreads to connected Forest tiles at 35%).
  - Use the new node icons.
  - Store the original node type, so everything changed reverts when the weather ends.
  - Shivering and Burning end then too.
- **Shivering and Burning** are stacking conditions. Show the stack count on the condition icon.
- **The weather change screen** (follow `Weather.dc.html` and `WeatherIcons.dc.html`):
  - not a pop-up: the whole screen blurs;
  - the animated icon, the weather's name, its two effects, and a Ready button.
  - In the game the icon animation plays **once** and holds its last frame. It doesn't loop like the mockup.
  - Show it when the weather changes, including back to Clear (the sun icon, "CLEAR SKIES", no effects).
  - Under reduced motion, show the final frame.
- **Scheduling:** until Phase 11, use a simple placeholder schedule plus the debug panel to set the weather. Phase 11 gives each biome its own weather odds (Snow mostly in the high, snowy part; Heatwave in the Meadow).
- No special weather challenges for now.

## 4. Ask Wyatt first (when Phase 6 starts)
- The first-guess numbers in the doc: tier odds by biome, the per-hiker night chance, and the X ranges.
- The balance notes at the end of `05-nights-and-weather.md`. Drizzle, Burning and Sheer Cold are settled.
