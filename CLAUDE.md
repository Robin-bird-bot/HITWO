# Hike in the Woods: project guide for Claude Code

A browser game version of a co-op card game Wyatt made for his mom. The player guides a party of 4 hikers (people, dogs, cats) up a branching trail through 3 biomes. Each hiker takes one action per phase (Morning, Afternoon, Night). Along the way they scavenge resources, craft items, survive challenges and check in at checkpoints. At the end the run is scored X out of Y.

**Who it's for:** Wyatt's mom, playing on a laptop first and a phone (landscape) later. She is not a hardcore gamer. Clarity beats cleverness: readable text, big click targets, a clear "what can I do now", and nothing lost to a misclick (confirm anything that can't be undone). Things she does often, like moving and scavenging, must feel quick and light.

## Where things are

| Path | What |
| --- | --- |
| `docs/BUILD_PLAN.md` | The phased plan. Work through it in order, one phase at a time. |
| `docs/design/01-design-doc.md` | Rules and systems. **Source of truth for how the game works.** |
| `docs/design/02-traits-and-conditions.md` | Every trait and condition with exact wording, plus the term glossary. |
| `docs/design/03-items.md` | Items named so far. |
| `docs/design/04-challenges.md` | Every challenge and Trial: tier, nodes, who pays, cost, penalty and art. **Source of truth for challenge content.** |
| `docs/mockups/*.dc.html` | UI mockups (layout, sizes, colors). Reference only; see `docs/mockups/README.md`. |
| `docs/ASSETS.md` | What every art file is, and what art is still missing. |
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

Which font for what:
- **Edit Undo** for short text people read at a glance: names (including item card names), labels, buttons, numbers, and all shopkeeper or ranger dialogue.
- **DM Sans** only for longer descriptions and rules text.

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
