# Minigames (Phase 10.8): the party GPS, the challenge pop-up, and Bearrels

Wyatt's design for how challenge minigames look and play. The first game is **Bearrels**, built and played from a new **Minigame testing** tab on the main menu. Numbers in [brackets] are first guesses: they go in `balance.ts` with `TODO(wyatt)`.

## The pieces

1. **The challenge pop-up:** a cream window with a red banner. It's where the player reads the challenge, prepares, and presses Start.
2. **The party GPS:** a yellow, landscape handheld that the whole party shares. Minigames play on its screen. On Start it lifts toward the player until its screen fills most of the window.
3. **The minigame:** drawn in the layered-silhouette style (look C). It runs inside the GPS screen and returns a result to the pop-up.

Build all three as reusable parts. Every later minigame plugs into the same pop-up and GPS.

## 1. The challenge pop-up

See `mockups/2-popup-before-start.jpg`. Layout, top to bottom:

- **Red banner** (#C8423A, with a darker bottom edge #8E2A24):
  - left: "CHALLENGE · TIER II";
  - center: the challenge name in the pixel font, between two small diamond badges that show the game's icon;
  - right: "WHOLE PARTY".
- **Poster** on the left, 2:3, with a cream mat (#FBF4E2) and a dark keyline. Bear Country uses `posters/bear-country.png`. Wyatt is painting the rest. Posters are art only, and the game sets the name in the banner.
- **Right column:**
  - the flavor line, in italic;
  - **The game:** icon, game name, one short line on how it plays, and a chip such as "Harder in a group";
  - **Prepare:** up to 3 option cards (effect plus cost). **Hidden in test mode**;
  - **If hit:** a red-outlined box with what failing costs;
  - **On this tile:** the hikers, as portraits with their color rings;
  - **Start:** a big red button.
- After a game, the pop-up shows the result line ("1 safe, 2 hit") plus Continue. In test mode it shows **Back to testing** and **Play again**.

## 2. The party GPS

See `mockups/3-gps-lifted-placing.jpg` and `mockups/5-popup-layout-reference.jpg`. Build it in CSS and SVG; it needs no image files.

- **Body:** a landscape rounded rectangle with a yellow gradient (#F6CB3A to #E2A91E) and a dark inner face (#1C201E).
  - A black antenna nub on the top right, and two small side buttons on the top edge.
  - A D-pad on the left, and two round buttons on the right (one yellow, one dark).
  - "TRAILMATE" in small yellow pixel letters under the screen.
- **Screen:** 16:9, with a near-black bezel. On top of the game sit:
  - faint scanlines (horizontal lines about 6% dark, every 3 px);
  - a soft inner shadow;
  - a faint glass sheen in the top-left corner;
  - a warm glow around the bezel.
- **Lift:** when Start is pressed, the GPS slides up from below the pop-up and scales up over [600 ms] with a small overshoot.
  - Lifted size: the screen is as large as fits, up to [88%] of the window width. On a phone in landscape the side controls shrink so the screen gets at least [80%] of the height.
  - The pop-up behind dims to about [35%] brightness with a light blur.
  - On Continue, the GPS lowers back in [400 ms].
- The D-pad and buttons are decoration for now. Keyboard controls are listed under Bearrels below.
- Reduced motion: the GPS fades in at full size instead of flying up.

## 3. Art style for minigames: layered silhouettes (look C)

See `mockups/7-style-c-full-frame.jpg` and the `art/bearrels/` parts.

- **Scene:** an SVG with a 1280 × 720 viewBox, scaled to the screen. Flat layers in warm inks, from a pale peach sky down through layered orange and red ridges to dark maroon ground. The main things in the scene are dark silhouettes with a warm rim light offset up and to the right.
- **Hikers:** each hiker is a silhouette whose **rim light is the hiker's own color**, plus a bandana in that color. The same color rings the hiker's portrait in the UI, which is how the player tells the silhouettes apart.
  - Use each hiker's color from the game data if there is one. If not, use `layout.json` → `hikerColors`.
  - Each hiker has a silhouette shape:

    | Hiker | Shape |
    | --- | --- |
    | Finn | Dog, floppy ears |
    | Ellie | Fluffy dog |
    | Mom | Sun hat |
    | Wyatt | Messy hair |
    | Gdog | Curly hair and glasses |
    | Wink | Bald with glasses |

  - Fallback for future hikers: dog → floppy dog, person → messy hair.
- **In-game UI:** DOM on top of the scene, scaled with the screen.
  - **Pills:** dark translucent (rgba(42,10,24,.72)) with cream text in DM Sans bold.
  - **Round pill:** top left.
  - **Prompt:** top center. It turns red for bad news.
  - **Shots:** top right, one crosshair icon per shot each round.
  - **Hiker tokens:** bottom left.
  - **Ready:** bottom right.

## 4. Bearrels

The base game is Barrels, with the bear version for the Bear Country challenge. Hide your hikers behind barrels. Each round the bear pops up and shoots. Anyone behind the barrel it hits is out.

### Settings (test tab)

| Setting | Range | Default |
| --- | --- | --- |
| Barrels | 3 to 6 | 3 |
| Hikers | pick 1 to 4 of the playable hikers | Finn, Ellie, Mom |
| Rounds | 1 to 5 | 3 |
| Shots per round | 1 or 2 (never the same barrel twice in a round) | 1 |

### Rules

- Several hikers can hide behind the same barrel. A shot hits **everyone** behind that barrel.
- A hiker who is hit is **out for the rest of the game**.
- The bear picks its barrels at random, with every barrel equally likely, before the crosshair starts moving.
- The game ends after the last round, or as soon as every hiker is out.
- The result is a list of hikers who are safe, and hikers who were hit (with the round).
- Later, in the real challenge, each hiker hit takes 1 Injury, and if everyone is hit the party loses 1 Luck. **This update doesn't apply any of it.**

### Layout of the scene (viewBox units)

- Barrels sit in one row, evenly spaced from x [150] to x [1130]. A single barrel goes at x 640.
  - Barrel width = min([150], 980 ÷ (barrels − 1) × [0.7]).
  - Height = width × 1.06, and the top sits at y [418].
- Hikers behind a barrel:
  - scale [1.05] alone, [0.8] for two, [0.6] for three or four, times min(1, width ÷ 150);
  - spaced 76 × scale apart;
  - head center at y = barrel top − 56 × scale.
- The bear sits behind a rock in the middle of the ridge line:
  - **hidden:** only its ears show over the rock;
  - **up:** standing, holding a cork popgun;
  - **fire:** a muzzle flash at the popgun.
- The crosshair is a cream ring with four ticks.
- The hiker tokens and Ready button sit along the bottom edge and must never cover a barrel.

### Flow of a round

See `mockups/3-gps-lifted-placing.jpg` and `mockups/4-game-states.jpg`.

1. **Placing.** The bear is hidden. Prompt: "Pick a hiker, then a barrel".
   - The token bar shows each hiker still in: a portrait with a ring in their color, and their name.
   - The first hiker not yet placed is selected automatically. A selected token lifts a little and glows in the hiker's color.
   - Tap or click a token to select that hiker. Tapping a hiker who is already placed selects them so they can move.
   - With a hiker selected, hovering a barrel shows a dashed cream outline. Tapping it moves the hiker behind that barrel, sliding over [250 ms]. Their token gets a badge with the barrel number, and the next unplaced hiker is selected.
   - **Ready** stays greyed out until every hiker still in is placed, then lights up. In later rounds hikers stay where they were, so Ready is lit at once, and they can still be moved.
2. **The bear pops up.** Tokens lock. Prompt: "Here it comes…".
   - The ears drop, then the bear rises from behind the rock over [450 ms] with a small bounce.
   - The crosshair sweeps across the barrels, left to right and back, over about [1.4 s]. It slows down and settles on the chosen barrel.
3. **Fire.**
   - A [300 ms] hold, then the bear's fire frame, and the target barrel shakes with splinters.
   - **If anyone is behind it:**
     - **red flash:** a full-screen #E5483A overlay at about 40% plus a thick red inner border. It comes in over [60 ms] and fades out over [400 ms];
     - a short screen shake;
     - the hit hikers tip over (rotate −24°, drop a little) and fade to 40%;
     - the prompt turns red: "Ellie and Mom were hit!" (or "Finn was hit!");
     - their tokens grey out with a red X.
   - **If the barrel is empty:** a puff of smoke and "Missed!".
   - With 2 shots, the second shot runs [600 ms] later on a different barrel.
4. **The bear ducks** behind the rock. Hikers who were hit fade out of the scene, the round pill counts up, and the next round starts.
5. **Results.** The scene dims and a cream card shows "1 safe, 2 hit" with each hiker's portrait, name, and either "Safe" or "Hit in round 2". Buttons: **Continue** (lowers the GPS and goes back to the pop-up) and **Play again**.

### Controls

- **Touch or mouse:** tap a token, then a barrel, then Ready.
- **Keyboard:**
  - 1–4 selects a hiker;
  - ← and → move a highlight across the barrels;
  - Enter or Space places the hiker, or presses Ready once everyone is placed.

### Reduced motion

No shake. A softer red flash (about 20%, no border). The crosshair jumps straight to its barrel.

### Sound

Leave hooks for these sounds, but add no sound files yet: place, ready, bear up, crosshair tick, pop, hit, miss.

## 5. The Minigame testing tab

See `mockups/1-testing-tab.jpg`.

- **On the main menu:** a plain **Minigame testing** button, always shown for now.
- **The screen:** the cream window with a red banner reading "MINIGAME TESTING", and "← Main menu" on the left.
  - **Left:** the list of minigames. Bearrels is active. Ants Are Marching (Snake), Cracked Bridge (Platformer), Fly Swatter (Reaction) and Trail Memory (Memory) show as dashed "coming soon" rows.
  - **Right:** the name and a one-line description, then the settings:
    - Barrels and Rounds as − / + steppers;
    - Shots per round as two buttons, 1 and 2;
    - Hikers as portrait toggles for the playable hikers. Up to 4 can be picked, and unpicked ones are dimmed.
  - **Preview:** a small live picture of the scene with the current number of barrels.
  - **Test it:** a big red button. A line above it says "Opens the Bear Country pop-up, then the game. Nothing is saved."
- Remember the last settings on this device (local storage).
- **Test it** opens the Bear Country pop-up in test mode:
  - the poster, banner, flavor, The game and If hit sections, with the picked hikers under On this tile;
  - no Prepare section.

  Start → the GPS lifts → Bearrels → the results card → Continue → the GPS lowers → the pop-up shows the result line with **Back to testing** and **Play again**.
- Test mode never touches the save, XP, stats or anything else in a run.
