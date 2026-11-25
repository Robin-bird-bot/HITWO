# Challenge Passed / Challenge Failed (the end screen for every minigame)

Wyatt wants a classic game-over style screen at the end of every challenge, inside the GPS screen, before the GPS turns back.

**The flow:** game ends → transition → end screen → the player taps → the GPS turns back upright → the pop-up result (as before).

**Passed or failed:**
- **CHALLENGE PASSED** if at least one hiker passed. For passing challenges, that means the challenge was cleared.
- **CHALLENGE FAILED** if nobody passed.
- The list on the end screen always shows exactly who passed and who failed.

See `mockups/end-screens/` (`challenge-passed.gif` and `challenge-failed.gif` show the transitions moving).

---

## 1. The end screen
Drawn in the 320 × 240 scene, like the games.
- **Background:** the dark green (G1), filling the screen.
- **Title,** top center at y [46]:
  - "CHALLENGE PASSED" in G9, or "CHALLENGE FAILED" in red (#C8423A);
  - big EditUndo, about [19] units tall, with a 2-unit G0 drop shadow.
- **Flashing:** the title is on for [0.5 s] and off for [0.2 s], for the first [2.5 s], then it stays on.
- **Under the title:** the game and tier, small, in G7 ("CHOP TREE · TIER II").
- **The hikers,** one row each, in line order:
  - their token;
  - their name;
  - PASSED (G9) or FAILED (red);
  - what they pay, small, in G7 ("−1 ENERGY", "−1 RESOURCE, BLEEDING").
- **One line about the tile** for passing challenges:
  - "THE WAY IS CLEAR" when it was cleared;
  - "THE <CHALLENGE> STAYS ON THE TILE" when nobody passed.
- **"TAP TO CONTINUE"** at the bottom (G6). It takes input after [0.8 s], so a late tap from the game doesn't skip the screen.
- **Test mode:** the same screen. Nothing is applied to the save.

## 2. Failing: blood drips
Like the old game-over where you're shot and red runs down the screen.
- **The drips:**
  - red (#C8423A) drips run down from the top edge over the last frame of the game;
  - each drip is [2–5] units wide, with a darker red (#8E2A24) left edge and a round drop at its tip;
  - drips start at slightly different times ([0–0.25 s]) and fall at different speeds, speeding up as they go, so the whole screen is covered after about [1.0 s].
- **The drain:** the end screen wipes in from the top over [0.3 s], replacing the red.
- **What stays:** short dark-red drips ([6–24] units long) keep hanging from the top edge of the end screen.
- **Then** the title flashes.

## 3. Passing: a clock wipe
Like the scene changes in the original Star Wars movies.
- **The wipe:** a hand sweeps clockwise from 12 o'clock around the center of the screen, over [0.8 s]. Behind it, the end screen replaces the game.
- **The edge:** the sweeping edge is a thin G9 line.
- **Then** the title flashes.

## 4. Details
- **Reduced motion:** no drips or wipe; a [0.3 s] crossfade to the end screen, and the title doesn't flash.
- **Sound (optional, later):**
  - failing: a low, falling tone;
  - passing: a short rising arpeggio.
- **Build it once:** as a shared piece of the minigame framework, like the pop-up and the GPS. Every game hands it the result (who passed, who failed, what each pays, and the tile note).

## 5. Tests
- **The title:** PASSED when at least one hiker passed, FAILED when nobody did.
- **The list:** it matches the result exactly, in line order.
- **Input:** taps in the first [0.8 s] are ignored.
- **Reduced motion:** a crossfade instead of the drips or the wipe.
