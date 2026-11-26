# Update: November 26, 2026, third round (the last minigame batch)

**Builds on `UPDATE-2026-11-26-popup-v3`** (the pop-up, version 3, and the game revisions). Finish that first: the pop-up content for these games (`23`, section 10) uses its cost cards and rule lines. Keep everything else as it is.

This is Wyatt's final games run before the games go onto the trail map. What's in it (`23-minigames-final.md`):
1. **New games:**
   - **Sketchy Bridge:** keep a swaying hiker inside a zone you control, Stardew-style. The bridge's strength is shared and never resets.
   - **Falling Rocks:** a side-view crossing under falling rocks, with overhangs to hide under.
   - **Fly Block:** Tempest-style. A swatter on a ring of panels blocks flies coming in at a pie.
   - **Squirrel Theft:** a shooting gallery. Throw nuts to the squirrels to win back what they stole.
   - **Birdsong:** Simon with colored notes that flash as they cross the screen.
   - **Pack It Up:** fit the gear into a torn pack.
2. **Thin Ice becomes Minefield** (Dog Waste Zone). The rules don't change: it's a reskin with poop and doggy bags. Then **a new Thin Ice:** cross the ice, and each hiker needs a new route because the ice cracks behind each one.
3. **Dodge:**
   - **the Eagle,** whose version changes with the level: Eagle, then Toupeeagle (hair), then Freeagle (a gun, and oil barrels that leave slippery puddles);
   - **the Snow Leopard** and **the Abominable Snowgirl** (Ellie with antlers), in a box with ice physics.

Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `23-minigames-final.md` → `docs/design/` (new).
- **Short notes in other docs,** each at the top of the section named:
  - `13-minigames-puzzles-2.md`, section 4 (Thin Ice): "**Renamed Minefield (Dog Waste Zone) on November 26. The new Thin Ice is in `23-minigames-final.md`, section 7.**"
  - `12-minigames-dodge.md`, section 4 (who shows up): "**The Eagle, the Snow Leopard and the Snowgirl: see `23-minigames-final.md`, section 9.**"
  - `10-minigames.md`, at the top: "**Frost Fire is on hold, and the Knowledge category (trivia) is dropped for now (November 26).**"
- `mockups/final-games/` → `docs/mockups/minigames/final-games/` (new).
- **Art,** into the minigame asset folders:
  - new folders: `art/sketchy-bridge/`, `art/falling-rocks/`, `art/fly-block/`, `art/squirrel-theft/`, `art/birdsong/`, `art/minefield/`, `art/pack-it-up/`;
  - `art/thin-ice/`: three new files (`cracked.png`, `shore.png`, `ice-pick.png`). The old Thin Ice art stays there for the new game;
  - `art/dodge/eagle/` and `art/dodge/snow/`: new;
  - `art/dodge/portraits/solid-red/`: the five new heads (`eagle`, `toupee-eagle`, `freeagle`, `snow-leopard`, `snowgirl`), each with blink and bob frames.
- Then delete the leftover `update-2026-11-26-final-games/` folder.

---

## 1. Order of work
1. **Minefield:** rename `thinIce` to `minefield` everywhere (id, folder, balance block, tests, catalog, assets) and swap in the new art and words. Its rules stay. Run the tests.
2. **The new Thin Ice** (section 7): a new game in `src/minigames/thinIce/`, with its own logic, tests, bot and pop-up content.
3. **The six new games,** one at a time, each with logic, tests, UI, bot, catalog entry, testing settings and pop-up content:
   - Sketchy Bridge;
   - Falling Rocks;
   - Fly Block;
   - Squirrel Theft;
   - Birdsong;
   - Pack It Up.
4. **Dodge:**
   - ice physics (section 9.4);
   - the Eagle with his three versions (section 9.1);
   - then the Snow Leopard and the Snowgirl.
5. **Pop-up content** for everything (section 10).

Each game follows the patterns already in the repo: pure, seeded logic with tests; a runner in `src/ui/minigames/`; and an icon. Passing challenges use `passingResult`.

## 2. Things to flag to Wyatt
These are my readings, not his words:
- **Birdsong:** each color also gets its own shape (for color-blind players and the greens).
- **Squirrel Theft:**
  - it's all or nothing: the stolen things come back, or they're lost;
  - the line is a share of all the party's nuts.
- **Sketchy Bridge:**
  - the zone rises while held and falls when let go, like Stardew's bar;
  - the hiker who breaks the bridge is hurt, and the rest only lose the cost of trying.
- **Fly Block:**
  - each hiker plays their own round with 3 bites;
  - bees from Tier III must be let through.
- **Falling Rocks:** 2 lives per hiker, and overhangs are safe from everything.
- **Thin Ice:** an ice pick (a few per hiker) tests squares 2 away. There's no clock.
- **Eagle:**
  - he joins the random roster at every tier;
  - the Freeagle challenge is Tier II in `04-challenges.md`, but Wyatt put Freeagle at Tier III in Dodge. When the challenges get hooked up, the Freeagle challenge should force that version.
- **The snow animals** only come from their snow challenges and the testing tab.
- **Many attacks are my ideas,** marked in `23`, section 9. Wyatt named Swoop, the hair attack, the gun and the oil barrels.

## 3. Tests
`23`, section 13.
