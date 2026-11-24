# Update: November 24, 2026 (Phase 10.8 start: Minigame testing + Bearrels)

**Build this next.** If Phase 10.7 (Hikers) is still in progress, finish it first. Hiker trees for the other characters are on hold while we build challenges, so we can get the core loop working and test the current hikers.

This update adds the parts every challenge minigame will use, and the first game:
- the **challenge pop-up** (red banner, poster, Start);
- the **party GPS** that lifts up to play;
- the **minigame art style**;
- **Bearrels**, playable from a new **Minigame testing** tab on the main menu.

The full design is in `10-minigames.md`. Read it first. Numbers in [brackets] are first guesses: put them in `balance.ts` with `TODO(wyatt)`. Nothing here needs Wyatt's answer before building.

**Where these files go** (Wyatt unzipped this folder into the repo as it is):
- `10-minigames.md` → `docs/design/10-minigames.md`.
- `mockups/*` → `docs/mockups/minigames/`. Mockups 5 and 6 are only for the GPS layout: their screens show other art styles, so ignore the art in them. The chosen style is look C (mockup 7 and the frames).
- `art/bearrels/*` → the game's asset folder, under `minigames/bearrels/`. These are the scene parts as SVG:
  - background;
  - the bear in three states (each includes the rock);
  - a barrel;
  - one silhouette per hiker;
  - the crosshair.

  `layout.json` has the positions, the hiker colors and the inks. Use the parts as they are, or redraw them in code from the same shapes and colors. Either is fine.
- `posters/bear-country.png` (1200 × 1800) → the game's asset folder, under `posters/`.
- Add a line to `08-overhaul-plan.md` under Challenges: "Minigame look, the party GPS and the pop-up are in `10-minigames.md`."
- Then delete the leftover `update-2026-11-24-bearrels-test/` folder.

---

## 1. Plan (update `BUILD_PLAN.md` first, and commit)
- **Phase 10.8: Challenges, step 1 (now):** this update.
- **Phase 10.8, next steps (outline only):**
  - more minigames, added to the testing tab one at a time;
  - then hooking minigames into real challenges with Prepare and stakes.
- Keep **Phase 10.7b (trees for locked hikers)** as on hold.

## 2. Build order
1. **Minigame framework:** a registry of minigames. Each minigame has:
   - an id;
   - a name;
   - a base game;
   - a settings schema (ranges and defaults);
   - a `run` that mounts into the GPS screen and resolves with a result: who was safe, who was hit and in which round.

   Keep it independent of runs and saves, so the testing tab and real challenges use the same code.
2. **The challenge pop-up component**, with a test mode that hides Prepare (see section 1 of the design).
3. **The party GPS component** with the lift and lower animations (section 2). Check it at desktop size and on a phone in landscape.
4. **Bearrels** (sections 3 and 4): the scene, the in-game UI, the flow of a round, the red flash, the results card, the controls, and reduced motion.
5. **The Minigame testing tab** on the main menu (section 5).

## 3. Must-haves Wyatt asked for
- 3 to 6 barrels; 1 to 4 hikers; 1 to 5 rounds; 1 or 2 shots per round.
- **Each hiker is picked on their own, then sent to a barrel.**
- Then the bear pops up and shoots a random barrel.
- **A red flash when a hiker is hit.**
- Hikers are told apart by color: each silhouette is rim-lit in the hiker's color, matching the ring on their portrait token.
- The GPS lifts closer to the player when the game starts, so its screen is big and easy to see.

## 4. Tests
- Barrel layout for 3 to 6 barrels: positions, widths, and no overlap with the token bar.
- With 2 shots, a round never hits the same barrel twice.
- A hit takes out everyone behind that barrel, and hikers who are out can't be selected or placed.
- The game ends early when everyone is out.
- Ready stays off until every hiker still in is placed.
- The keyboard flow works end to end.
- Test mode never changes save data.

## 5. Not in this update
- Prepare options, real challenge stakes (Injury, Luck), XP from challenges.
- Other minigames (they show as "coming soon" in the list).
- Sound files (leave hooks only).
- Using the D-pad and buttons on the GPS.

## When you're done
Send Wyatt a short summary with:
- what's built;
- anything you had to interpret;
- the default timings you picked, if any differ from the doc;
- how to open the testing tab.
