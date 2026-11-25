# Challenge tiers I to V

Wyatt's change (November 25): challenges now go from **Tier I to Tier V**.
- **Tiers I to III** bring in new challenges. The hardest new ones show up at Tier III.
- **Tiers IV and V** are harder versions of the Tier III challenges. Nothing new unlocks there.
- **Labels:** show I, II, III, IV and V wherever a tier appears: the pop-up banner, the HUD boxes and the testing tab.
- **Testing tab:** every game's Tier setting offers I to V.
- **In runs:**
  - if a run already gives challenges a tier, extend the range to V;
  - tell Wyatt how tiers are given out now, so he can decide where IV and V appear.
- **Penalties** (energy lost and so on) at Tiers IV and V are the same as at Tier III, unless a game says otherwise.

## Games with their own Tier IV and V numbers
- **Dodge** (`12-minigames-dodge.md`, section 4): animals play at levels, and overlaps only happen at Tier V.
- **Trail Map, Memory Puzzle, Picture Puzzle, Thin Ice** (`13-minigames-puzzles-2.md`).
- **Trail Blocks, Sleeping Bear, Whackoon** (`14-minigames-trail-blocks.md`).

## Every other game: the fallback rule
**Which games:** Bearrels, Traildle, Find the Object, Remember the Path and Find the Path don't have their own Tier IV and V numbers yet.

**The rule:** start from each game's Tier III numbers and make them harder:

| | Tier IV | Tier V |
| --- | --- | --- |
| Time limits | ×[0.85] | ×[0.7] |
| Speeds | ×[1.15] | ×[1.3] |
| Target zones and timing windows | ×[0.85] | ×[0.7] |
| Things to find, steps, rounds | +[1] | +[2] |
| Tries, strikes, lives | same as Tier III | same as Tier III |

**How to store them:**
- Write the results into `balance.ts` as each game's own Tier IV and V values, with `TODO(wyatt)`. Don't apply a multiplier while the game runs, so Wyatt can tune each one on its own.
- Where a rule doesn't fit a game, use your judgment and say what you chose.
- List the values in your summary.
