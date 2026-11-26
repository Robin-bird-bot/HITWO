# Challenge tiers I to V

Wyatt's change (November 25): challenges now go from **Tier I to Tier V**.
- **Tiers I to III** bring in new challenges. The hardest new ones show up at Tier III.
- **Tiers IV and V** are harder versions of the Tier III challenges. Nothing new unlocks there.
- **Labels:** show I, II, III, IV and V wherever a tier appears: the pop-up banner, the HUD boxes and the testing tab.
- **Testing tab:** every game's Tier setting offers I to V.
- **In runs:** see "Which tier a challenge gets" below (Wyatt, November 25).
- **Penalties** (energy lost and so on) at Tiers IV and V are the same as at Tier III, unless a game says otherwise.

## Which tier a challenge gets (Wyatt, November 25)
Close to how it works now, spread over five tiers. Each challenge rolls its tier when it's placed. The percentages are first guesses.

**Normal difficulty, by biome:**

| Biome | Tiers |
| --- | --- |
| Biome 1 | mostly Tier I, some Tier II: I [80%], II [20%] |
| Biome 2 | mostly Tier II, some Tier III: II [75%], III [25%] |
| Biome 3 | mostly Tier III, some Tier IV: III [75%], IV [25%] |

**Harder difficulties:**
- **Hard (later):** the same as Normal, but Tier V shows up rarely, for example [10%] of Biome 3 challenges.
- **Nightmare:** every challenge starts at Tier III and climbs to IV and V as the run goes on:
  - Biome 1: III [80%], IV [20%];
  - Biome 2: IV [75%], V [25%];
  - Biome 3: V [75%], IV [25%].

**Special run modes (later):**
- **Random tiers:** every challenge in every biome gets a random tier from I to V, each equally likely [20%].
- **Boss Rush:** a challenge run where every challenge is a Dodge fight. The tiers climb as the run goes, from Tier I up to Tier V by the end.

**Build now:**
- the biome table for Normal;
- the Nightmare table, if Nightmare already exists;
- Hard, Random tiers and Boss Rush are only notes for now. Keep the tables in `balance.ts` so they're easy to add.

## Games with their own Tier IV and V numbers
- **Dodge** (`12-minigames-dodge.md`, section 4): animals play at levels, and overlaps only happen at Tier V.
- **Trail Map, Memory Puzzle, Picture Puzzle, Thin Ice** (`13-minigames-puzzles-2.md`).
- **Trail Blocks, Sleeping Bear, Whackoon** (`14-minigames-trail-blocks.md`).
- **Trail Blazes, Firefly Catch, Size Up, Safari, Fly Swatter, Raccoon Shuffle** (`18-minigames-quick.md`).

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
