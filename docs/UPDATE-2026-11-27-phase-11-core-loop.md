# Update, November 27: Phase 11, the core loop

Wyatt wants "a more polished gameplay loop first", before the UI overhaul (Phase 12). This update is the rules for that loop, four quick minigames, the new item cards, and two changes to the packing screen.

**Build it on top of `phase-10.9-packing-screen`** (merge that first, or branch from it).

## What's in this update
| File | What it is |
| --- | --- |
| `29-core-loop.md` | **The rules:** work costs Energy and moving costs Appetite, more Energy from sleep, drinks, crafters' leveled free crafting, half the map as challenges, every challenge a minigame, no starting kits, the slots waiting for a press, and a run clock. |
| `30-quick-minigames.md` | **Four quick games** that take over four cost cards: Incoming Bike!, Wrong Turn, Fallen Branch and Snagged Pack. |
| `31-trailmate-item-cards.md` | **The item cards in the TrailMate style:** fronts, walkie-talkie backs, LEDs that count uses, and the bag's small screens. |
| `mockups/quick-games/59-…png` to `63-…png` | The four games (Incoming Bike! twice: keys and phone swipes). |
| `mockups/item-cards/cards.html` | **The card mock** (open it in a browser). `board.png` is a picture of it; `board-fronts-2x.png` is the fronts, bigger. |
| `mockups/packing/prototype.html` | The cabinet prototype, now waiting for a press. Its screenshots, re-taken: `00-press-to-start` and `12a-resources-press` are new. |
| `mockups/packing-trailmate/prototype.html` | The TrailMate prototype, the same. Its screenshots, re-taken, with the same two new ones. |
| `art/item-cards/drink-cup.svg` | The drink's icon (the strip and the back's logo). |

**Where these files went** (Wyatt unzipped the folder into the repo root):
- the three specs: `docs/design/29-core-loop.md`, `30-quick-minigames.md` and `31-trailmate-item-cards.md`;
- `mockups/quick-games/`: `docs/mockups/minigames/quick-games-2/`;
- `mockups/item-cards/`: `docs/mockups/item-cards/`;
- `mockups/packing/` and `mockups/packing-trailmate/`: over the old ones in `docs/mockups/packing/` and `docs/mockups/packing-trailmate/` (the prototypes and every screenshot, plus the two new press screenshots);
- `art/item-cards/drink-cup.svg`: `assets/item-cards/`.

**Phase numbers:** this is the new Phase 11. The old Phase 11 (biomes, tiers and weather) is now Phase 11b in `BUILD_PLAN.md`; older docs and code comments that say "Phase 11" about biomes or weather mean 11b.

## Changes to the packing screen (Wyatt)
1. **"Get rid of the starting items for hikers, and make it purely based on slots."** (`29`, section 7.)
2. **"Don't have the slots automatically start, have the player press them first."** (`29`, section 8.)

## Suggested order
1. **The packing changes** (`29`, sections 7 and 8): small, and on the branch that's already open.
2. **Costs, sleep and drinks** (`29`, sections 1 to 3).
3. **The map and the challenge pool** (`29`, sections 5 and 6), then **the four quick games** (`30`), one PR each is fine.
4. **Free crafting levels** (`29`, section 4).
5. **The run clock** (`29`, section 9).
6. **The item cards** (`31`). It touches a lot of screens, so its own PR.

## Rules for this update
- **Numbers in [brackets]** are first guesses: put them in `balance.ts` with `TODO(wyatt)`.
- **Ideas marked *(Claude's idea)*** are the design assistant's, not Wyatt's.
- **"Things to flag to Wyatt"** (at the end of `29`, `30` and `31`): mention them in the PR.
- **Copy the new docs** into `docs/design/` and the mockups into `docs/mockups/`, as before.
