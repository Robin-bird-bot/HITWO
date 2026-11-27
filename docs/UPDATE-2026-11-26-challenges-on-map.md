# Update, November 26 (evening): the challenge reset, challenges on the trail map, fixes, and Wyatt's new trees

Wyatt: "If we have enough to start implementing the minigames into the game, then let's do that. We can make general guesses to costs and things so far, and then choose them after playtesting."

## What's in this update
| File | What it is |
| --- | --- |
| `24-challenges-reset.md` | **The new challenge list:**<br>• resource categories;<br>• one list of punishments (failing always costs), plus the backup rule;<br>• general costs;<br>• 45 minigame challenges and 22 cost cards;<br>• no risk cards for now;<br>• what Prepare costs, by category;<br>• two new games: Spooky Ghost! and Cracked Pots. |
| `25-challenges-on-the-map.md` | **Hooking it all into the real game:**<br>• each biome's pool, placed on tiles when the biome is made;<br>• the Trail Infoboard;<br>• minigame challenges played from tiles with real packs;<br>• new costs and punishments for cost cards;<br>• testing tools and tests. |
| `26-fixes-and-wyatt-trees.md` | **Fixes and tree changes:**<br>• an audit of every bar;<br>• Camp Cleanup's smaller fields, more obstacles, shorter timer and the all-done countdown;<br>• Dodge's arrows and a bigger Avalanche gap;<br>• a calmer Sketchy Bridge;<br>• Wyatt's new trees, with levels within a step. |
| `mockups/challenges/` | Spooky Ghost! (54) and Cracked Pots (55). |
| `mockups/fixes/` | Comb-Over arrows (56), the Avalanche gap (57) and Camp Cleanup's countdown (58). |
| `mockups/infoboard/` | **The Trail Infoboard prototype** (`prototype.html`, open it in a browser) and screenshots of each step (`ib-1` to `ib-6`). Match its look and animations. |
| `art/spooky-ghost/` | `ghost-1.png` and `ghost-2.png` (its float frames), and `mitten.png` (white: tint it with the hiker's color). |
| `art/cracked-pots/` | `pot-1.png` to `pot-3.png`, the pictures the shards are cut from. |

**Where these files went** (Wyatt unzipped the folder into the repo root):
- the three specs: `docs/design/24-challenges-reset.md`, `25-challenges-on-the-map.md` and `26-fixes-and-wyatt-trees.md`;
- `mockups/challenges/`: `docs/mockups/minigames/new-challenges/`;
- `mockups/fixes/`: `docs/mockups/minigames/fixes-nov-26-evening/`;
- `mockups/infoboard/`: `docs/mockups/infoboard/`;
- `art/spooky-ghost/` and `art/cracked-pots/`: `assets/minigames/` (copies in `public/assets/minigames/`).

## Suggested order
1. **The bar audit** (`26`, section 1). It's small, and it fixes every game.
2. **The game fixes** (`26`, sections 2 to 4).
3. **Spooky Ghost! and Cracked Pots** (`24`, sections 6 and 7) in the testing tab.
4. **The challenge content** (`24`): the categories, punishments, new costs, the 45 minigame challenges and the 22 cost cards. Remove the old challenges (`25`, section 1.1).
5. **The pool and placing cards on tiles** (`25`, section 1).
6. **Minigame challenges from tiles** (`25`, section 3), then Prepare in the real game (`25`, section 5).
7. **The Trail Infoboard** (`25`, section 2).
8. **Wyatt's trees** (`26`, section 5). Game Sight needs placed cards (step 5).

Feel free to split this into more than one PR.

## Rules for this update
- **Numbers in [brackets]** are first guesses: put them in `balance.ts` with `TODO(wyatt)`. Wyatt will pick the real ones after playtesting.
- **Ideas marked *(Claude's idea)*** are the design assistant's, not Wyatt's. Build them, behind a setting if they change gameplay a lot.
- **Each spec ends with "Things to flag to Wyatt".** Mention those in the PR.
- **Older docs:** where these files disagree with `04-challenges.md`, `09-hikers.md`, `20-challenge-popup.md`, `22-minigame-revisions.md` or `23-minigames-final.md`, these files win. Update the older docs with a note at the top of each changed section.
- **Art:** new files go in `assets/` next to the matching game's art. Until posters are painted, challenges use the old challenge art named in the "Art" column.
