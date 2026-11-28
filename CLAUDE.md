# Hike in the Woods: project guide for Claude Code

A browser game version of a co-op card game Wyatt made for his mom. The player guides a party of 4 hikers (people, dogs, cats) up a branching trail through 3 biomes. Each hiker takes one action per phase (Morning, Afternoon, Night). Along the way they scavenge resources, craft items, survive challenges and check in at checkpoints. At the end the run is scored X out of Y.

**Who it's for:** Wyatt's mom, playing on a laptop first and a phone (landscape) later. She is not a hardcore gamer. Clarity beats cleverness: readable text, big click targets, a clear "what can I do now", and nothing lost to a misclick (confirm anything that can't be undone). Things she does often, like moving and scavenging, must feel quick and light.

## Where things are

| Path | What |
| --- | --- |
| `docs/BUILD_PLAN.md` | The phased plan. Work through it in order, one phase at a time. |
| `docs/design/01-design-doc.md` | Rules and systems. **Source of truth for how the game works.** |
| `docs/design/02-traits-and-conditions.md` | Every trait and condition with exact wording, plus the term glossary. |
| `docs/design/03-items.md` | Every item with its tier, uses, bites or durability, Quality values, effect, recipe and art. **Source of truth for items.** |
| `docs/design/04-challenges.md` | Every challenge and Trial: tier, nodes, who pays, cost, penalty and art. **Source of truth for challenge content.** |
| `docs/design/05-nights-and-weather.md` | Night events, weather, and the nodes and conditions they add. **Source of truth for nights and weather.** |
| `docs/design/06-ranger-stations.md` | Every station theme and shopkeeper, the stock, and the shop rules (Quality, prices, market, selling). **Source of truth for stations.** |
| `docs/design/07-characters.md` | The classes, the Plush family, every character and the new traits that came from them. **Source of truth for characters.** |
| `docs/design/08-overhaul-plan.md` | The gameplay overhaul (Phases 10.6–10.8 and the Phase 12 UI ideas). **Wins over the older design docs where Phase 10.6 changed them.** |
| `docs/design/09-hikers.md` | Skill Trails, party XP, morale types and the first 6 hikers' trees (Phase 10.7). The trees as data are in `docs/design/skill-trails/`. **Source of truth for hikers; wins over 07 and 08 where they disagree.** |
| `docs/design/10-minigames.md` | The vertical party GPS (preview, then turn and zoom), the GPS-greens art (Detailed pixel and Drawn 2D) and the Minigame testing tab (Phase 10.8). Its pop-up section is replaced by `20`, and Bearrels was removed (Nov 26). |
| `docs/design/11-minigames-puzzles.md` | The four puzzle minigames (Traildle, Find the Object, Remember the Path, Find the Path), the shared Line up step, and their testing-tab settings (Phase 10.8 step 2). |
| `docs/design/12-minigames-dodge.md` | Dodge, the Undertale-style animal encounter (Bees, Bear, Bear with a Sword, Bobcat, Squirrel Army, Wild Predator Stampede, and the Woods Monster boss; Ants and Bear with a Gun are in `21`), its shared attack library, tiers and levels, pacing and overlaps, the Solid + red portraits and their motion, and its testing-tab settings (Phase 10.8 steps 3, 3b, 3c, 6 and 7). |
| `docs/design/13-minigames-puzzles-2.md` | Four more puzzle and memory minigames (Trail Map, Memory Puzzle, Picture Puzzle, Thin Ice), their testing-tab settings, and the testing tab's categories (Phase 10.8 steps 4 and 6). |
| `docs/design/14-minigames-trail-blocks.md` | The passing-challenge rules, the four Trail Blocks (Chop Tree, Mine Rockslide, River Flood, Clearing Animals), Sleeping Bear and Whackoon, the fixes after Wyatt played them (including the axe, whistle and mallet), and their testing-tab settings (Phase 10.8 steps 5 to 8). |
| `docs/design/15-challenge-tiers.md` | Challenge tiers I to V: what Tiers IV and V are, the fallback rule for games without their own IV and V numbers, and which tier a challenge gets in runs, by biome and difficulty (Phase 10.8 steps 6 and 7). |
| `docs/design/16-challenge-end-screen.md` | The Challenge Passed / Challenge Failed end screen every minigame shares: the drips, the clock wipe, the title and each hiker's result (Phase 10.8 step 7). |
| `docs/design/17-minigames-lanes.md` | The lane games: Crossing (Road, River, Critter and Mixed), Train! and Rafting, and their testing-tab settings (Phase 10.8 step 7). |
| `docs/design/18-minigames-quick.md` | Six short games: Trail Blazes, Firefly Catch, Size Up, Safari, Fly Swatter and the Raccoon Shuffle challenge (made harder Nov 26), and their testing-tab settings (Phase 10.8 steps 8 and 9). |
| `docs/design/19-minigames-signs-trails.md` | Fake Trail Signs (with its rule generator), Trails, Crossroads and Rock Climb, and their testing-tab settings (Phase 10.8 step 8). |
| `docs/design/20-challenge-popup.md` | The challenge pop-up, version 3: How to play with every rule that matters (rule lines that show only when they apply), Controls, a bot playing a demo, solid tan bars, per-hiker values, and Prepare as cost cards (pick the thing, then what it does, then who gets it), plus every game's text, rules, bars and cards (Phase 10.8 step 10). **Source of truth for the pop-up.** |
| `docs/design/21-minigames-dodge-camp.md` | Bearrels removed; Bear with a Gun and Ants in Dodge; Camp Cleanup; the new Ridgeline; the Rock Climb grab fix (Phase 10.8 step 9). |
| `docs/design/22-minigame-revisions.md` | Revisions after Wyatt played step 9: Raccoon Shuffle's wider cards and bins taken away, Rock Climb's tries, top line and new look, Bear with a Gun's arming traps, faster Ricochet and Bullet Ring, Ants at Easy, and Sword Volley replacing the Sword sweep (Phase 10.8 step 10). **Wins over 12, 18, 19 and 21 where they disagree.** |
| `docs/design/23-minigames-final.md` | The last minigame batch (Phase 10.8 step 11): Sketchy Bridge, Falling Rocks, Fly Block, Squirrel Theft, Birdsong and Pack It Up; Thin Ice renamed Minefield (Dog Waste Zone) and a new crossing Thin Ice; Dodge's Eagle (three versions), Snow Leopard and Snowgirl with ice physics; and every new game's pop-up content and testing-tab settings. **Source of truth for these games.** |
| `docs/design/24-challenges-reset.md` | The challenge reset (Nov 26 evening): resource categories, one list of punishments with the backup rule, general costs, the 45 minigame challenges and 22 cost cards (no risk cards for now), what Prepare costs by category, and two new games, Spooky Ghost! and Cracked Pots. **Source of truth for challenges; wins over 04, 20, 22 and 23 where they disagree.** |
| `docs/design/25-challenges-on-the-map.md` | Challenges on the trail map: each biome's pool placed on tiles when the biome is made, the Trail Infoboard on the trailhead tile (prototype in `docs/mockups/infoboard/`), minigame challenges played from tiles with real packs, and the new costs and punishments for cost cards. |
| `docs/design/26-fixes-and-wyatt-trees.md` | The bar audit, Camp Cleanup's smaller fields and countdown, Dodge's arrows and bigger Avalanche gap, a calmer Sketchy Bridge, and Wyatt's new trees with levels within a step. **Wins over 09, 21 and 23 where they disagree.** |
| `docs/design/27-packing-screen.md` | The packing screen between hiker select and the hike (Phase 10.9): a slot machine for the starting items and resource bundles, with every rule, number, bonus and animation, the Lucky Trail Outfitters cabinet look, and the two looks over one set of rules. Prototype in `docs/mockups/packing/`. **Source of truth for packing.** |
| `docs/design/28-packing-screen-trailmate.md` | The packing screen's TrailMate look (the default): the GPS-themed device, its LCD reels and symbols, its animations and sounds, and its dark hiker-select background. Prototype in `docs/mockups/packing-trailmate/`. |
| `docs/design/29-core-loop.md` | Phase 11, the core loop: work costs Energy and moving costs Appetite, more Energy from sleep, drinks, crafters' leveled free crafting, half the map as challenges, every challenge a minigame, no starting kits (the packing machine is the whole start), the slots waiting for a press, and a run clock. **Wins over 01, 07, 24, 25 and 27 where they disagree.** |
| `docs/design/30-quick-minigames.md` | Four quick minigames that take over four cost cards: Incoming Bike!, Wrong Turn, Fallen Branch and Snagged Pack, with their tiers, pop-ups, bots and tests. |
| `docs/design/31-trailmate-item-cards.md` | The item cards in the TrailMate style: device fronts with LCD screens, walkie-talkie backs, LEDs that count uses, and the bag's small screens. Card mock in `docs/mockups/item-cards/cards.html`. **Source of truth for the item card's look.** |
| `docs/design/32-audio-system.md` | Phase 12, the sound: files and the manifest, the audio engine and its buses, the Sound settings, ambience, the music player, the wiring rules and the debug Sound tab. **Source of truth for how the game plays sound.** |
| `docs/design/33-sound-list.md` | Every sound (342): when it plays, what it is, and whether it's made. Its "When it plays" column is where to hook each one up. |
| `docs/design/34-music.md` | The music plan: 30 songs with their Suno prompts, the priority list and how the game plays them. No music files yet. |
| `docs/design/35-ui-overhaul.md` | Phase 12, the UI overhaul: four new settings, paper tags, party frames, the action wheel, using items from the pack, poster scavenging and the brush reveal, the workbench and recipe book, the night camp recap, the title, loading screens and the spotlight. Prototype in `docs/mockups/ui-overhaul/prototype/`. **Source of truth for the Phase 12 UI.** |
| `docs/mockups/*.dc.html` | UI mockups (layout, sizes, colors). Reference only; see `docs/mockups/README.md`. |
| `docs/ASSETS.md` | What every art file is, and what art is still missing. |
| `tools/audio/` | The Python that made the sounds (optional, not part of the build). Python 3, numpy, scipy, ffmpeg; `python3 render.py` remakes the sounds. |
| `assets/` | Original art and fonts. Copy what the game uses into `public/assets/`. All hikers use the placeholder portrait for now. |

When the design docs and this file disagree, the design docs win. When the docs are silent or ambiguous, **ask Wyatt. Don't invent rules.** Put a temporary rule in `src/config/balance.ts` with a `// TODO(wyatt):` comment and list it in your summary.

## Stack

- TypeScript (strict), Vite, React 18, plain CSS (CSS modules or one stylesheet per component).
- Vitest for tests.
- No backend. The game saves to `localStorage`.
- Deployed to GitHub Pages by a GitHub Action on every push to `main`.

Commands, once Phase 0 sets them up:

```
npm install
npm run dev        # local dev server
npm test           # vitest
npm run build      # production build
npm run lint
```

## Architecture rules

1. **The engine is pure and separate from the UI.**
   - `src/engine/` has no React, no DOM and no `Math.random`.
   - The whole game is one serializable `GameState`. Every change goes through `applyAction(state, action) => state`.
   - The UI only reads state and dispatches actions.
   - This is what makes autosave, undo, tests and replaying a bug possible.
2. **All randomness comes from a seeded RNG stored in the state.** The same seed and the same actions must give the same game.
3. **Every tunable number lives in `src/config/balance.ts`.** Costs, thresholds, odds, rarity weights, XP, tree size and so on. The design doc lists these as "adjustable settings from day one". No magic numbers in engine code.
4. **Content is data.**
   - Traits, conditions, items, scavenge card types, challenges, night events, objectives, biomes and characters live in `src/content/` as typed data.
   - Trait and item effects plug into engine **hooks** (for example `modifyMoveCost`, `onScavengeDraw`, `onStartOfDay`, `onCraft`). They are never `if (trait === 'Leader')` checks scattered through the engine.
   - Set up the hook points early, even before most traits exist.
5. **Use the glossary's exact terms** (Energy, Appetite, Morale, phase, action, free action, alone, adjacent, Luck, chance, tile, node, line, checkpoint, Abundance, caps) in code names and UI text. Write UI text in gender-neutral language.
6. **Placeholder content is marked.** Anything you make up to test with gets `placeholder: true`, so Wyatt's real content can replace it cleanly.
7. **Saves are versioned.** `GameState` has `saveVersion`. Bump it when the shape changes and either migrate old saves or discard them gracefully. Never crash on an old save.
8. **Fixed stage, scaled to fit.**
   - The game screen is laid out on a 1600×1000 logical stage, the same size as the mockups, and scaled to fit the window with letterboxing.
   - This keeps the layout identical on laptop and phone landscape.
   - The map area inside it scrolls and zooms.

## Look and feel

The art direction is modern national-park-poster art (Olly Moss style) with a light Oregon Trail pixel touch:
- layered flat-color landscapes with slow parallax;
- Wyatt's pixel halftone texture;
- slowly rotating sunburst rays behind scavenge cards;
- dark translucent panels, with a blur for pop-ups;
- pixel fonts for headings and numbers, and a clean sans for body text.

The shared UI rules for collapsible panels, slots that grow, and motion are in `docs/BUILD_PLAN.md` under "UI patterns". Respect `prefers-reduced-motion`.

| Token | Value |
| --- | --- |
| Panel background | `rgba(29,34,32,0.9)`; page `#1D2220` |
| Text / muted | `#F1EADB` / `#C9C2B2`, `#9C9585` |
| Accent gold | `#E9B44C` |
| Trail (yellow) / Utility (green) / Morale (purple) | `#F2B950` / `#9CC3A8` / `#CDA6EE` |
| Condition rings: positive / negative / threshold state / injury | `#7FC29B` / `#E5624A` / `#E9B44C` / solid `#E5624A` |
| Rarity: Common → Mythic | `#C9C2B2`, `#7FC29B`, `#E9B44C`, `#CDA6EE`, `#F0875A`, `#7FD3E6` |

Fonts (in `assets/fonts/`):
- **Edit Undo:** headings, labels, numbers.
- **Edit Undo Dot:** big stat readouts.
- **Game Quotes:** the `?` and `!` glyphs on Wild and Choice cards, ×2/×3/+N badges, and other punchy callouts. Wyatt's license covers web use.
- **DM Sans** (Google Fonts): body text.
- **Pixelify Sans** (`@fontsource/pixelify-sans`): the text on the TrailMate item cards only (`31-trailmate-item-cards.md`).

Which font for what:
- **Edit Undo** for short text people read at a glance: names (including item card names), labels, buttons, numbers, and all shopkeeper or ranger dialogue.
- **DM Sans** only for longer descriptions and rules text.

## Writing style

Player-facing text (cards, buttons, tooltips, dialogue) is short and plain. Follow this from Phase 10 on (Nov 14 update):
- Say what the player does or gets ("Pick an item." "Gain 2 Morale."), not how the rule works inside. Full explanations can go in a rules screen later.
- Use one word for one thing everywhere: Appetite, Energy, Morale, Abundance, tile, node, hiker, caps.
- No code-like wording: no "trigger", "proc", "on use", "X%" placeholders, or square brackets in player text.
- If a line doesn't help the player decide something, cut it.
- Keep numbers on cards; keep explanations off them.

## How to work

- Do one phase at a time. Start each phase in plan mode, confirm the plan, then build.
- Before a phase starts, read that phase's "Ask Wyatt first" list and ask any question that blocks you.
- Engine work comes with Vitest tests: costs, thresholds, draws with a fixed seed, and save/load round-trips.
- End each phase with:
  - a short summary of what's playable now;
  - every `TODO(wyatt)` you added;
  - how to try it.
- Commit at sensible points on a branch per phase (`phase-3-game-screen`) and open a PR when the phase is done.
- Keep a dev-only debug panel (toggle with backtick). It should set the seed, give resources, jump phases, reveal the map, and set stats. It's how Wyatt will playtest and balance.
